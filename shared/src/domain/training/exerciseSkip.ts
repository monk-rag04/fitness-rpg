import { getExerciseById } from './exerciseCatalog.js';
import type { ExerciseId } from './exercise.js';

export const EXERCISE_SKIP_REASONS = [
  'equipment_unavailable',
  'time_constraint',
  'condition',
  'other',
] as const;

export type ExerciseSkipReason = (typeof EXERCISE_SKIP_REASONS)[number];

/** A deliberate, reasoned omission; never a WorkoutResult or performed record. */
export interface ExerciseSkipRecord {
  readonly exerciseId: ExerciseId;
  readonly reason: ExerciseSkipReason;
  readonly pledgeAccepted: true;
}

export type ExerciseSkipValidationResult =
  | { readonly valid: true; readonly value: ExerciseSkipRecord }
  | { readonly valid: false; readonly code: 'INVALID_EXERCISE_SKIP' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateExerciseSkipRecord(input: unknown): ExerciseSkipValidationResult {
  if (!isRecord(input) || Object.keys(input).length !== 3 ||
      !Object.hasOwn(input, 'exerciseId') || !Object.hasOwn(input, 'reason') ||
      !Object.hasOwn(input, 'pledgeAccepted') || typeof input.exerciseId !== 'string' ||
      getExerciseById(input.exerciseId) === undefined ||
      !EXERCISE_SKIP_REASONS.some((reason) => reason === input.reason) || input.pledgeAccepted !== true) {
    return { valid: false, code: 'INVALID_EXERCISE_SKIP' };
  }
  return {
    valid: true,
    value: {
      exerciseId: input.exerciseId as ExerciseId,
      reason: input.reason as ExerciseSkipReason,
      pledgeAccepted: true,
    },
  };
}
