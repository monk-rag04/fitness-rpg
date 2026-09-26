import { getExerciseById } from './exerciseCatalog.js';
import { isBodyweightExerciseId, type ExerciseId } from './exercise.js';
import { calculateSetE1rm, E1RM_RULE } from './e1rm.js';
import { getTrainingHistoryMultipliers, normalizeMainStrengthWeightKg } from './mainStrengthEstimate.js';
import type { ExerciseBaseline } from './exerciseProgress.js';
import type { RepRange } from './trainingPlan.js';

export const EXERCISE_INITIAL_SUGGESTION_RULE_VERSION = 'exercise-initial-suggestion-v1' as const;

/** Conservative per-bodyweight ratios; Dumbbell values are per single dumbbell. */
export const EXERCISE_INITIAL_BODYWEIGHT_RATIOS = {
  barbell_bench_press: 0.30,
  dumbbell_bench_press: 0.075,
  incline_dumbbell_press: 0.06,
  chest_press_machine: 0.20,
  cable_chest_fly: 0.035,
  dumbbell_chest_fly: 0.035,
  barbell_bent_over_row: 0.25,
  one_arm_dumbbell_row: 0.075,
  seated_row_machine: 0.20,
  lat_pulldown: 0.20,
  barbell_deadlift: 0.45,
  barbell_overhead_press: 0.18,
  dumbbell_shoulder_press: 0.05,
  shoulder_press_machine: 0.15,
  dumbbell_lateral_raise: 0.025,
  cable_lateral_raise: 0.025,
  barbell_curl: 0.08,
  dumbbell_curl: 0.04,
  cable_curl: 0.04,
  cable_triceps_pushdown: 0.04,
  dumbbell_overhead_triceps_extension: 0.035,
  close_grip_bench_press: 0.25,
  barbell_back_squat: 0.40,
  goblet_squat: 0.15,
  smith_machine_squat: 0.30,
  leg_press: 0.40,
  leg_extension: 0.15,
  romanian_deadlift: 0.30,
  seated_leg_curl: 0.15,
  standing_calf_raise: 0.10,
  barbell_hip_thrust: 0.35,
} as const satisfies Readonly<Partial<Record<ExerciseId, number>>>;

export interface ExerciseInitialSuggestion {
  readonly exerciseId: ExerciseId;
  readonly weightKg?: number;
  readonly targetReps: number;
  readonly repRange: RepRange;
  readonly ruleVersion: typeof EXERCISE_INITIAL_SUGGESTION_RULE_VERSION;
}

export interface MainStrengthInitialSuggestion {
  readonly exerciseId: ExerciseId;
  readonly weightKg: number;
  readonly targetReps: number;
  readonly repRange: RepRange;
  readonly e1rmRuleVersion: typeof E1RM_RULE.version;
}

function nearestHalfKg(value: number): number {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

function isValidRepRange(value: RepRange): boolean {
  return Number.isSafeInteger(value.min) && value.min > 0 &&
    Number.isSafeInteger(value.max) && value.max >= value.min;
}

/**
 * Re-expresses an Onboarding / provisional Main Strength baseline at the
 * planned minimum reps. This is display-only and deliberately excludes
 * post-clear workout baselines, which belong to adaptive progression.
 */
export function recommendInitialMainStrengthSuggestion(input: {
  readonly exerciseId: string;
  readonly baseline: ExerciseBaseline | undefined;
  readonly repRange: RepRange;
}): MainStrengthInitialSuggestion | null {
  const exercise = getExerciseById(input.exerciseId);
  const baseline = input.baseline;
  if (exercise === undefined || isBodyweightExerciseId(exercise.id) || baseline === undefined ||
      (baseline.source !== 'onboarding' && baseline.source !== 'estimated_profile') ||
      !isValidRepRange(input.repRange)) {
    return null;
  }

  try {
    const currentE1rm = calculateSetE1rm({ weightKg: baseline.weightKg, reps: baseline.reps });
    if (!currentE1rm.eligible) return null;
    const targetWeightKg = currentE1rm.estimated1rmKg / (1 + input.repRange.min / E1RM_RULE.epleyRepDivisor);
    const weightKg = normalizeMainStrengthWeightKg(targetWeightKg);
    if (!Number.isFinite(weightKg) || weightKg <= 0) return null;

    return {
      exerciseId: exercise.id,
      weightKg,
      targetReps: input.repRange.min,
      repRange: { ...input.repRange },
      e1rmRuleVersion: currentE1rm.ruleVersion,
    };
  } catch {
    return null;
  }
}

/**
 * Returns a display-only first-session hint. It never creates a Baseline or
 * writes an actual Workout Result; Bodyweight movements remain reps-only.
 */
export function recommendInitialExerciseSuggestion(input: {
  readonly exerciseId: string;
  readonly bodyWeightKg: number;
  readonly trainingExperienceMonths: number;
  readonly repRange: RepRange;
}): ExerciseInitialSuggestion | null {
  const exercise = getExerciseById(input.exerciseId);
  if (exercise === undefined || !Number.isFinite(input.bodyWeightKg) || input.bodyWeightKg <= 0 ||
      !Number.isSafeInteger(input.trainingExperienceMonths) || input.trainingExperienceMonths < 0 ||
      !isValidRepRange(input.repRange)) {
    return null;
  }

  const common = {
    exerciseId: exercise.id,
    targetReps: input.repRange.min,
    repRange: { ...input.repRange },
    ruleVersion: EXERCISE_INITIAL_SUGGESTION_RULE_VERSION,
  } as const;
  if (isBodyweightExerciseId(exercise.id)) return common;

  const ratio = EXERCISE_INITIAL_BODYWEIGHT_RATIOS[exercise.id as keyof typeof EXERCISE_INITIAL_BODYWEIGHT_RATIOS];
  if (ratio === undefined) return null;

  // Reuse D-041's experience buckets, with a 5% ceiling for a first-session hint.
  const historyFactor = Math.min(getTrainingHistoryMultipliers(input.trainingExperienceMonths).strength, 1.05);
  const weightKg = nearestHalfKg(input.bodyWeightKg * ratio * historyFactor);
  return Number.isFinite(weightKg) && weightKg > 0 ? { ...common, weightKg } : null;
}

/** Presentation note for machine/cable settings that vary by equipment model. */
export function isMachineOrCableExercise(exerciseId: string): boolean {
  const exercise = getExerciseById(exerciseId);
  return exercise?.requiredEquipmentOptions.every((option) => option.some((equipmentId) =>
    equipmentId === 'cable_machine' || equipmentId.endsWith('_machine'),
  )) ?? false;
}
