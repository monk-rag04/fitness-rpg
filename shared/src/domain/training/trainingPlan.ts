import type { TrainingCandidateResult } from './trainingCandidates.js';
import type { ExerciseId } from './exercise.js';

export const PLANNED_EXERCISE_ROLES = ['main', 'accessory'] as const;

export type PlannedExerciseRole = (typeof PLANNED_EXERCISE_ROLES)[number];

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
  | 'MULTIPLE_MAIN_EXERCISES'
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

    if (!isAllowedExerciseId(exerciseId, allowedIds)) {
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

    if (!isPositiveInteger(sets)) {
      errors.push({ code: 'INVALID_SETS', path: `${path}.sets` });
    }

    const validRepRange = isValidRepRange(repRange);

    if (!validRepRange) {
      errors.push({ code: 'INVALID_REP_RANGE', path: `${path}.repRange` });
    }

    if (isRecord(repRange)) {
      addUnexpectedFieldErrors(repRange, ['min', 'max'], `${path}.repRange`, errors);
    }

    if (
      isAllowedExerciseId(exerciseId, allowedIds) &&
      isRole(role) &&
      isPositiveInteger(sets) &&
      isValidRepRange(repRange)
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
