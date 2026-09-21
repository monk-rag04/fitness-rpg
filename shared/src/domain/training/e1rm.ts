import type { ExerciseId } from './exercise.js';

/** D-023 MVP rule. Persist this version with any derived strength result. */
export const E1RM_RULE = {
  version: 'epley-v1',
  minEligibleReps: 1,
  maxEligibleReps: 10,
  currentWindowDays: 30,
  epleyRepDivisor: 30,
} as const;

const CURRENT_WINDOW_MS = E1RM_RULE.currentWindowDays * 24 * 60 * 60 * 1000;

/** This is Boss scope, not a restriction on the exercise-independent formula. */
export const BOSS_E1RM_EXERCISE_IDS = [
  'barbell_bench_press',
  'barbell_back_squat',
  'barbell_deadlift',
  'barbell_overhead_press',
] as const satisfies readonly ExerciseId[];

export function isBossE1rmExerciseId(exerciseId: string): boolean {
  return BOSS_E1RM_EXERCISE_IDS.some((id) => id === exerciseId);
}

export interface StrengthSetInput {
  readonly weightKg: number;
  readonly reps: number;
}

export type E1rmValidationErrorCode =
  | 'INVALID_WEIGHT_KG'
  | 'INVALID_REPS'
  | 'INVALID_ESTIMATE'
  | 'INVALID_TIMESTAMP'
  | 'UNSUPPORTED_RULE_VERSION';

export class E1rmValidationError extends Error {
  public readonly name = 'E1rmValidationError';

  public constructor(public readonly code: E1rmValidationErrorCode) {
    super(`Invalid e1RM input: ${code}`);
  }
}

export type SetE1rmResult =
  | { readonly eligible: true; readonly estimated1rmKg: number; readonly ruleVersion: typeof E1RM_RULE.version }
  | { readonly eligible: false; readonly estimated1rmKg: null; readonly ruleVersion: typeof E1RM_RULE.version };

/** A valid high-rep set is a workout record, but not an e1RM source. */
export function calculateSetE1rm(input: StrengthSetInput): SetE1rmResult {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new E1rmValidationError('INVALID_WEIGHT_KG');
  }
  if (!Number.isSafeInteger(input.reps) || input.reps < E1RM_RULE.minEligibleReps) {
    throw new E1rmValidationError('INVALID_REPS');
  }
  if (input.reps > E1RM_RULE.maxEligibleReps) {
    return { eligible: false, estimated1rmKg: null, ruleVersion: E1RM_RULE.version };
  }

  const estimated1rmKg = input.reps === E1RM_RULE.minEligibleReps
    ? input.weightKg
    : input.weightKg * (1 + input.reps / E1RM_RULE.epleyRepDivisor);
  if (!Number.isFinite(estimated1rmKg)) {
    throw new E1rmValidationError('INVALID_ESTIMATE');
  }
  return { eligible: true, estimated1rmKg, ruleVersion: E1RM_RULE.version };
}

export interface WorkoutE1rmResult {
  readonly exerciseId: ExerciseId;
  readonly performedAt: Date;
  readonly estimated1rmKg: number | null;
  readonly sourceSetIndex: number | null;
  readonly ruleVersion: typeof E1RM_RULE.version;
}

function timestamp(date: Date): number {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new E1rmValidationError('INVALID_TIMESTAMP');
  }
  return date.getTime();
}

/** All valid sets are considered; warmup classification is not part of MVP. */
export function calculateWorkoutE1rm(
  exerciseId: ExerciseId,
  performedAt: Date,
  sets: readonly StrengthSetInput[],
): WorkoutE1rmResult {
  timestamp(performedAt);
  let estimated1rmKg: number | null = null;
  let sourceSetIndex: number | null = null;

  for (const [index, set] of sets.entries()) {
    const result = calculateSetE1rm(set);
    if (result.eligible && (estimated1rmKg === null || result.estimated1rmKg > estimated1rmKg)) {
      estimated1rmKg = result.estimated1rmKg;
      sourceSetIndex = index;
    }
  }

  return {
    exerciseId,
    performedAt: new Date(performedAt.getTime()),
    estimated1rmKg,
    sourceSetIndex,
    ruleVersion: E1RM_RULE.version,
  };
}

/** Max eligible workout within the inclusive rolling 30 x 24-hour window. */
export function getCurrentE1rm(
  exerciseId: ExerciseId,
  workouts: readonly WorkoutE1rmResult[],
  asOf: Date,
): WorkoutE1rmResult | null {
  const asOfMs = timestamp(asOf);
  return maxWorkoutE1rm(
    exerciseId,
    workouts,
    (workoutMs) => workoutMs >= asOfMs - CURRENT_WINDOW_MS && workoutMs <= asOfMs,
  );
}

/** Historical PB is independent of the current rolling window. */
export function getHistoricalBestE1rm(
  exerciseId: ExerciseId,
  workouts: readonly WorkoutE1rmResult[],
): WorkoutE1rmResult | null {
  return maxWorkoutE1rm(exerciseId, workouts, () => true);
}

function maxWorkoutE1rm(
  exerciseId: ExerciseId,
  workouts: readonly WorkoutE1rmResult[],
  isInWindow: (workoutMs: number) => boolean,
): WorkoutE1rmResult | null {
  let best: WorkoutE1rmResult | null = null;
  for (const workout of workouts) {
    const workoutMs = timestamp(workout.performedAt);
    if (workout.exerciseId !== exerciseId || !isInWindow(workoutMs)) {
      continue;
    }
    if (workout.ruleVersion !== E1RM_RULE.version) {
      throw new E1rmValidationError('UNSUPPORTED_RULE_VERSION');
    }
    if (workout.estimated1rmKg === null) {
      continue;
    }
    if (!Number.isFinite(workout.estimated1rmKg) || workout.estimated1rmKg <= 0) {
      throw new E1rmValidationError('INVALID_ESTIMATE');
    }
    if (best === null || workout.estimated1rmKg > best.estimated1rmKg!) {
      best = workout;
    }
  }
  return best;
}
