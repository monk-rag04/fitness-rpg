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

import { createOpenAIClient, getOpenAIModel } from './client.js';
import { stageTrainingProgramDraftFormat } from './stageTrainingProgramSchema.js';

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
  | 'OPENAI_API_ERROR'
  | 'STRUCTURED_OUTPUT_MISSING'
  | 'DOMAIN_VALIDATION_FAILED';

export class StageTrainingProgramGenerationError extends Error {
  public constructor(
    public readonly code: StageTrainingProgramGenerationErrorCode,
    message: string,
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
  readonly candidateExerciseIds: readonly ExerciseId[];
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

function candidateExerciseIds(candidates: TrainingCandidateResult): readonly ExerciseId[] {
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
        );
      }
      throw new StageTrainingProgramGenerationError(
        'INVALID_INPUT',
        'Stage Training Program input could not build Training Day candidates.',
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
      candidateExerciseIds: candidateExerciseIds(plannerInput.value.candidates),
    });
  }

  return { input, trainingDays, promptDays };
}

/** Build the bounded context passed to the single Stage-wide Responses call. */
export function buildStageTrainingProgramInput(
  prepared: PreparedStageTrainingProgramGeneration,
): string {
  return JSON.stringify({
    bossMainExerciseId: prepared.input.mainExerciseId,
    currentE1rmKg: prepared.input.currentE1rmKg,
    stageTargetE1rmKg: prepared.input.stageTargetE1rmKg,
    trainingExperienceMonths: prepared.input.trainingExperienceMonths,
    trainingFrequencyPerWeek: prepared.input.trainingFrequencyPerWeek,
    stageDurationDays: prepared.input.roadmap.durationDays,
    equipmentIds: prepared.input.equipmentProfile.availableEquipmentIds,
    trainingDays: prepared.promptDays,
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
    );
  }

  const validation = validateStageTrainingProgram(draft, context);
  if (!validation.valid) {
    throw new StageTrainingProgramGenerationError(
      'DOMAIN_VALIDATION_FAILED',
      'StageTrainingProgramDraft failed Shared Domain validation.',
    );
  }
  return validation.program;
}

/**
 * Generate one complete Stage Training Program with exactly one Responses API
 * operation. It performs no cache or Adventure Session mutation.
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
    );
  }

  const prepared = prepareStageTrainingProgramGeneration(validatedInput);
  let response: Awaited<ReturnType<OpenAI['responses']['create']>>;
  try {
    const selectedClient = client ?? createOpenAIClient();
    response = await selectedClient.responses.create({
      model: getOpenAIModel(),
      instructions: [
        'Generate one coherent Training Program for every supplied Training Day in this Stage.',
        'Return exactly one session for each supplied dayIndex and do not add Recovery or Boss sessions.',
        'Use each day sessionFocus and its candidateExerciseIds; never invent exercise IDs.',
        'Every session must contain exactly one exercise with role main; all other exercises use role accessory.',
        'On bossMainExposure days, include the required Boss Main exactly once with role main.',
        'On non-exposure days, do not use the Boss Main; select one allowed focus-compatible candidate as role main.',
        'Respect every sessionFocus and maintain balanced coverage across the whole Stage.',
        'Use only role, sets, and repRange besides exerciseId. Do not prescribe weight, kilograms, RPE, RIR, or any other fields.',
        'Use 1 to 5 sets per exercise, at most 6 exercises and 20 working sets per session.',
        'Use main rep ranges within 1 to 10 and accessory rep ranges within 5 to 20.',
        'Use currentE1rmKg and stageTargetE1rmKg only as progression context; do not alter the Stage target, Roadmap, schedule, quests, EXP, or Boss state.',
        'Keep early sessions manageable and make later sessions coherent with progress toward the Stage target without defining a periodization algorithm.',
      ].join(' '),
      input: buildStageTrainingProgramInput(prepared),
      text: { format: stageTrainingProgramDraftFormat },
    });
  } catch {
    // Do not retain SDK errors: they can include request details or provider content.
    throw new StageTrainingProgramGenerationError('OPENAI_API_ERROR', 'OpenAI request failed.');
  }

  if (response.status !== 'completed' || typeof response.output_text !== 'string' || response.output_text.trim() === '') {
    throw new StageTrainingProgramGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'The OpenAI response did not contain a completed structured output.',
    );
  }

  return validateGeneratedStageTrainingProgram(response.output_text, {
    roadmap: prepared.input.roadmap,
    trainingDays: prepared.trainingDays,
  });
}
