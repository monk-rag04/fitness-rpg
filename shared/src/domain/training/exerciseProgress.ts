import {
  BODYWEIGHT_EXERCISE_IDS,
  isBodyweightExerciseId,
  type ExerciseId,
} from './exercise.js';
import type { ExerciseSuggestion } from './exerciseProgression.js';
import { getExerciseById } from './exerciseCatalog.js';
import { E1RM_RULE, calculateSetE1rm } from './e1rm.js';
import {
  calculateWorkoutResultE1rm,
  validateExerciseWorkoutResult,
  type ExerciseWorkoutResult,
} from './workoutResult.js';

export type ExerciseBaselineSource = 'onboarding' | 'self_report' | 'workout_result';

export interface ExerciseBaseline {
  readonly weightKg: number;
  readonly reps: number;
  readonly estimatedE1rmKg?: number;
  readonly e1rmRuleVersion?: typeof E1RM_RULE.version;
  readonly source: ExerciseBaselineSource;
  readonly capturedDayIndex: number;
}

export interface ExerciseProgressState {
  readonly exerciseId: ExerciseId;
  readonly baseline?: ExerciseBaseline;
  readonly sessionsCompleted: number;
  readonly nextSuggestion?: ExerciseSuggestion;
  readonly loadStepKg?: number;
}

export type ExerciseProgressById = Readonly<Partial<Record<ExerciseId, ExerciseProgressState>>>;

/** Catalog-backed MVP boundary: these bodyweight exercises do not request kg self-reports. */
export const SELF_REPORT_BASELINE_UNSUPPORTED_EXERCISE_IDS = [
  ...BODYWEIGHT_EXERCISE_IDS,
] as const;

export function canSelfReportExerciseBaseline(exerciseId: string): boolean {
  return getExerciseById(exerciseId) !== undefined && !isBodyweightExerciseId(exerciseId);
}

export function createInitialExerciseProgressState(exerciseId: ExerciseId): ExerciseProgressState {
  return { exerciseId, sessionsCompleted: 0 };
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isDayIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function createBaseline(
  set: { readonly weightKg: number; readonly reps: number },
  source: ExerciseBaselineSource,
  capturedDayIndex: number,
  estimatedE1rmKg?: number,
): ExerciseBaseline {
  return {
    weightKg: set.weightKg,
    reps: set.reps,
    ...(estimatedE1rmKg === undefined
      ? {}
      : { estimatedE1rmKg, e1rmRuleVersion: E1RM_RULE.version }),
    source,
    capturedDayIndex,
  };
}

/** Creates the Boss Main's immutable Stage-start baseline from accepted Onboarding values. */
export function createOnboardingExerciseProgressState(input: {
  readonly exerciseId: string;
  readonly weightKg: unknown;
  readonly reps: unknown;
  readonly capturedDayIndex: unknown;
}): ExerciseProgressState | null {
  if (getExerciseById(input.exerciseId) === undefined ||
      !isPositiveFinite(input.weightKg) ||
      !isPositiveInteger(input.reps) ||
      !isDayIndex(input.capturedDayIndex)) {
    return null;
  }

  let estimatedE1rmKg: number | undefined;
  try {
    const estimate = calculateSetE1rm({ weightKg: input.weightKg, reps: input.reps });
    if (estimate.eligible) estimatedE1rmKg = estimate.estimated1rmKg;
  } catch {
    return null;
  }

  const baseline = createBaseline(
    { weightKg: input.weightKg, reps: input.reps },
    'onboarding',
    input.capturedDayIndex,
    estimatedE1rmKg,
  );
  return {
    exerciseId: input.exerciseId as ExerciseId,
    baseline,
    sessionsCompleted: 0,
  };
}

export type RegisterSelfReportedBaselineResult =
  | { readonly valid: true; readonly exerciseProgressById: ExerciseProgressById; readonly baseline: ExerciseBaseline }
  | {
    readonly valid: false;
    readonly code:
      | 'UNKNOWN_EXERCISE'
      | 'BASELINE_ALREADY_SET'
      | 'SELF_REPORT_NOT_SUPPORTED'
      | 'INVALID_BASELINE_WEIGHT'
      | 'INVALID_BASELINE_REPS'
      | 'INVALID_DAY_INDEX';
  };

/** Records an explicitly entered baseline without incrementing completed sessions or replacing an existing baseline. */
export function registerSelfReportedExerciseBaseline(
  exerciseProgressById: ExerciseProgressById,
  input: {
    readonly exerciseId: string;
    readonly weightKg: unknown;
    readonly reps: unknown;
    readonly capturedDayIndex: unknown;
  },
): RegisterSelfReportedBaselineResult {
  const exercise = getExerciseById(input.exerciseId);
  if (exercise === undefined) return { valid: false, code: 'UNKNOWN_EXERCISE' };

  const current = exerciseProgressById[exercise.id];
  if (current?.baseline !== undefined) return { valid: false, code: 'BASELINE_ALREADY_SET' };
  if (!canSelfReportExerciseBaseline(exercise.id)) {
    return { valid: false, code: 'SELF_REPORT_NOT_SUPPORTED' };
  }
  if (!isPositiveFinite(input.weightKg)) return { valid: false, code: 'INVALID_BASELINE_WEIGHT' };
  if (!isPositiveInteger(input.reps)) return { valid: false, code: 'INVALID_BASELINE_REPS' };
  if (!isDayIndex(input.capturedDayIndex)) return { valid: false, code: 'INVALID_DAY_INDEX' };

  let estimatedE1rmKg: number | undefined;
  try {
    const estimate = calculateSetE1rm({ weightKg: input.weightKg, reps: input.reps });
    if (estimate.eligible) estimatedE1rmKg = estimate.estimated1rmKg;
  } catch {
    return { valid: false, code: 'INVALID_BASELINE_REPS' };
  }

  const baseline = createBaseline(
    { weightKg: input.weightKg, reps: input.reps },
    'self_report',
    input.capturedDayIndex,
    estimatedE1rmKg,
  );
  const progress = current ?? createInitialExerciseProgressState(exercise.id);
  return {
    valid: true,
    baseline,
    exerciseProgressById: {
      ...exerciseProgressById,
      [exercise.id]: { ...progress, baseline },
    },
  };
}

/** Captures an Exercise's first valid performed record; later records never rebase it. */
export function captureFirstWorkoutExerciseBaseline(
  exerciseProgressById: ExerciseProgressById,
  input: unknown,
  capturedDayIndex: unknown,
): ExerciseProgressById {
  if (!isDayIndex(capturedDayIndex)) return exerciseProgressById;
  const validation = validateExerciseWorkoutResult(input);
  if (!validation.valid) return exerciseProgressById;

  const result = validation.value;
  const exerciseId = result.performedExerciseId;
  if (isBodyweightExerciseId(exerciseId)) return exerciseProgressById;
  const current = exerciseProgressById[exerciseId];
  if (current?.baseline !== undefined) return exerciseProgressById;

  let estimatedE1rmKg: number | undefined;
  let sourceSet: ExerciseWorkoutResult['completedSets'][number] | undefined;
  try {
    const estimate = calculateWorkoutResultE1rm(result);
    if (estimate.estimated1rmKg !== null && estimate.sourceSetIndex !== null) {
      estimatedE1rmKg = estimate.estimated1rmKg;
      sourceSet = result.completedSets[estimate.sourceSetIndex];
    }
  } catch {
    return exerciseProgressById;
  }
  sourceSet ??= [...result.completedSets].sort((left, right) => left.setNumber - right.setNumber)[0];
  if (sourceSet === undefined || sourceSet.weightKg === undefined) return exerciseProgressById;

  const baseline = createBaseline(
    { weightKg: sourceSet.weightKg, reps: sourceSet.reps },
    'workout_result',
    capturedDayIndex,
    estimatedE1rmKg,
  );
  const progress = current ?? createInitialExerciseProgressState(exerciseId);
  return {
    ...exerciseProgressById,
    [exerciseId]: { ...progress, baseline },
  };
}

export type IncrementExerciseSessionsResult =
  | { readonly valid: true; readonly exerciseProgressById: ExerciseProgressById }
  | { readonly valid: false; readonly code: 'INVALID_WORKOUT_RESULT' | 'SESSION_COUNT_OVERFLOW' };

/** Increments each actually performed Exercise once for a successfully cleared Training Quest. */
export function incrementExerciseSessionsCompleted(
  exerciseProgressById: ExerciseProgressById,
  workoutResults: readonly unknown[],
): IncrementExerciseSessionsResult {
  const exerciseIds = new Set<ExerciseId>();
  for (const input of workoutResults) {
    const validation = validateExerciseWorkoutResult(input);
    if (!validation.valid) return { valid: false, code: 'INVALID_WORKOUT_RESULT' };
    exerciseIds.add(validation.value.performedExerciseId);
  }

  const next: Partial<Record<ExerciseId, ExerciseProgressState>> = { ...exerciseProgressById };
  for (const exerciseId of exerciseIds) {
    const current = next[exerciseId] ?? createInitialExerciseProgressState(exerciseId);
    if (!Number.isSafeInteger(current.sessionsCompleted) || current.sessionsCompleted < 0 ||
        current.sessionsCompleted === Number.MAX_SAFE_INTEGER) {
      return { valid: false, code: 'SESSION_COUNT_OVERFLOW' };
    }
    next[exerciseId] = { ...current, sessionsCompleted: current.sessionsCompleted + 1 };
  }

  return { valid: true, exerciseProgressById: next };
}
