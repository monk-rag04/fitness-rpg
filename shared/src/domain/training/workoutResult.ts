import { getExerciseById } from './exerciseCatalog.js';
import type { ExerciseId } from './exercise.js';
import {
  calculateWorkoutE1rm,
  type WorkoutE1rmResult,
} from './e1rm.js';
import type {
  PlannedExerciseRole,
  RepRange,
  ValidatedPlannedExercise,
} from './trainingPlan.js';

/** One actually completed set. It is intentionally separate from the planned set count. */
export interface CompletedSetRecord {
  readonly setNumber: number;
  readonly weightKg: number;
  readonly reps: number;
}

export type ExerciseDifficultyFeedback = 'too_hard' | 'just_right' | 'easy';

/**
 * A completed exercise result. This is a domain boundary, not a persistence
 * draft and not a Quest Clear result.
 */
export interface ExerciseWorkoutResult {
  readonly plannedExerciseId: ExerciseId;
  readonly performedExerciseId: ExerciseId;
  readonly role: PlannedExerciseRole;
  readonly plannedSets: number;
  readonly plannedRepRange: RepRange;
  readonly completedSets: readonly CompletedSetRecord[];
  /** Optional effort feedback for this exercise result, not an individual Set. */
  readonly difficultyFeedback?: ExerciseDifficultyFeedback;
  /** A parseable timestamp string; persistence's canonical format is still undecided. */
  readonly performedAt: string;
}

export type WorkoutResultValidationErrorCode =
  | 'INVALID_WORKOUT_RESULT_SHAPE'
  | 'INVALID_FIELD'
  | 'PLANNED_EXERCISE_NOT_FOUND'
  | 'PERFORMED_EXERCISE_NOT_FOUND'
  | 'INVALID_ROLE'
  | 'INVALID_PLANNED_SETS'
  | 'INVALID_PLANNED_REP_RANGE'
  | 'INVALID_COMPLETED_SETS'
  | 'EMPTY_COMPLETED_SETS'
  | 'INVALID_SET_NUMBER'
  | 'DUPLICATE_SET_NUMBER'
  | 'INVALID_WEIGHT_KG'
  | 'INVALID_REPS'
  | 'INVALID_DIFFICULTY_FEEDBACK'
  | 'INVALID_PERFORMED_AT';

export interface WorkoutResultValidationError {
  readonly code: WorkoutResultValidationErrorCode;
  readonly path: string;
}

export type WorkoutResultValidationResult =
  | { readonly valid: true; readonly value: ExerciseWorkoutResult }
  | { readonly valid: false; readonly errors: readonly WorkoutResultValidationError[] };

export type WorkoutResultPlanConsistencyErrorCode =
  | 'PLANNED_EXERCISE_MISMATCH'
  | 'ROLE_MISMATCH'
  | 'PLANNED_SETS_MISMATCH'
  | 'PLANNED_REP_RANGE_MISMATCH';

export interface WorkoutResultPlanConsistencyError {
  readonly code: WorkoutResultPlanConsistencyErrorCode;
  readonly path: string;
}

export type WorkoutResultPlanConsistencyResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly WorkoutResultPlanConsistencyError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRole(value: unknown): value is PlannedExerciseRole {
  return value === 'main' || value === 'accessory';
}

function isExerciseDifficultyFeedback(value: unknown): value is ExerciseDifficultyFeedback {
  return value === 'too_hard' || value === 'just_right' || value === 'easy';
}

function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === 'string' && getExerciseById(value) !== undefined;
}

function isRepRange(value: unknown): value is RepRange {
  return isRecord(value) &&
    isPositiveInteger(value.min) &&
    isPositiveInteger(value.max) &&
    value.min <= value.max;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function addUnexpectedFieldErrors(
  value: object,
  allowedFields: readonly string[],
  path: string,
  errors: WorkoutResultValidationError[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedFields.includes(key)) {
      errors.push({ code: 'INVALID_FIELD', path: `${path}.${key}` });
    }
  }
}

/**
 * Validates untrusted completed-exercise input. A result needs at least one
 * completed set; an empty in-progress form is a UI concern, not this domain.
 */
export function validateExerciseWorkoutResult(
  input: unknown,
): WorkoutResultValidationResult {
  if (!isRecord(input)) {
    return {
      valid: false,
      errors: [{ code: 'INVALID_WORKOUT_RESULT_SHAPE', path: 'workoutResult' }],
    };
  }

  const errors: WorkoutResultValidationError[] = [];
  addUnexpectedFieldErrors(
    input,
    [
      'plannedExerciseId',
      'performedExerciseId',
      'role',
      'plannedSets',
      'plannedRepRange',
      'completedSets',
      'difficultyFeedback',
      'performedAt',
    ],
    'workoutResult',
    errors,
  );

  const {
    plannedExerciseId,
    performedExerciseId,
    role,
    plannedSets,
    plannedRepRange,
    completedSets,
    difficultyFeedback,
    performedAt,
  } = input;

  if (!isExerciseId(plannedExerciseId)) {
    errors.push({ code: 'PLANNED_EXERCISE_NOT_FOUND', path: 'plannedExerciseId' });
  }
  if (!isExerciseId(performedExerciseId)) {
    errors.push({ code: 'PERFORMED_EXERCISE_NOT_FOUND', path: 'performedExerciseId' });
  }
  if (!isRole(role)) {
    errors.push({ code: 'INVALID_ROLE', path: 'role' });
  }
  if (!isPositiveInteger(plannedSets)) {
    errors.push({ code: 'INVALID_PLANNED_SETS', path: 'plannedSets' });
  }
  if (isRecord(plannedRepRange)) {
    addUnexpectedFieldErrors(plannedRepRange, ['min', 'max'], 'plannedRepRange', errors);
  }
  if (!isRepRange(plannedRepRange)) {
    errors.push({ code: 'INVALID_PLANNED_REP_RANGE', path: 'plannedRepRange' });
  }
  if (!isTimestamp(performedAt)) {
    errors.push({ code: 'INVALID_PERFORMED_AT', path: 'performedAt' });
  }
  if (difficultyFeedback !== undefined && !isExerciseDifficultyFeedback(difficultyFeedback)) {
    errors.push({ code: 'INVALID_DIFFICULTY_FEEDBACK', path: 'difficultyFeedback' });
  }

  const validatedSets: CompletedSetRecord[] = [];
  if (!Array.isArray(completedSets)) {
    errors.push({ code: 'INVALID_COMPLETED_SETS', path: 'completedSets' });
  } else if (completedSets.length === 0) {
    errors.push({ code: 'EMPTY_COMPLETED_SETS', path: 'completedSets' });
  } else {
    const seenSetNumbers = new Set<number>();
    for (const [index, value] of completedSets.entries()) {
      const path = `completedSets[${index}]`;
      if (!isRecord(value)) {
        errors.push({ code: 'INVALID_COMPLETED_SETS', path });
        continue;
      }

      addUnexpectedFieldErrors(value, ['setNumber', 'weightKg', 'reps'], path, errors);
      const { setNumber, weightKg, reps } = value;
      if (!isPositiveInteger(setNumber)) {
        errors.push({ code: 'INVALID_SET_NUMBER', path: `${path}.setNumber` });
      } else if (seenSetNumbers.has(setNumber)) {
        errors.push({ code: 'DUPLICATE_SET_NUMBER', path: `${path}.setNumber` });
      } else {
        seenSetNumbers.add(setNumber);
      }
      if (!isPositiveFiniteNumber(weightKg)) {
        errors.push({ code: 'INVALID_WEIGHT_KG', path: `${path}.weightKg` });
      }
      if (!isPositiveInteger(reps)) {
        errors.push({ code: 'INVALID_REPS', path: `${path}.reps` });
      }
      if (isPositiveInteger(setNumber) && isPositiveFiniteNumber(weightKg) && isPositiveInteger(reps)) {
        validatedSets.push({ setNumber, weightKg, reps });
      }
    }
  }

  if (
    errors.length > 0 ||
    !isExerciseId(plannedExerciseId) ||
    !isExerciseId(performedExerciseId) ||
    !isRole(role) ||
    !isPositiveInteger(plannedSets) ||
    !isRepRange(plannedRepRange) ||
    (difficultyFeedback !== undefined && !isExerciseDifficultyFeedback(difficultyFeedback)) ||
    !isTimestamp(performedAt)
  ) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      plannedExerciseId,
      performedExerciseId,
      role,
      plannedSets,
      plannedRepRange: { min: plannedRepRange.min, max: plannedRepRange.max },
      completedSets: validatedSets.sort((a, b) => a.setNumber - b.setNumber),
      ...(difficultyFeedback === undefined ? {} : { difficultyFeedback }),
      performedAt,
    },
  };
}

/**
 * Verifies only the immutable plan snapshot. Actual reps and weights are not
 * plan-validation conditions and remain available for later progression rules.
 */
export function validateWorkoutResultAgainstPlan(
  result: ExerciseWorkoutResult,
  plannedExercise: ValidatedPlannedExercise,
): WorkoutResultPlanConsistencyResult {
  const errors: WorkoutResultPlanConsistencyError[] = [];
  if (result.plannedExerciseId !== plannedExercise.exerciseId) {
    errors.push({ code: 'PLANNED_EXERCISE_MISMATCH', path: 'plannedExerciseId' });
  }
  if (result.role !== plannedExercise.role) {
    errors.push({ code: 'ROLE_MISMATCH', path: 'role' });
  }
  if (result.plannedSets !== plannedExercise.sets) {
    errors.push({ code: 'PLANNED_SETS_MISMATCH', path: 'plannedSets' });
  }
  if (
    result.plannedRepRange.min !== plannedExercise.repRange.min ||
    result.plannedRepRange.max !== plannedExercise.repRange.max
  ) {
    errors.push({ code: 'PLANNED_REP_RANGE_MISMATCH', path: 'plannedRepRange' });
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Uses D-023 unchanged; substitution results are attributed to the performed exercise. */
export function calculateWorkoutResultE1rm(
  result: ExerciseWorkoutResult,
): WorkoutE1rmResult {
  return calculateWorkoutE1rm(
    result.performedExerciseId,
    new Date(result.performedAt),
    result.completedSets.map(({ weightKg, reps }) => ({ weightKg, reps })),
  );
}
