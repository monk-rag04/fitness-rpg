import type {
  ExerciseId,
  GymEquipmentProfile,
  StageRoadmap,
  StageTrainingDayValidationContext,
  TrainingCandidateResult,
  TrainingSessionPlannerInput,
  ValidatedStageTrainingProgram,
} from '@fitness-rpg/shared';
import {
  EQUIPMENT_IDS,
  ROADMAP_DURATION_CANDIDATES,
  TrainingCandidateError,
  buildTrainingCandidates,
  getCanonicalStageTrainingDays,
  getExerciseById,
  validateStageTrainingProgram,
  validateTrainingSessionPlannerInput,
} from '@fitness-rpg/shared';
import type OpenAI from 'openai';
import { APIConnectionError, APIError } from 'openai';

import { createOpenAIClient, getOpenAIModel } from './client.js';
import { createStageTrainingProgramDraftFormat } from './stageTrainingProgramSchema.js';

/** Server-internal context for one complete Stage Program generation. */
export interface StageTrainingProgramGenerationInput {
  readonly roadmap: StageRoadmap;
  readonly equipmentProfile: GymEquipmentProfile;
  readonly mainExerciseId: ExerciseId;
  readonly currentE1rmKg: number;
  readonly stageTargetE1rmKg: number;
  readonly trainingExperienceMonths: number;
  readonly trainingFrequencyPerWeek: number;
}

export type StageTrainingProgramGenerationErrorCode =
  | 'INVALID_INPUT'
  | 'MAIN_EXERCISE_UNAVAILABLE'
  | 'NO_VALID_CANDIDATES'
  | 'OPENAI_API_ERROR'
  | 'STRUCTURED_OUTPUT_MISSING'
  | 'DOMAIN_VALIDATION_FAILED';

export type StageTrainingProgramFailureCategory =
  | 'INPUT_PRECONDITION'
  | 'NO_VALID_CANDIDATES'
  | 'EQUIPMENT_CONSTRAINT'
  | 'STRUCTURED_OUTPUT'
  | 'SESSION_VALIDATION'
  | 'MAIN_EXPOSURE'
  | 'STAGE_COVERAGE'
  | 'TRANSIENT_PROVIDER'
  | 'NON_RETRYABLE_PROVIDER';

export interface StageTrainingProgramFailureReason {
  readonly reasonCode: string;
  readonly dayIndex?: number;
  readonly exerciseId?: string;
  readonly path?: string;
}

export interface StageTrainingProgramFailureDetails {
  readonly category: StageTrainingProgramFailureCategory;
  readonly reasons?: readonly StageTrainingProgramFailureReason[];
  readonly attempt?: number;
  readonly providerStatus?: number;
}

export class StageTrainingProgramGenerationError extends Error {
  public constructor(
    public readonly code: StageTrainingProgramGenerationErrorCode,
    message: string,
    public readonly details: StageTrainingProgramFailureDetails = {
      category: 'INPUT_PRECONDITION',
    },
  ) {
    super(message);
    this.name = 'StageTrainingProgramGenerationError';
  }
}

interface StageTrainingProgramPromptDay {
  readonly dayIndex: number;
  readonly sessionFocus: TrainingSessionPlannerInput['context']['sessionFocus'];
  readonly bossMainExposure: boolean;
  readonly requiredMainExerciseId?: ExerciseId;
  readonly allowedExerciseIds: readonly ExerciseId[];
}

interface PreparedStageTrainingProgramGeneration {
  readonly input: StageTrainingProgramGenerationInput;
  readonly trainingDays: readonly StageTrainingDayValidationContext[];
  readonly promptDays: readonly StageTrainingProgramPromptDay[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(value).every((field) => fields.includes(field));
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidFrequency(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 7;
}

function isValidExperience(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isCanonicalRoadmap(value: unknown): value is StageRoadmap {
  if (!isRecord(value) || !hasOnlyFields(value, [
    'startDate',
    'durationDays',
    'trainingFrequencyPerWeek',
    'mainExerciseId',
    'stageTargetE1rmKg',
    'days',
    'boss',
    'generationRuleVersion',
  ])) {
    return false;
  }

  if (typeof value.startDate !== 'string' ||
      typeof value.durationDays !== 'number' ||
      !ROADMAP_DURATION_CANDIDATES.includes(value.durationDays as (typeof ROADMAP_DURATION_CANDIDATES)[number]) ||
      !isValidFrequency(value.trainingFrequencyPerWeek) ||
      typeof value.mainExerciseId !== 'string' ||
      getExerciseById(value.mainExerciseId) === undefined ||
      !isPositiveFinite(value.stageTargetE1rmKg) ||
      !Array.isArray(value.days) ||
      value.days.length !== value.durationDays ||
      !isRecord(value.boss) ||
      value.boss.type !== 'boss' ||
      typeof value.boss.date !== 'string' ||
      typeof value.generationRuleVersion !== 'string') {
    return false;
  }

  return value.days.every((day) => {
    if (!isRecord(day) || typeof day.date !== 'string') return false;
    if (day.type === 'recovery') return hasOnlyFields(day, ['date', 'type']);
    return day.type === 'training' &&
      hasOnlyFields(day, ['date', 'type', 'sessionFocus', 'bossMainExposure']) &&
      typeof day.bossMainExposure === 'boolean' &&
      isRecord(day.sessionFocus) &&
      hasOnlyFields(day.sessionFocus, ['targetMuscles', 'targetMovementPatterns']) &&
      Array.isArray(day.sessionFocus.targetMuscles) &&
      (day.sessionFocus.targetMovementPatterns === undefined ||
        Array.isArray(day.sessionFocus.targetMovementPatterns));
  });
}

function isGymEquipmentProfile(value: unknown): value is GymEquipmentProfile {
  return isRecord(value) &&
    hasOnlyFields(value, ['id', 'displayName', 'availableEquipmentIds']) &&
    typeof value.id === 'string' && value.id.trim() !== '' &&
    typeof value.displayName === 'string' && value.displayName.trim() !== '' &&
    Array.isArray(value.availableEquipmentIds) &&
    value.availableEquipmentIds.every((equipmentId) =>
      typeof equipmentId === 'string' && EQUIPMENT_IDS.includes(equipmentId as (typeof EQUIPMENT_IDS)[number]),
    ) &&
    new Set(value.availableEquipmentIds).size === value.availableEquipmentIds.length;
}

function validateGenerationInput(input: unknown): StageTrainingProgramGenerationInput | null {
  if (!isRecord(input) || !hasOnlyFields(input, [
    'roadmap',
    'equipmentProfile',
    'mainExerciseId',
    'currentE1rmKg',
    'stageTargetE1rmKg',
    'trainingExperienceMonths',
    'trainingFrequencyPerWeek',
  ]) ||
  !isCanonicalRoadmap(input.roadmap) ||
  !isGymEquipmentProfile(input.equipmentProfile) ||
  typeof input.mainExerciseId !== 'string' ||
  getExerciseById(input.mainExerciseId) === undefined ||
  !isPositiveFinite(input.currentE1rmKg) ||
  !isPositiveFinite(input.stageTargetE1rmKg) ||
  !isValidExperience(input.trainingExperienceMonths) ||
  !isValidFrequency(input.trainingFrequencyPerWeek)) {
    return null;
  }

  // The Roadmap remains canonical. These repeated values are Stage context for
  // the prompt, so reject a stale or mismatched server-side composition.
  if (input.mainExerciseId !== input.roadmap.mainExerciseId ||
      input.stageTargetE1rmKg !== input.roadmap.stageTargetE1rmKg ||
      input.trainingFrequencyPerWeek !== input.roadmap.trainingFrequencyPerWeek) {
    return null;
  }

  return {
    roadmap: input.roadmap,
    equipmentProfile: {
      id: input.equipmentProfile.id,
      displayName: input.equipmentProfile.displayName,
      availableEquipmentIds: [...input.equipmentProfile.availableEquipmentIds],
    },
    mainExerciseId: input.mainExerciseId as ExerciseId,
    currentE1rmKg: input.currentE1rmKg,
    stageTargetE1rmKg: input.stageTargetE1rmKg,
    trainingExperienceMonths: input.trainingExperienceMonths,
    trainingFrequencyPerWeek: input.trainingFrequencyPerWeek,
  };
}

function allowedExerciseIds(candidates: TrainingCandidateResult): readonly ExerciseId[] {
  return [
    ...(candidates.mainExercise === undefined ? [] : [candidates.mainExercise.exerciseId]),
    ...candidates.candidateExercises.map((candidate) => candidate.exerciseId),
  ];
}

function prepareStageTrainingProgramGeneration(
  input: StageTrainingProgramGenerationInput,
): PreparedStageTrainingProgramGeneration {
  const trainingDays: StageTrainingDayValidationContext[] = [];
  const promptDays: StageTrainingProgramPromptDay[] = [];

  // Check the Stage Main equipment independently of the exposure-day loop so
  // malformed or unexpectedly sparse Roadmaps cannot reach the Provider.
  try {
    buildTrainingCandidates({
      equipmentProfile: input.equipmentProfile,
      bossMainExerciseId: input.mainExerciseId,
      bossMainExposure: true,
    });
  } catch (error) {
    if (error instanceof TrainingCandidateError && error.code === 'MAIN_EXERCISE_UNAVAILABLE') {
      throw new StageTrainingProgramGenerationError(
        'MAIN_EXERCISE_UNAVAILABLE',
        'The Main Exercise is unavailable with the Stage equipment profile.',
        { category: 'EQUIPMENT_CONSTRAINT', reasons: [{ reasonCode: 'MAIN_EXERCISE_UNAVAILABLE', exerciseId: input.mainExerciseId }] },
      );
    }
    throw new StageTrainingProgramGenerationError(
      'INVALID_INPUT',
      'Stage Training Program input could not validate the Main Exercise.',
      { category: 'INPUT_PRECONDITION', reasons: [{ reasonCode: 'INVALID_MAIN_EXERCISE', exerciseId: input.mainExerciseId }] },
    );
  }

  for (const day of getCanonicalStageTrainingDays(input.roadmap)) {
    let candidates: TrainingCandidateResult;
    try {
      candidates = buildTrainingCandidates({
        equipmentProfile: input.equipmentProfile,
        bossMainExerciseId: input.mainExerciseId,
        bossMainExposure: day.bossMainExposure,
        targetMuscles: day.sessionFocus.targetMuscles,
        ...(day.sessionFocus.targetMovementPatterns === undefined
          ? {}
          : { targetMovementPatterns: day.sessionFocus.targetMovementPatterns }),
      });
    } catch (error) {
      if (error instanceof TrainingCandidateError && error.code === 'MAIN_EXERCISE_UNAVAILABLE') {
        throw new StageTrainingProgramGenerationError(
          'MAIN_EXERCISE_UNAVAILABLE',
          'The Main Exercise is unavailable with the Stage equipment profile.',
          { category: 'EQUIPMENT_CONSTRAINT', reasons: [{ reasonCode: 'MAIN_EXERCISE_UNAVAILABLE', dayIndex: day.dayIndex, exerciseId: input.mainExerciseId }] },
        );
      }
      throw new StageTrainingProgramGenerationError(
        'INVALID_INPUT',
        'Stage Training Program input could not build Training Day candidates.',
        { category: 'INPUT_PRECONDITION', reasons: [{ reasonCode: 'INVALID_SESSION_FOCUS', dayIndex: day.dayIndex }] },
      );
    }

    const exerciseIds = allowedExerciseIds(candidates);
    if (exerciseIds.length === 0) {
      throw new StageTrainingProgramGenerationError(
        'NO_VALID_CANDIDATES',
        'No allowed exercises can satisfy this Training Day with the selected equipment.',
        { category: 'NO_VALID_CANDIDATES', reasons: [{ reasonCode: 'NO_VALID_CANDIDATES', dayIndex: day.dayIndex }] },
      );
    }

    const plannerInput = validateTrainingSessionPlannerInput({
      candidates,
      context: {
        trainingExperienceMonths: input.trainingExperienceMonths,
        sessionFocus: day.sessionFocus,
      },
    });
    if (!plannerInput.valid) {
      throw new StageTrainingProgramGenerationError(
        'INVALID_INPUT',
        'Stage Training Program input contains an invalid Training Day context.',
        { category: 'INPUT_PRECONDITION', reasons: [{ reasonCode: 'INVALID_SESSION_FOCUS', dayIndex: day.dayIndex }] },
      );
    }

    trainingDays.push({
      dayIndex: day.dayIndex,
      sessionFocus: plannerInput.value.context.sessionFocus,
      bossMainExposure: day.bossMainExposure,
      candidates: plannerInput.value.candidates,
    });
    promptDays.push({
      dayIndex: day.dayIndex,
      sessionFocus: plannerInput.value.context.sessionFocus,
      bossMainExposure: day.bossMainExposure,
      ...(day.bossMainExposure ? { requiredMainExerciseId: input.mainExerciseId } : {}),
      allowedExerciseIds: exerciseIds,
    });
  }

  return { input, trainingDays, promptDays };
}

const STAGE_COVERAGE_ERROR_CODES = new Set([
  'INVALID_DAY_INDEX',
  'DUPLICATE_DAY_INDEX',
  'MISSING_TRAINING_DAY',
  'RECOVERY_DAY_NOT_ALLOWED',
  'BOSS_DAY_NOT_ALLOWED',
  'OUT_OF_RANGE_DAY_INDEX',
]);

function getValidationLocation(
  path: string,
  draft: unknown,
): Pick<StageTrainingProgramFailureReason, 'dayIndex' | 'exerciseId'> {
  const result: { dayIndex?: number; exerciseId?: string } = {};
  const sessionMatch = /^program\.sessions\[(\d+)\]/.exec(path);
  if (sessionMatch !== null && isRecord(draft) && Array.isArray(draft.sessions)) {
    const session = draft.sessions[Number(sessionMatch[1])];
    if (isRecord(session) && typeof session.dayIndex === 'number' && Number.isSafeInteger(session.dayIndex)) {
      result.dayIndex = session.dayIndex;
    }
    const exerciseMatch = /\.exercises\[(\d+)\]/.exec(path);
    if (exerciseMatch !== null && isRecord(session) && isRecord(session.plan) &&
        Array.isArray(session.plan.exercises)) {
      const exercise = session.plan.exercises[Number(exerciseMatch[1])];
      if (isRecord(exercise) && typeof exercise.exerciseId === 'string' &&
          /^[a-z0-9_]{1,80}$/.test(exercise.exerciseId)) {
        result.exerciseId = exercise.exerciseId;
      }
    }
  } else {
    const dayMatch = /trainingDays\[(\d+)\]/.exec(path);
    const missingDayMatch = /dayIndex=(\d+)/.exec(path);
    if (dayMatch !== null) result.dayIndex = Number(dayMatch[1]);
    else if (missingDayMatch !== null) result.dayIndex = Number(missingDayMatch[1]);
  }
  return result;
}

function classifyStageValidationError(
  error: { readonly code: string; readonly path: string; readonly planErrorCode?: string },
  dayIndex: number | undefined,
  roadmap: StageRoadmap,
  exerciseId: string | undefined,
): Pick<StageTrainingProgramFailureReason, 'reasonCode'> & { readonly category: StageTrainingProgramFailureCategory } {
  if (error.planErrorCode !== undefined) {
    switch (error.planErrorCode) {
      case 'EXERCISE_NOT_ALLOWED':
        return getExerciseById(exerciseId ?? '') === undefined
          ? { category: 'SESSION_VALIDATION', reasonCode: 'UNKNOWN_EXERCISE' }
          : { category: 'EQUIPMENT_CONSTRAINT', reasonCode: 'EQUIPMENT_UNAVAILABLE' };
      case 'MAIN_EXERCISE_MISSING':
      case 'MAIN_EXERCISE_ROLE_INVALID':
      case 'MAIN_ROLE_MISSING':
        return dayIndex !== undefined && roadmap.days[dayIndex]?.type === 'training' &&
            roadmap.days[dayIndex].bossMainExposure
          ? { category: 'MAIN_EXPOSURE', reasonCode: 'INVALID_MAIN_EXPOSURE' }
          : { category: 'SESSION_VALIDATION', reasonCode: 'MISSING_REQUIRED_MAIN' };
      case 'MULTIPLE_MAIN_EXERCISES':
        return { category: 'MAIN_EXPOSURE', reasonCode: 'MULTIPLE_MAIN' };
      case 'INVALID_SETS':
      case 'TOO_MANY_WORKING_SETS':
      case 'TOO_MANY_EXERCISES':
        return { category: 'SESSION_VALIDATION', reasonCode: 'INVALID_SET_COUNT' };
      case 'INVALID_REP_RANGE':
        return { category: 'SESSION_VALIDATION', reasonCode: 'INVALID_REP_RANGE' };
      default:
        return { category: 'SESSION_VALIDATION', reasonCode: error.planErrorCode };
    }
  }

  if (STAGE_COVERAGE_ERROR_CODES.has(error.code)) {
    return { category: 'STAGE_COVERAGE', reasonCode: 'STAGE_COVERAGE_INVALID' };
  }
  if (error.code === 'INVALID_CANDIDATE_CONTEXT' || error.code === 'INVALID_CANDIDATE_CONTEXTS' ||
      error.code === 'MISSING_CANDIDATE_CONTEXT' || error.code === 'NON_TRAINING_CANDIDATE_CONTEXT' ||
      error.code === 'OUT_OF_RANGE_CANDIDATE_CONTEXT') {
    return { category: 'INPUT_PRECONDITION', reasonCode: 'INVALID_SESSION_FOCUS' };
  }
  if (error.code === 'INVALID_PROGRAM_SHAPE' || error.code === 'INVALID_PROGRAM_FIELD') {
    return { category: 'STRUCTURED_OUTPUT', reasonCode: 'STRUCTURED_OUTPUT_INVALID' };
  }
  if (error.code === 'MISSING_REQUIRED_MAIN') {
    return { category: 'MAIN_EXPOSURE', reasonCode: 'MISSING_REQUIRED_MAIN' };
  }
  return { category: 'SESSION_VALIDATION', reasonCode: error.code };
}

function createValidationFailureReasons(
  errors: readonly { readonly code: string; readonly path: string; readonly planErrorCode?: string }[],
  draft: unknown,
  roadmap: StageRoadmap,
): readonly StageTrainingProgramFailureReason[] {
  return errors.slice(0, 12).map((error) => {
    const location = getValidationLocation(error.path, draft);
    const classification = classifyStageValidationError(
      error,
      location.dayIndex,
      roadmap,
      location.exerciseId,
    );
    return {
      reasonCode: classification.reasonCode,
      ...location,
      ...(error.path.length <= 160 ? { path: error.path } : {}),
    };
  });
}

function getPrimaryValidationCategory(
  errors: readonly { readonly code: string; readonly path: string; readonly planErrorCode?: string }[],
  draft: unknown,
  roadmap: StageRoadmap,
): StageTrainingProgramFailureCategory {
  const first = errors[0];
  if (first === undefined) return 'SESSION_VALIDATION';
  const location = getValidationLocation(first.path, draft);
  return classifyStageValidationError(first, location.dayIndex, roadmap, location.exerciseId).category;
}

function getAllowedExerciseUnion(prepared: PreparedStageTrainingProgramGeneration): readonly ExerciseId[] {
  return [...new Set(prepared.promptDays.flatMap((day) => day.allowedExerciseIds))];
}

/** Build only canonical Stage context and optional compact repair diagnostics. */
export function buildStageTrainingProgramInput(
  prepared: PreparedStageTrainingProgramGeneration,
  previousFailure?: readonly StageTrainingProgramFailureReason[],
): string {
  return JSON.stringify({
    bossMainExerciseId: prepared.input.mainExerciseId,
    currentE1rmKg: prepared.input.currentE1rmKg,
    stageTargetE1rmKg: prepared.input.stageTargetE1rmKg,
    trainingExperienceMonths: prepared.input.trainingExperienceMonths,
    trainingFrequencyPerWeek: prepared.input.trainingFrequencyPerWeek,
    stageDurationDays: prepared.input.roadmap.durationDays,
    trainingDays: prepared.promptDays,
    ...(previousFailure === undefined
      ? {}
      : { previousDraftRejected: previousFailure }),
  });
}

/** Parse then atomically validate the full Provider response using Shared Domain rules. */
export function validateGeneratedStageTrainingProgram(
  outputText: string,
  context: {
    readonly roadmap: StageRoadmap;
    readonly trainingDays: readonly StageTrainingDayValidationContext[];
  },
): ValidatedStageTrainingProgram {
  let draft: unknown;
  try {
    draft = JSON.parse(outputText);
  } catch {
    throw new StageTrainingProgramGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'No parseable structured StageTrainingProgramDraft was returned.',
      { category: 'STRUCTURED_OUTPUT', reasons: [{ reasonCode: 'STRUCTURED_OUTPUT_INVALID' }] },
    );
  }

  const validation = validateStageTrainingProgram(draft, context);
  if (!validation.valid) {
    const reasons = createValidationFailureReasons(validation.errors, draft, context.roadmap);
    throw new StageTrainingProgramGenerationError(
      'DOMAIN_VALIDATION_FAILED',
      'StageTrainingProgramDraft failed Shared Domain validation.',
      {
        category: getPrimaryValidationCategory(validation.errors, draft, context.roadmap),
        reasons,
      },
    );
  }
  return validation.program;
}

function classifyProviderFailure(error: unknown): StageTrainingProgramFailureCategory {
  if (error instanceof APIConnectionError) return 'TRANSIENT_PROVIDER';
  if (error instanceof APIError) {
    return error.status === 408 || error.status === 429 ||
      (error.status !== undefined && error.status >= 500)
      ? 'TRANSIENT_PROVIDER'
      : 'NON_RETRYABLE_PROVIDER';
  }
  return 'NON_RETRYABLE_PROVIDER';
}

function isAutomaticallyRetryable(error: StageTrainingProgramGenerationError): boolean {
  return error.details.category === 'STRUCTURED_OUTPUT' ||
    error.details.category === 'SESSION_VALIDATION' ||
    error.details.category === 'MAIN_EXPOSURE' ||
    error.details.category === 'STAGE_COVERAGE' ||
    error.details.category === 'EQUIPMENT_CONSTRAINT' ||
    error.details.category === 'TRANSIENT_PROVIDER';
}

function logStageProgramFailure(
  attempt: number,
  error: StageTrainingProgramGenerationError,
): void {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return;
  const reasonCodes = [...new Set(error.details.reasons?.map((reason) => reason.reasonCode) ?? [error.code])]
    .filter((code) => /^[A-Z0-9_]{1,64}$/.test(code))
    .slice(0, 12)
    .join(',');
  const locations = (error.details.reasons ?? []).slice(0, 8).map((reason) => {
    const day = reason.dayIndex === undefined ? '' : `day=${reason.dayIndex}`;
    const exercise = reason.exerciseId !== undefined && /^[a-z0-9_]{1,80}$/.test(reason.exerciseId)
      ? ` exercise=${reason.exerciseId}`
      : '';
    const path = reason.path !== undefined && /^[A-Za-z0-9_.\[\]=-]{1,160}$/.test(reason.path)
      ? ` path=${reason.path}`
      : '';
    return `${day}${exercise}${path}`.trim();
  }).filter(Boolean).join(';');
  const status = error.details.providerStatus === undefined ? '' : ` provider_status=${error.details.providerStatus}`;
  const locationSummary = locations === '' ? '' : ` locations=${locations}`;
  console.warn(
    `[stage-training-program] attempt=${attempt} failure_category=${error.details.category} reason_codes=${reasonCodes}${status}${locationSummary}`,
  );
}

/**
 * Generate and validate the complete Stage Program. Only a retryable Provider,
 * Structured Output, or Domain failure receives one internal repair attempt.
 * This function performs no cache or Adventure Session mutation.
 */
export async function generateStageTrainingProgram(
  input: StageTrainingProgramGenerationInput,
  client?: OpenAI,
): Promise<ValidatedStageTrainingProgram> {
  const validatedInput = validateGenerationInput(input);
  if (validatedInput === null) {
    throw new StageTrainingProgramGenerationError(
      'INVALID_INPUT',
      'StageTrainingProgramGenerationInput failed validation.',
      { category: 'INPUT_PRECONDITION', reasons: [{ reasonCode: 'INVALID_INPUT' }] },
    );
  }

  let prepared: PreparedStageTrainingProgramGeneration;
  try {
    prepared = prepareStageTrainingProgramGeneration(validatedInput);
  } catch (error) {
    if (error instanceof StageTrainingProgramGenerationError) {
      logStageProgramFailure(0, error);
      throw error;
    }
    const precondition = new StageTrainingProgramGenerationError(
      'INVALID_INPUT',
      'Stage Training Program preflight failed.',
      { category: 'INPUT_PRECONDITION', reasons: [{ reasonCode: 'PREFLIGHT_FAILED' }] },
    );
    logStageProgramFailure(0, precondition);
    throw precondition;
  }

  let selectedClient: OpenAI;
  try {
    selectedClient = client ?? createOpenAIClient();
  } catch {
    const providerFailure = new StageTrainingProgramGenerationError(
      'OPENAI_API_ERROR',
      'OpenAI client is unavailable.',
      { category: 'NON_RETRYABLE_PROVIDER', reasons: [{ reasonCode: 'PROVIDER_CONFIGURATION' }] },
    );
    logStageProgramFailure(0, providerFailure);
    throw providerFailure;
  }

  const allAllowedExerciseIds = getAllowedExerciseUnion(prepared);
  let previousFailure: readonly StageTrainingProgramFailureReason[] | undefined;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await selectedClient.responses.create({
        model: getOpenAIModel(),
        instructions: [
          'Generate one coherent Training Program for every supplied Training Day in this Stage.',
          'Return exactly one session for each supplied dayIndex and do not add Recovery or Boss sessions.',
          'Each Training Day supplies allowedExerciseIds. Select Exercises only from that Day\'s list; never use another Day\'s allowed IDs or invent IDs.',
          'The allowed lists already include compatible no-equipment bodyweight Exercises. Use them when selected equipment is sparse; BODYWEIGHT and equipment-required movements are not interchangeable.',
          'Use weighted equipment options when they are in the allowed list and appropriate; do not default a well-equipped Stage to bodyweight-only sessions.',
          'Every session must contain exactly one exercise with role main; all other exercises use role accessory.',
          'On bossMainExposure days, use requiredMainExerciseId exactly once with role main and do not replace or remove it.',
          'On non-exposure days, do not use the Boss Main; select exactly one allowed focus-compatible candidate as role main.',
          'Respect every sessionFocus and maintain balanced coverage across the whole Stage.',
          'Use only role, sets, and repRange besides exerciseId. Do not prescribe weight, kilograms, RPE, RIR, or any other fields.',
          'Use 1 to 5 sets per exercise, at most 6 exercises and 20 working sets per session.',
          'Use main rep ranges within 1 to 10 and accessory rep ranges within 5 to 20.',
          'Use currentE1rmKg and stageTargetE1rmKg only as progression context; do not alter the Stage target, Roadmap, schedule, quests, EXP, or Boss state.',
          'Keep early sessions manageable and make later sessions coherent with progress toward the Stage target without defining a periodization algorithm.',
          ...(previousFailure === undefined ? [] : [
            'The previous complete Stage draft was rejected. Regenerate the complete Stage Program, not only the failed Session.',
            'Use only supplied allowedExerciseIds and keep all fixed requiredMainExerciseId values unchanged.',
            'Correct these prior validation reasons: ' + JSON.stringify(previousFailure),
          ]),
        ].join(' '),
        input: buildStageTrainingProgramInput(prepared, previousFailure),
        text: {
          format: createStageTrainingProgramDraftFormat(
            allAllowedExerciseIds,
            prepared.promptDays.map((day) => day.dayIndex),
          ),
        },
      });

      if (response.status !== 'completed' || typeof response.output_text !== 'string' || response.output_text.trim() === '') {
        throw new StageTrainingProgramGenerationError(
          'STRUCTURED_OUTPUT_MISSING',
          'The OpenAI response did not contain a completed structured output.',
          { category: 'STRUCTURED_OUTPUT', reasons: [{ reasonCode: 'STRUCTURED_OUTPUT_INCOMPLETE' }], attempt },
        );
      }

      const program = validateGeneratedStageTrainingProgram(response.output_text, {
        roadmap: prepared.input.roadmap,
        trainingDays: prepared.trainingDays,
      });
      if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
        console.info(`[stage-training-program] attempt=${attempt} outcome=success`);
      }
      return program;
    } catch (error) {
      let failure: StageTrainingProgramGenerationError;
      if (error instanceof StageTrainingProgramGenerationError) {
        failure = new StageTrainingProgramGenerationError(error.code, error.message, {
          ...error.details,
          attempt,
        });
      } else {
        const category = classifyProviderFailure(error);
        const providerStatus = error instanceof APIError && typeof error.status === 'number'
          ? error.status
          : undefined;
        failure = new StageTrainingProgramGenerationError(
          'OPENAI_API_ERROR',
          'OpenAI request failed.',
          {
            category,
            attempt,
            ...(providerStatus === undefined ? {} : { providerStatus }),
            reasons: [{ reasonCode: category === 'TRANSIENT_PROVIDER' ? 'PROVIDER_TRANSIENT' : 'PROVIDER_NON_RETRYABLE' }],
          },
        );
      }

      logStageProgramFailure(attempt, failure);
      if (attempt === 1 && isAutomaticallyRetryable(failure)) {
        previousFailure = failure.details.category === 'TRANSIENT_PROVIDER'
          ? undefined
          : failure.details.reasons ?? [{ reasonCode: failure.code }];
        continue;
      }
      throw failure;
    }
  }

  throw new StageTrainingProgramGenerationError(
    'OPENAI_API_ERROR',
    'Stage Training Program generation failed.',
    { category: 'NON_RETRYABLE_PROVIDER', reasons: [{ reasonCode: 'ATTEMPT_LIMIT_REACHED' }], attempt: 2 },
  );
}
