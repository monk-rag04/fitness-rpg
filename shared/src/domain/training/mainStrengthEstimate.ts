import { calculateSetE1rm } from './e1rm.js';
import type { ExerciseId } from './exercise.js';

export const MAIN_STRENGTH_ESTIMATE_RULE_VERSION = 'main-strength-estimate-v1' as const;
export const ESTIMATED_GOAL_HORIZON_DAYS = 84 as const;
export const ESTIMATED_WORKING_SET_REPS = 5 as const;

const EXERCISE_MULTIPLIER = {
  barbell_bench_press: 0.55,
  barbell_back_squat: 0.75,
  barbell_deadlift: 0.90,
  barbell_overhead_press: 0.35,
} as const satisfies Partial<Record<ExerciseId, number>>;

export interface MainStrengthProfileEstimate {
  readonly exerciseId: keyof typeof EXERCISE_MULTIPLIER;
  readonly estimatedE1rmKg: number;
  readonly workingWeightKg: number;
  readonly workingReps: typeof ESTIMATED_WORKING_SET_REPS;
  /** D-023 e1RM of the normalized preview set, used by existing Stage planning. */
  readonly baselineE1rmKg: number;
  readonly finalGoalE1rmKg: number;
  readonly goalHorizonDays: typeof ESTIMATED_GOAL_HORIZON_DAYS;
  readonly ruleVersion: typeof MAIN_STRENGTH_ESTIMATE_RULE_VERSION;
}

export function normalizeMainStrengthWeightKg(value: number): number {
  return Math.round(value * 2) / 2;
}

export function getTrainingHistoryMultipliers(months: number): { readonly strength: number; readonly goal: number } {
  if (months < 3) return { strength: 1, goal: 1.20 };
  if (months < 6) return { strength: 1.05, goal: 1.18 };
  if (months < 12) return { strength: 1.10, goal: 1.15 };
  return { strength: 1.15, goal: 1.10 };
}

/** Provisional, profile-derived starting point. It is never an actual workout record. */
export function estimateMainStrengthProfile(input: {
  readonly bodyWeightKg: number;
  readonly trainingExperienceMonths: number;
  readonly mainExerciseId: string;
}): MainStrengthProfileEstimate | null {
  if (!Number.isFinite(input.bodyWeightKg) || input.bodyWeightKg <= 0 ||
      !Number.isSafeInteger(input.trainingExperienceMonths) || input.trainingExperienceMonths < 0 ||
      !Object.hasOwn(EXERCISE_MULTIPLIER, input.mainExerciseId)) {
    return null;
  }

  const exerciseId = input.mainExerciseId as keyof typeof EXERCISE_MULTIPLIER;
  const factors = getTrainingHistoryMultipliers(input.trainingExperienceMonths);
  const estimatedE1rmKg = normalizeMainStrengthWeightKg(input.bodyWeightKg * EXERCISE_MULTIPLIER[exerciseId] * factors.strength);
  const workingWeightKg = normalizeMainStrengthWeightKg(
    estimatedE1rmKg / (1 + ESTIMATED_WORKING_SET_REPS / 30),
  );
  if (!Number.isFinite(estimatedE1rmKg) || estimatedE1rmKg <= 0 ||
      !Number.isFinite(workingWeightKg) || workingWeightKg <= 0) {
    return null;
  }

  const setEstimate = calculateSetE1rm({ weightKg: workingWeightKg, reps: ESTIMATED_WORKING_SET_REPS });
  if (!setEstimate.eligible) return null;
  const baselineE1rmKg = setEstimate.estimated1rmKg;
  const proportionalGoal = normalizeMainStrengthWeightKg(estimatedE1rmKg * factors.goal);
  const minimumGoal = Math.ceil((baselineE1rmKg + 2.5) * 2) / 2;
  const finalGoalE1rmKg = Math.max(proportionalGoal, minimumGoal);
  if (!Number.isFinite(finalGoalE1rmKg)) return null;

  return {
    exerciseId,
    estimatedE1rmKg,
    workingWeightKg,
    workingReps: ESTIMATED_WORKING_SET_REPS,
    baselineE1rmKg,
    finalGoalE1rmKg,
    goalHorizonDays: ESTIMATED_GOAL_HORIZON_DAYS,
    ruleVersion: MAIN_STRENGTH_ESTIMATE_RULE_VERSION,
  };
}
