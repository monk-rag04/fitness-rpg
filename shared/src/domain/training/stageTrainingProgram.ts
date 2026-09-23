import type { StageRoadmap, StageRoadmapDay, StageSessionFocus } from './stageRoadmap.js';
import {
  validateTrainingSessionPlannerInput,
  type TrainingSessionPlannerContext,
} from './trainingSessionPlannerInput.js';
import {
  validateTrainingPlanDraft,
  type TrainingPlanDraft,
  type TrainingPlanValidationErrorCode,
  type ValidatedTrainingPlan,
} from './trainingPlan.js';
import type { TrainingCandidateResult } from './trainingCandidates.js';

/** The untrusted, Stage-wide collection returned by an AI adapter. */
export interface StageTrainingProgramDraft {
  readonly sessions: readonly {
    readonly dayIndex: number;
    readonly plan: TrainingPlanDraft;
  }[];
}

/** A fully validated Stage-wide collection. No partial result is returned. */
export interface ValidatedStageTrainingProgram {
  readonly sessions: readonly {
    readonly dayIndex: number;
    readonly plan: ValidatedTrainingPlan;
  }[];
}

/** Server-built context for validating one canonical Training Day. */
export interface StageTrainingDayValidationContext {
  readonly dayIndex: number;
  readonly sessionFocus: StageSessionFocus;
  readonly bossMainExposure: boolean;
  readonly candidates: TrainingCandidateResult;
}

/** Validation context is built from the canonical StageRoadmap, not a Client DTO. */
export interface StageTrainingProgramValidationContext {
  readonly roadmap: StageRoadmap;
  readonly trainingDays: readonly StageTrainingDayValidationContext[];
}

export interface CanonicalStageTrainingDay {
  readonly dayIndex: number;
  readonly sessionFocus: StageSessionFocus;
  readonly bossMainExposure: boolean;
}

export type StageTrainingProgramValidationErrorCode =
  | 'INVALID_CONTEXT_SHAPE'
  | 'INVALID_CANDIDATE_CONTEXTS'
  | 'INVALID_CANDIDATE_CONTEXT'
  | 'DUPLICATE_CANDIDATE_CONTEXT'
  | 'MISSING_CANDIDATE_CONTEXT'
  | 'NON_TRAINING_CANDIDATE_CONTEXT'
  | 'OUT_OF_RANGE_CANDIDATE_CONTEXT'
  | 'INVALID_PROGRAM_SHAPE'
  | 'INVALID_PROGRAM_FIELD'
  | 'INVALID_SESSION'
  | 'INVALID_DAY_INDEX'
  | 'DUPLICATE_DAY_INDEX'
  | 'MISSING_TRAINING_DAY'
  | 'RECOVERY_DAY_NOT_ALLOWED'
  | 'BOSS_DAY_NOT_ALLOWED'
  | 'OUT_OF_RANGE_DAY_INDEX'
  | 'INVALID_PLAN_FOR_DAY';

export interface StageTrainingProgramValidationError {
  readonly code: StageTrainingProgramValidationErrorCode;
  readonly path: string;
  readonly planErrorCode?: TrainingPlanValidationErrorCode;
}

export type StageTrainingProgramValidationResult =
  | { readonly valid: true; readonly program: ValidatedStageTrainingProgram }
  | { readonly valid: false; readonly errors: readonly StageTrainingProgramValidationError[] };

export type StageTrainingDayContextValidationResult =
  | { readonly valid: true; readonly value: StageTrainingDayValidationContext[] }
  | { readonly valid: false; readonly errors: readonly StageTrainingProgramValidationError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeDayIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function addUnexpectedFieldErrors(
  value: Record<string, unknown>,
  allowedFields: readonly string[],
  path: string,
  errors: StageTrainingProgramValidationError[],
  code: StageTrainingProgramValidationErrorCode,
): void {
  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      errors.push({ code, path: `${path}.${field}` });
    }
  }
}

function copySessionFocus(sessionFocus: StageSessionFocus): StageSessionFocus {
  return {
    targetMuscles: [...sessionFocus.targetMuscles],
    ...(sessionFocus.targetMovementPatterns === undefined
      ? {}
      : { targetMovementPatterns: [...sessionFocus.targetMovementPatterns] }),
  };
}

/** Extract only canonical Training Days. Recovery and the Boss Anchor are excluded. */
export function getCanonicalStageTrainingDays(
  roadmap: StageRoadmap,
): readonly CanonicalStageTrainingDay[] {
  return roadmap.days.flatMap((day: StageRoadmapDay, dayIndex) => {
    if (day.type !== 'training') return [];
    return [{
      dayIndex,
      sessionFocus: copySessionFocus(day.sessionFocus),
      bossMainExposure: day.bossMainExposure,
    }];
  });
}

function isCandidateContextShape(value: unknown): value is StageTrainingDayValidationContext {
  return isRecord(value) &&
    Object.keys(value).every((field) => ['dayIndex', 'sessionFocus', 'bossMainExposure', 'candidates'].includes(field)) &&
    isRecord(value.sessionFocus) &&
    Array.isArray(value.sessionFocus.targetMuscles) &&
    typeof value.bossMainExposure === 'boolean' &&
    isSafeDayIndex(value.dayIndex);
}

function validateCandidateResult(
  candidates: unknown,
  path: string,
  errors: StageTrainingProgramValidationError[],
): candidates is TrainingCandidateResult {
  // Reuse the existing untrusted-candidate validator without duplicating its
  // Catalog shape and duplicate-candidate rules.
  const result = validateTrainingSessionPlannerInput({
    candidates,
    context: {
      trainingExperienceMonths: 0,
      sessionFocus: { targetMuscles: [] },
    } satisfies TrainingSessionPlannerContext,
  });
  if (result.valid) return true;
  errors.push({ code: 'INVALID_CANDIDATE_CONTEXT', path });
  return false;
}

/**
 * Validate that the server-built Candidate Context covers exactly the
 * canonical Training Days. This is deliberately separate from the public HTTP
 * request contract and never accepts Client-supplied candidates.
 */
export function validateStageTrainingDayContexts(
  roadmap: StageRoadmap,
  input: unknown,
): StageTrainingDayContextValidationResult {
  if (!Array.isArray(input)) {
    return {
      valid: false,
      errors: [{ code: 'INVALID_CANDIDATE_CONTEXTS', path: 'trainingDays' }],
    };
  }

  const canonicalDays = getCanonicalStageTrainingDays(roadmap);
  const canonicalIndexes = new Set(canonicalDays.map((day) => day.dayIndex));
  const seen = new Set<number>();
  const errors: StageTrainingProgramValidationError[] = [];
  const values: StageTrainingDayValidationContext[] = [];

  for (const [index, value] of input.entries()) {
    const path = `trainingDays[${index}]`;
    if (!isCandidateContextShape(value)) {
      errors.push({ code: 'INVALID_CANDIDATE_CONTEXT', path });
      continue;
    }

    if (seen.has(value.dayIndex)) {
      errors.push({ code: 'DUPLICATE_CANDIDATE_CONTEXT', path: `${path}.dayIndex` });
      continue;
    }
    seen.add(value.dayIndex);

    if (value.dayIndex >= roadmap.days.length) {
      errors.push({ code: 'OUT_OF_RANGE_CANDIDATE_CONTEXT', path: `${path}.dayIndex` });
      continue;
    }
    if (!canonicalIndexes.has(value.dayIndex)) {
      errors.push({ code: 'NON_TRAINING_CANDIDATE_CONTEXT', path: `${path}.dayIndex` });
      continue;
    }

    if (validateCandidateResult(value.candidates, `${path}.candidates`, errors)) {
       const canonicalDay = canonicalDays.find((day) => day.dayIndex === value.dayIndex);
       if (canonicalDay === undefined ||
           value.bossMainExposure !== canonicalDay.bossMainExposure ||
           JSON.stringify(value.sessionFocus) !== JSON.stringify(canonicalDay.sessionFocus)) {
         errors.push({ code: 'INVALID_CANDIDATE_CONTEXT', path });
       } else {
         values.push({
           dayIndex: value.dayIndex,
           sessionFocus: {
             targetMuscles: [...value.sessionFocus.targetMuscles],
             ...(value.sessionFocus.targetMovementPatterns === undefined
               ? {}
               : { targetMovementPatterns: [...value.sessionFocus.targetMovementPatterns] }),
           },
           bossMainExposure: value.bossMainExposure,
           candidates: value.candidates,
         });
       }
    }
  }

  for (const day of canonicalDays) {
    if (!seen.has(day.dayIndex)) {
      errors.push({
        code: 'MISSING_CANDIDATE_CONTEXT',
        path: `trainingDays[${day.dayIndex}]`,
      });
    }
  }

  return errors.length === 0
    ? {
      valid: true,
      value: [...values].sort((left, right) => left.dayIndex - right.dayIndex),
    }
    : { valid: false, errors };
}

function validateProgramContext(
  input: unknown,
): input is StageTrainingProgramValidationContext {
  return isRecord(input) &&
    Object.keys(input).every((field) => ['roadmap', 'trainingDays'].includes(field)) &&
    isStageRoadmapShape(input.roadmap) &&
    Array.isArray(input.trainingDays);
}

function isStageRoadmapShape(value: unknown): value is StageRoadmap {
  if (!isRecord(value) || !Array.isArray(value.days)) return false;
  return value.days.every((day) => {
    if (!isRecord(day) || (day.type !== 'training' && day.type !== 'recovery')) return false;
    if (day.type === 'recovery') return typeof day.date === 'string';
    return typeof day.date === 'string' &&
      typeof day.bossMainExposure === 'boolean' &&
      isRecord(day.sessionFocus) &&
      Array.isArray(day.sessionFocus.targetMuscles);
  });
}

function validateDayIndex(
  roadmap: StageRoadmap,
  dayIndex: unknown,
  path: string,
  errors: StageTrainingProgramValidationError[],
): dayIndex is number {
  if (!isSafeDayIndex(dayIndex)) {
    errors.push({ code: 'INVALID_DAY_INDEX', path });
    return false;
  }
  if (dayIndex === roadmap.days.length) {
    errors.push({ code: 'BOSS_DAY_NOT_ALLOWED', path });
    return false;
  }
  if (dayIndex > roadmap.days.length) {
    errors.push({ code: 'OUT_OF_RANGE_DAY_INDEX', path });
    return false;
  }
  if (roadmap.days[dayIndex].type !== 'training') {
    errors.push({ code: 'RECOVERY_DAY_NOT_ALLOWED', path });
    return false;
  }
  return true;
}

function validateProgramShape(
  draft: unknown,
  errors: StageTrainingProgramValidationError[],
): draft is StageTrainingProgramDraft {
  if (!isRecord(draft) || !Array.isArray(draft.sessions)) {
    errors.push({ code: 'INVALID_PROGRAM_SHAPE', path: 'program.sessions' });
    return false;
  }
  addUnexpectedFieldErrors(draft, ['sessions'], 'program', errors, 'INVALID_PROGRAM_FIELD');
  return true;
}

/**
 * Validate a complete Stage Program against a canonical roadmap and the
 * matching server-built candidate context for every Training Day.
 *
 * The function is pure: it never mutates the draft, roadmap, or contexts and
 * never returns partially validated sessions.
 */
export function validateStageTrainingProgram(
  draft: unknown,
  context: unknown,
): StageTrainingProgramValidationResult {
  const errors: StageTrainingProgramValidationError[] = [];
  if (!validateProgramContext(context)) {
    return { valid: false, errors: [{ code: 'INVALID_CONTEXT_SHAPE', path: 'context' }] };
  }

  const contextValidation = validateStageTrainingDayContexts(
    context.roadmap,
    context.trainingDays,
  );
  if (!contextValidation.valid) {
    return { valid: false, errors: contextValidation.errors };
  }

  if (!validateProgramShape(draft, errors)) {
    return { valid: false, errors };
  }

  const candidatesByDay = new Map(
    contextValidation.value.map((day) => [day.dayIndex, day.candidates]),
  );
  const canonicalTrainingIndexes = new Set(
    getCanonicalStageTrainingDays(context.roadmap).map((day) => day.dayIndex),
  );
  const seen = new Set<number>();
  const validatedSessions: { dayIndex: number; plan: ValidatedTrainingPlan }[] = [];

  for (const [index, value] of draft.sessions.entries()) {
    const path = `program.sessions[${index}]`;
    if (!isRecord(value) || !Object.keys(value).every((field) => ['dayIndex', 'plan'].includes(field))) {
      errors.push({ code: 'INVALID_SESSION', path });
      continue;
    }
    if (!Object.hasOwn(value, 'dayIndex') || !Object.hasOwn(value, 'plan')) {
      errors.push({ code: 'INVALID_SESSION', path });
      continue;
    }

    const dayIndex = value.dayIndex;
    if (!validateDayIndex(context.roadmap, dayIndex, `${path}.dayIndex`, errors)) continue;
    if (!canonicalTrainingIndexes.has(dayIndex)) {
      errors.push({ code: 'OUT_OF_RANGE_DAY_INDEX', path: `${path}.dayIndex` });
      continue;
    }
    if (seen.has(dayIndex)) {
      errors.push({ code: 'DUPLICATE_DAY_INDEX', path: `${path}.dayIndex` });
      continue;
    }
    seen.add(dayIndex);

    const candidates = candidatesByDay.get(dayIndex);
    if (candidates === undefined) {
      errors.push({ code: 'MISSING_CANDIDATE_CONTEXT', path: `${path}.dayIndex` });
      continue;
    }

    const planValidation = validateTrainingPlanDraft(value.plan, candidates);
    if (!planValidation.valid) {
      for (const planError of planValidation.errors) {
        errors.push({
          code: 'INVALID_PLAN_FOR_DAY',
          path: `${path}.plan.${planError.path}`,
          planErrorCode: planError.code,
        });
      }
      continue;
    }
    validatedSessions.push({ dayIndex, plan: planValidation.plan });
  }

  for (const dayIndex of canonicalTrainingIndexes) {
    if (!seen.has(dayIndex)) {
      errors.push({
        code: 'MISSING_TRAINING_DAY',
        path: `program.sessions[dayIndex=${dayIndex}]`,
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    program: {
      sessions: [...validatedSessions].sort((left, right) => left.dayIndex - right.dayIndex),
    },
  };
}
