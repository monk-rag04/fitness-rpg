import { getExerciseById } from './exerciseCatalog.js';
import {
  isBodyweightExerciseId,
  type ExerciseId,
} from './exercise.js';
import type { ExerciseProgressState } from './exerciseProgress.js';
import type { RepRange, ValidatedPlannedExercise } from './trainingPlan.js';
import {
  validateExerciseWorkoutResult,
  validateWorkoutResultAgainstPlan,
} from './workoutResult.js';

export const EXERCISE_PROGRESSION_RULE_VERSION = 'exercise-progression-v1' as const;

export type ExerciseSuggestionStatus = 'active' | 'weight_up_ready';

export interface ExerciseSuggestion {
  readonly weightKg?: number;
  readonly targetReps: number;
  readonly repRange: RepRange;
  readonly status: ExerciseSuggestionStatus;
  readonly ruleVersion: typeof EXERCISE_PROGRESSION_RULE_VERSION;
}

export type ExerciseLoadStepStatus =
  | 'applied'
  | 'already_applied'
  | 'unknown_exercise'
  | 'bodyweight_not_supported'
  | 'suggestion_not_ready'
  | 'invalid_load_step'
  | 'invalid_rep_range'
  | 'invalid_weight';

export type ApplyExerciseLoadStepResult =
  | { readonly valid: true; readonly status: 'applied'; readonly exerciseProgress: ExerciseProgressState }
  | { readonly valid: false; readonly status: Exclude<ExerciseLoadStepStatus, 'applied'> };

export interface ExerciseProgressionInput {
  readonly exerciseProgress: ExerciseProgressState | undefined;
  readonly plannedExercise: ValidatedPlannedExercise;
  readonly workoutResult: unknown;
  readonly currentDayIndex: number;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isValidRepRange(value: unknown): value is RepRange {
  return typeof value === 'object' && value !== null &&
    'min' in value && 'max' in value &&
    isPositiveInteger(value.min) && isPositiveInteger(value.max) && value.min <= value.max;
}

function clampReps(targetReps: number, repRange: RepRange): number {
  return Math.min(Math.max(targetReps, repRange.min), repRange.max);
}

function activeSuggestion(
  repRange: RepRange,
  targetReps: number,
  weightKg?: number,
): ExerciseSuggestion {
  return {
    ...(weightKg === undefined ? {} : { weightKg }),
    targetReps: clampReps(targetReps, repRange),
    repRange: { min: repRange.min, max: repRange.max },
    status: 'active',
    ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
  };
}

function validStoredSuggestion(
  suggestion: ExerciseSuggestion | undefined,
  repRange: RepRange,
  bodyweight: boolean,
): suggestion is ExerciseSuggestion {
  if (suggestion === undefined || suggestion.ruleVersion !== EXERCISE_PROGRESSION_RULE_VERSION ||
      !isPositiveInteger(suggestion.targetReps) || !isValidRepRange(suggestion.repRange) ||
      (suggestion.status !== 'active' && suggestion.status !== 'weight_up_ready')) {
    return false;
  }
  if (!bodyweight && suggestion.weightKg !== undefined && !isPositiveFinite(suggestion.weightKg)) {
    return false;
  }
  if (bodyweight && suggestion.weightKg !== undefined) return false;
  if (suggestion.status === 'weight_up_ready' && (bodyweight || suggestion.weightKg === undefined)) {
    return false;
  }
  return suggestion.repRange.min > 0 && suggestion.repRange.max >= suggestion.repRange.min &&
    repRange.min > 0 && repRange.max >= repRange.min;
}

/** Resolves only a safe hint; it never writes values into actual Workout Result input. */
export function resolveExerciseSuggestion(
  exerciseProgress: ExerciseProgressState | undefined,
  exerciseId: ExerciseId,
  repRange: RepRange,
  currentDayIndex?: number,
): ExerciseSuggestion {
  const bodyweight = isBodyweightExerciseId(exerciseId);
  const progress = exerciseProgress?.exerciseId === exerciseId ? exerciseProgress : undefined;
  const stored = progress?.nextSuggestion;

  if (validStoredSuggestion(stored, repRange, bodyweight)) {
    return {
      ...(bodyweight || stored.weightKg === undefined ? {} : { weightKg: stored.weightKg }),
      targetReps: clampReps(stored.targetReps, repRange),
      repRange: { min: repRange.min, max: repRange.max },
      status: bodyweight ? 'active' : stored.status,
      ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
    };
  }

  const sameDayFirstResultBaseline = progress?.nextSuggestion === undefined &&
    progress?.baseline?.source === 'workout_result' &&
    currentDayIndex !== undefined && progress.baseline.capturedDayIndex === currentDayIndex;
  const baseline = sameDayFirstResultBaseline ? undefined : progress?.baseline;
  const weightKg = !bodyweight && baseline !== undefined &&
      isPositiveFinite(baseline.weightKg) && baseline.reps >= repRange.min && baseline.reps <= repRange.max
    ? baseline.weightKg
    : undefined;
  return activeSuggestion(repRange, repRange.min, weightKg);
}

function allPlannedSetsPresent(
  completedSets: readonly { readonly setNumber: number; readonly reps: number; readonly weightKg?: number }[],
  plannedSets: number,
) {
  const bySetNumber = new Map(completedSets.map((set) => [set.setNumber, set]));
  const sets = Array.from({ length: plannedSets }, (_, index) => bySetNumber.get(index + 1));
  return sets.every((set) => set !== undefined) ? sets : null;
}

function normalizedKg(value: number): number {
  const rounded = Number(value.toFixed(6));
  return Number.isFinite(rounded) && rounded > 0 ? rounded : value;
}

/**
 * Evaluates at most one deterministic progression action from the final saved
 * Result. The caller invokes it only inside a successful Training Quest Clear.
 */
export function evaluateExerciseProgression(
  input: ExerciseProgressionInput,
): ExerciseSuggestion {
  const { exerciseProgress, plannedExercise, workoutResult, currentDayIndex } = input;
  const validation = validateExerciseWorkoutResult(workoutResult);
  if (!validation.valid || !Number.isSafeInteger(currentDayIndex) || currentDayIndex < 0 ||
      validation.value.plannedExerciseId !== plannedExercise.exerciseId ||
      !validateWorkoutResultAgainstPlan(validation.value, plannedExercise).valid) {
    return resolveExerciseSuggestion(
      exerciseProgress,
      plannedExercise.exerciseId,
      plannedExercise.repRange,
      currentDayIndex,
    );
  }

  const result = validation.value;
  const exerciseId = result.performedExerciseId;
  const bodyweight = isBodyweightExerciseId(exerciseId);
  const currentProgress = exerciseProgress?.exerciseId === exerciseId ? exerciseProgress : undefined;
  const current = resolveExerciseSuggestion(
    currentProgress,
    exerciseId,
    plannedExercise.repRange,
    currentDayIndex,
  );
  const plannedSets = allPlannedSetsPresent(result.completedSets, plannedExercise.sets);
  if (plannedSets === null || result.difficultyFeedback === 'too_hard') return current;

  let weightReference = current.weightKg;
  if (!bodyweight && weightReference === undefined) {
    const actualWeights = plannedSets.map((set) => set?.weightKg);
    if (actualWeights.some((weight) => !isPositiveFinite(weight))) return current;
    weightReference = Math.min(...actualWeights as number[]);
  }

  const targetReached = plannedSets.every((set) => set !== undefined && set.reps >= current.targetReps);
  const weightReached = bodyweight || (weightReference !== undefined && plannedSets.every(
    (set) => set !== undefined && set.weightKg !== undefined && set.weightKg >= weightReference!,
  ));
  if (!targetReached || !weightReached) {
    return activeSuggestion(plannedExercise.repRange, current.targetReps, weightReference);
  }

  const maxReached = plannedSets.every((set) => set !== undefined && set.reps >= plannedExercise.repRange.max);
  if (!maxReached) {
    return activeSuggestion(
      plannedExercise.repRange,
      Math.min(current.targetReps + 1, plannedExercise.repRange.max),
      weightReference,
    );
  }

  if (bodyweight) {
    return activeSuggestion(plannedExercise.repRange, plannedExercise.repRange.max);
  }

  if (exerciseProgress?.loadStepKg !== undefined && isPositiveFinite(exerciseProgress.loadStepKg) &&
      weightReference !== undefined) {
    const nextWeight = normalizedKg(weightReference + exerciseProgress.loadStepKg);
    if (!isPositiveFinite(nextWeight)) return current;
    return activeSuggestion(plannedExercise.repRange, plannedExercise.repRange.min, nextWeight);
  }

  return {
    ...(weightReference === undefined ? {} : { weightKg: weightReference }),
    targetReps: plannedExercise.repRange.max,
    repRange: { ...plannedExercise.repRange },
    status: 'weight_up_ready',
    ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
  };
}

/** Stores a user-selected increment and consumes one pending weight-up exactly once. */
export function applyExerciseLoadStep(input: {
  readonly exerciseProgress: ExerciseProgressState | undefined;
  readonly exerciseId: string;
  readonly loadStepKg: unknown;
  readonly repRange: RepRange;
}): ApplyExerciseLoadStepResult {
  if (getExerciseById(input.exerciseId) === undefined) return { valid: false, status: 'unknown_exercise' };
  if (isBodyweightExerciseId(input.exerciseId)) return { valid: false, status: 'bodyweight_not_supported' };
  if (!isPositiveFinite(input.loadStepKg)) return { valid: false, status: 'invalid_load_step' };
  if (!isValidRepRange(input.repRange)) return { valid: false, status: 'invalid_rep_range' };
  if (input.exerciseProgress?.exerciseId !== input.exerciseId) {
    return { valid: false, status: 'suggestion_not_ready' };
  }
  const progress = input.exerciseProgress;
  if (progress.nextSuggestion?.status !== 'weight_up_ready') {
    return {
      valid: false,
      status: progress.nextSuggestion?.status === 'active' && progress.loadStepKg !== undefined
        ? 'already_applied'
        : 'suggestion_not_ready',
    };
  }
  const suggestion = resolveExerciseSuggestion(progress, progress.exerciseId, input.repRange);
  if (suggestion.status !== 'weight_up_ready' || suggestion.weightKg === undefined) {
    return { valid: false, status: 'suggestion_not_ready' };
  }
  const loadStepKg = normalizedKg(input.loadStepKg);
  const nextWeight = normalizedKg(suggestion.weightKg + loadStepKg);
  if (!isPositiveFinite(loadStepKg) || !isPositiveFinite(nextWeight)) {
    return { valid: false, status: 'invalid_weight' };
  }

  return {
    valid: true,
    status: 'applied',
    exerciseProgress: {
      ...progress,
      loadStepKg,
      nextSuggestion: activeSuggestion(input.repRange, input.repRange.min, nextWeight),
    },
  };
}
