import type { TrainingCandidateResult } from './trainingCandidates.js';
import type { ExerciseId } from './exercise.js';

export const PLANNED_EXERCISE_ROLES = ['main', 'accessory'] as const;

export type PlannedExerciseRole = (typeof PLANNED_EXERCISE_ROLES)[number];

/** D-030 product-owned limits for one on-demand Training Plan. */
export const TRAINING_PLAN_GUARDRAILS = {
  maxExercises: 6,
  minSetsPerExercise: 1,
  maxSetsPerExercise: 5,
  mainRepRange: { min: 1, max: 10 },
  accessoryRepRange: { min: 5, max: 20 },
  maxWorkingSets: 20,
} as const;

export interface RepRange {
  readonly min: number;
  readonly max: number;
}

export interface PlannedExercise {
  readonly exerciseId: string;
  readonly role: PlannedExerciseRole;
  readonly sets: number;
  readonly repRange: RepRange;
}

export interface TrainingPlanDraft {
  readonly exercises: readonly PlannedExercise[];
}

export interface ValidatedTrainingPlan {
  readonly exercises: readonly ValidatedPlannedExercise[];
}

export interface ValidatedPlannedExercise extends PlannedExercise {
  readonly exerciseId: ExerciseId;
}

export type TrainingPlanValidationErrorCode =
  | 'INVALID_PLAN_SHAPE'
  | 'EMPTY_PLAN'
  | 'INVALID_FIELD'
  | 'EXERCISE_NOT_ALLOWED'
  | 'DUPLICATE_EXERCISE'
  | 'MAIN_EXERCISE_MISSING'
  | 'MAIN_EXERCISE_ROLE_INVALID'
  | 'MAIN_ROLE_MISSING'
  | 'MULTIPLE_MAIN_EXERCISES'
  | 'TOO_MANY_EXERCISES'
  | 'TOO_MANY_WORKING_SETS'
  | 'INVALID_SETS'
  | 'INVALID_REP_RANGE'
  | 'INVALID_ROLE';

export interface TrainingPlanValidationError {
  readonly code: TrainingPlanValidationErrorCode;
  readonly path: string;
}

export type TrainingPlanValidationResult =
  | { readonly valid: true; readonly plan: ValidatedTrainingPlan }
  | { readonly valid: false; readonly errors: readonly TrainingPlanValidationError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidSets(value: unknown): value is number {
  return isPositiveInteger(value) &&
    value >= TRAINING_PLAN_GUARDRAILS.minSetsPerExercise &&
    value <= TRAINING_PLAN_GUARDRAILS.maxSetsPerExercise;
}

function isRole(value: unknown): value is PlannedExerciseRole {
  return value === 'main' || value === 'accessory';
}

function isAllowedExerciseId(
  value: unknown,
  allowedIds: ReadonlySet<ExerciseId>,
): value is ExerciseId {
  return typeof value === 'string' && allowedIds.has(value as ExerciseId);
}

function isValidRepRange(value: unknown): value is RepRange {
  return (
    isRecord(value) &&
    isPositiveInteger(value.min) &&
    isPositiveInteger(value.max) &&
    value.min <= value.max
  );
}

function isWithinRoleRepRange(
  repRange: RepRange,
  role: PlannedExerciseRole,
): boolean {
  const allowedRange = role === 'main'
    ? TRAINING_PLAN_GUARDRAILS.mainRepRange
    : TRAINING_PLAN_GUARDRAILS.accessoryRepRange;

  return repRange.min >= allowedRange.min && repRange.max <= allowedRange.max;
}

function addUnexpectedFieldErrors(
  value: Record<string, unknown>,
  allowedFields: readonly string[],
  path: string,
  errors: TrainingPlanValidationError[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedFields.includes(key)) {
      errors.push({ code: 'INVALID_FIELD', path: `${path}.${key}` });
    }
  }
}

/** Validate untrusted planner output against this request's allowed candidates. */
export function validateTrainingPlanDraft(
  draft: unknown,
  candidates: TrainingCandidateResult,
): TrainingPlanValidationResult {
  const errors: TrainingPlanValidationError[] = [];

  if (!isRecord(draft) || !Array.isArray(draft.exercises)) {
    return { valid: false, errors: [{ code: 'INVALID_PLAN_SHAPE', path: 'exercises' }] };
  }

  addUnexpectedFieldErrors(draft, ['exercises'], 'plan', errors);

  if (draft.exercises.length === 0) {
    errors.push({ code: 'EMPTY_PLAN', path: 'exercises' });
  }
  if (draft.exercises.length > TRAINING_PLAN_GUARDRAILS.maxExercises) {
    errors.push({ code: 'TOO_MANY_EXERCISES', path: 'exercises' });
  }

  const allowedIds = new Set<ExerciseId>([
    ...candidates.candidateExercises.map((candidate) => candidate.exerciseId),
    ...(candidates.mainExercise === undefined
      ? []
      : [candidates.mainExercise.exerciseId]),
  ]);
  const seenIds = new Set<string>();
  const validatedExercises: ValidatedPlannedExercise[] = [];
  let mainRoleCount = 0;
  let requiredMainRole: unknown;
  let workingSetCount = 0;
  const bossMainExerciseId = candidates.bossMainExerciseId;
  const bossMainExposure = candidates.bossMainExposure === true;

  if (bossMainExposure &&
      (bossMainExerciseId === undefined || candidates.mainExercise?.exerciseId !== bossMainExerciseId)) {
    errors.push({ code: 'MAIN_EXERCISE_MISSING', path: 'candidates.mainExercise' });
  }

  for (const [index, value] of draft.exercises.entries()) {
    const path = `exercises[${index}]`;

    if (!isRecord(value)) {
      errors.push({ code: 'INVALID_PLAN_SHAPE', path });
      continue;
    }

    addUnexpectedFieldErrors(
      value,
      ['exerciseId', 'role', 'sets', 'repRange'],
      path,
      errors,
    );

    const { exerciseId, role, sets, repRange } = value;

    if (!isAllowedExerciseId(exerciseId, allowedIds) ||
        (!bossMainExposure && exerciseId === bossMainExerciseId)) {
      errors.push({ code: 'EXERCISE_NOT_ALLOWED', path: `${path}.exerciseId` });
    } else if (seenIds.has(exerciseId)) {
      errors.push({ code: 'DUPLICATE_EXERCISE', path: `${path}.exerciseId` });
    }

    if (typeof exerciseId === 'string') {
      seenIds.add(exerciseId);
      if (exerciseId === candidates.mainExercise?.exerciseId) {
        requiredMainRole = role;
      }
    }

    if (!isRole(role)) {
      errors.push({ code: 'INVALID_ROLE', path: `${path}.role` });
    } else if (role === 'main') {
      mainRoleCount += 1;
    }

    if (!isValidSets(sets)) {
      errors.push({ code: 'INVALID_SETS', path: `${path}.sets` });
    } else {
      workingSetCount += sets;
    }

    const validRepRange = isValidRepRange(repRange);

    if (!validRepRange) {
      errors.push({ code: 'INVALID_REP_RANGE', path: `${path}.repRange` });
    } else if (isRole(role) && !isWithinRoleRepRange(repRange, role)) {
      errors.push({ code: 'INVALID_REP_RANGE', path: `${path}.repRange` });
    }

    if (isRecord(repRange)) {
      addUnexpectedFieldErrors(repRange, ['min', 'max'], `${path}.repRange`, errors);
    }

    if (
      isAllowedExerciseId(exerciseId, allowedIds) &&
      isRole(role) &&
      isValidSets(sets) &&
      isValidRepRange(repRange) &&
      isWithinRoleRepRange(repRange, role)
    ) {
      validatedExercises.push({
        exerciseId,
        role,
        sets,
        repRange: { min: repRange.min, max: repRange.max },
      });
    }
  }

  if (mainRoleCount > 1) {
    errors.push({ code: 'MULTIPLE_MAIN_EXERCISES', path: 'exercises' });
  } else if (mainRoleCount === 0) {
    errors.push({ code: 'MAIN_ROLE_MISSING', path: 'exercises' });
  }
  if (workingSetCount > TRAINING_PLAN_GUARDRAILS.maxWorkingSets) {
    errors.push({ code: 'TOO_MANY_WORKING_SETS', path: 'exercises' });
  }

  if (candidates.mainExercise !== undefined) {
    if (!seenIds.has(candidates.mainExercise.exerciseId)) {
      errors.push({ code: 'MAIN_EXERCISE_MISSING', path: 'exercises' });
    } else if (requiredMainRole !== 'main') {
      errors.push({ code: 'MAIN_EXERCISE_ROLE_INVALID', path: 'exercises' });
    }
  }

  return errors.length === 0
    ? { valid: true, plan: { exercises: validatedExercises } }
    : { valid: false, errors };
}
