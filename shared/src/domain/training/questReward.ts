import type { GymEquipmentProfile } from './equipment.js';
import { getExerciseExpCategory } from './exerciseExpCategory.js';
import type { CharacterGrowth, TrainingExpCategory } from './characterGrowth.js';
import {
  completeRecoveryQuest,
  completeTrainingQuest,
  evaluateTrainingQuestCompletion,
  type QuestCompletionResult,
  type StageProgress,
} from './stageProgress.js';
import type { StageRoadmap } from './stageRoadmap.js';
import type { ValidatedTrainingPlan } from './trainingPlan.js';
import {
  validateExerciseWorkoutResult,
  validateWorkoutResultAgainstPlan,
  type ExerciseWorkoutResult,
} from './workoutResult.js';

export const QUEST_REWARD_RULE_VERSION = 'quest-reward-v1' as const;
export const TRAINING_EXP_PER_COMPLETED_PLANNED_SET = 5;
export const RECOVERY_QUEST_EXP = 10;

export interface QuestRewardSummary {
  readonly dayIndex: number;
  readonly questType: 'training' | 'recovery';
  readonly trainingExpGained: Readonly<Partial<Record<TrainingExpCategory, number>>>;
  readonly recoveryExpGained: number;
  readonly mapProgressGained: 1;
}

export type TrainingQuestRewardCalculation =
  | { readonly valid: true; readonly rewardSummary: QuestRewardSummary }
  | { readonly valid: false; readonly code: 'INVALID_DAY_INDEX' | 'QUEST_NOT_READY' | 'UNKNOWN_EXERCISE_EXP_CATEGORY' };

export type ApplyQuestRewardResult =
  | { readonly valid: true; readonly characterGrowth: CharacterGrowth }
  | { readonly valid: false; readonly code: 'INVALID_CHARACTER_GROWTH' | 'INVALID_QUEST_REWARD' | 'EXP_OVERFLOW' };

export type QuestRewardCompletionResult =
  | {
    readonly status: 'completed';
    readonly progress: StageProgress;
    readonly completedDayIndex: number;
    readonly bossAvailable: boolean;
    readonly characterGrowth: CharacterGrowth;
    readonly rewardSummary: QuestRewardSummary;
  }
  | Exclude<QuestCompletionResult, { readonly status: 'completed' }>
  | { readonly status: 'invalid_reward_state'; readonly progress: StageProgress };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidCharacterGrowth(value: unknown): value is CharacterGrowth {
  if (!isRecord(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'trainingExp') || !Object.hasOwn(value, 'recoveryExp')) {
    return false;
  }
  if (!isNonNegativeSafeInteger(value.recoveryExp) || !isRecord(value.trainingExp)) return false;
  const categories = ['chest', 'back', 'shoulders', 'arms', 'legs'] as const;
  return Object.keys(value.trainingExp).length === categories.length &&
    categories.every((category) => Object.hasOwn(value.trainingExp as object, category) &&
      isNonNegativeSafeInteger((value.trainingExp as Record<string, unknown>)[category]));
}

function isValidQuestRewardSummary(value: unknown): value is QuestRewardSummary {
  if (!isRecord(value) ||
      Object.keys(value).some((key) => !['dayIndex', 'questType', 'trainingExpGained', 'recoveryExpGained', 'mapProgressGained'].includes(key)) ||
      !Number.isSafeInteger(value.dayIndex) || (value.dayIndex as number) < 0 ||
      (value.questType !== 'training' && value.questType !== 'recovery') ||
      !isNonNegativeSafeInteger(value.recoveryExpGained) || value.mapProgressGained !== 1 ||
      !isRecord(value.trainingExpGained)) {
    return false;
  }
  const categories = ['chest', 'back', 'shoulders', 'arms', 'legs'] as const;
  if (Object.keys(value.trainingExpGained).some((key) => !categories.includes(key as TrainingExpCategory))) return false;
  const values = Object.values(value.trainingExpGained);
  if (!values.every((amount) => Number.isSafeInteger(amount) && (amount as number) > 0 && (amount as number) % TRAINING_EXP_PER_COMPLETED_PLANNED_SET === 0)) return false;
  if (value.questType === 'training') return value.recoveryExpGained === 0;
  return Object.keys(value.trainingExpGained).length === 0 && value.recoveryExpGained === RECOVERY_QUEST_EXP;
}

/** Calculates a deterministic snapshot from plan-consistent, allowed results. */
export function calculateTrainingQuestReward(
  dayIndex: number,
  trainingPlan: ValidatedTrainingPlan,
  workoutResults: readonly unknown[],
  equipmentProfile?: GymEquipmentProfile,
  exerciseSkips: readonly unknown[] = [],
): TrainingQuestRewardCalculation {
  if (!Number.isSafeInteger(dayIndex) || dayIndex < 0) {
    return { valid: false, code: 'INVALID_DAY_INDEX' };
  }
  if (!Array.isArray(workoutResults)) return { valid: false, code: 'QUEST_NOT_READY' };
  const evaluation = evaluateTrainingQuestCompletion(trainingPlan, workoutResults, equipmentProfile, exerciseSkips);
  if (!evaluation.readyToClear) return { valid: false, code: 'QUEST_NOT_READY' };

  const gained: Partial<Record<TrainingExpCategory, number>> = {};
  for (const input of workoutResults) {
    const validation = validateExerciseWorkoutResult(input);
    if (!validation.valid) return { valid: false, code: 'QUEST_NOT_READY' };
    const result = validation.value;
    const plannedExercise = trainingPlan.exercises.find((exercise) => exercise.exerciseId === result.plannedExerciseId);
    if (plannedExercise === undefined || !validateWorkoutResultAgainstPlan(result, plannedExercise).valid) {
      return { valid: false, code: 'QUEST_NOT_READY' };
    }

    const category = getExerciseExpCategory(result.performedExerciseId);
    if (category === undefined) return { valid: false, code: 'UNKNOWN_EXERCISE_EXP_CATEGORY' };
    const eligibleSetCount = result.completedSets.filter((set) =>
      set.setNumber >= 1 && set.setNumber <= result.plannedSets,
    ).length;
    const exp = eligibleSetCount * TRAINING_EXP_PER_COMPLETED_PLANNED_SET;
    if (exp > 0) gained[category] = (gained[category] ?? 0) + exp;
  }

  return {
    valid: true,
    rewardSummary: {
      dayIndex,
      questType: 'training',
      trainingExpGained: gained,
      recoveryExpGained: 0,
      mapProgressGained: 1,
    },
  };
}

export function calculateRecoveryQuestReward(dayIndex: number): QuestRewardSummary | null {
  if (!Number.isSafeInteger(dayIndex) || dayIndex < 0) return null;
  return {
    dayIndex,
    questType: 'recovery',
    trainingExpGained: {},
    recoveryExpGained: RECOVERY_QUEST_EXP,
    mapProgressGained: 1,
  };
}

/** Apply a previously calculated summary without mutating either input. */
export function applyQuestReward(
  characterGrowth: unknown,
  rewardSummary: unknown,
): ApplyQuestRewardResult {
  if (!isValidCharacterGrowth(characterGrowth)) return { valid: false, code: 'INVALID_CHARACTER_GROWTH' };
  if (!isValidQuestRewardSummary(rewardSummary)) return { valid: false, code: 'INVALID_QUEST_REWARD' };

  const trainingExp = { ...characterGrowth.trainingExp };
  for (const [category, amount] of Object.entries(rewardSummary.trainingExpGained)) {
    const current = trainingExp[category as TrainingExpCategory];
    const next = current + (amount as number);
    if (!Number.isSafeInteger(next)) return { valid: false, code: 'EXP_OVERFLOW' };
    trainingExp[category as TrainingExpCategory] = next;
  }
  const recoveryExp = characterGrowth.recoveryExp + rewardSummary.recoveryExpGained;
  if (!Number.isSafeInteger(recoveryExp)) return { valid: false, code: 'EXP_OVERFLOW' };

  return { valid: true, characterGrowth: { trainingExp, recoveryExp } };
}

/** Revalidate clear eligibility and apply progress, growth, and reward as one pure result. */
export function completeTrainingQuestWithReward(
  roadmap: StageRoadmap,
  progress: StageProgress,
  requestedDayIndex: number,
  trainingPlan: ValidatedTrainingPlan | undefined,
  workoutResults: readonly unknown[],
  equipmentProfile: GymEquipmentProfile | undefined,
  characterGrowth: unknown,
  exerciseSkips: readonly unknown[] = [],
): QuestRewardCompletionResult {
  const completion = completeTrainingQuest(
    roadmap,
    progress,
    requestedDayIndex,
    trainingPlan,
    workoutResults,
    equipmentProfile,
    exerciseSkips,
  );
  if (completion.status !== 'completed') return completion;
  if (trainingPlan === undefined) return { status: 'invalid_reward_state', progress };

  const calculation = calculateTrainingQuestReward(
    completion.completedDayIndex,
    trainingPlan,
    workoutResults,
    equipmentProfile,
    exerciseSkips,
  );
  if (!calculation.valid) return { status: 'invalid_reward_state', progress };
  const applied = applyQuestReward(characterGrowth, calculation.rewardSummary);
  if (!applied.valid) return { status: 'invalid_reward_state', progress };

  return {
    ...completion,
    characterGrowth: applied.characterGrowth,
    rewardSummary: calculation.rewardSummary,
  };
}

export function completeRecoveryQuestWithReward(
  roadmap: StageRoadmap,
  progress: StageProgress,
  requestedDayIndex: number,
  characterGrowth: unknown,
): QuestRewardCompletionResult {
  const completion = completeRecoveryQuest(roadmap, progress, requestedDayIndex);
  if (completion.status !== 'completed') return completion;
  const rewardSummary = calculateRecoveryQuestReward(completion.completedDayIndex);
  if (rewardSummary === null) return { status: 'invalid_reward_state', progress };
  const applied = applyQuestReward(characterGrowth, rewardSummary);
  if (!applied.valid) return { status: 'invalid_reward_state', progress };

  return {
    ...completion,
    characterGrowth: applied.characterGrowth,
    rewardSummary,
  };
}
