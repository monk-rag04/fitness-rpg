import {
  createInitialCharacterGrowth,
  type CharacterGrowth,
  type ExerciseProgressById,
  type ExerciseWorkoutResult,
  type StageProgress,
  type StageRoadmap,
} from '@fitness-rpg/shared';
import { exerciseLabel } from '../../presentation/trainingLabels.ts';

type WorkoutResultsByDay = Readonly<Record<number, Readonly<Record<string, ExerciseWorkoutResult>>>>;

export interface CharacterScreenSource {
  readonly roadmap?: StageRoadmap;
  readonly progress?: StageProgress;
  readonly exerciseProgressById?: ExerciseProgressById;
  readonly workoutResultsByDay?: WorkoutResultsByDay;
  readonly characterGrowth?: CharacterGrowth;
  readonly mainStrengthGoalE1rmKg?: number;
}

export interface StrengthRecordDisplay {
  readonly weightKg: number;
  readonly reps: number;
}

export interface CharacterScreenModel {
  readonly mainStrength: {
    readonly exerciseName: string | null;
    readonly start: StrengthRecordDisplay | null;
    readonly current: StrengthRecordDisplay | null;
    readonly targetE1rmKg: number | null;
  };
  readonly trainingExp: readonly {
    readonly id: 'chest' | 'back' | 'shoulders' | 'arms' | 'legs';
    readonly label: string;
    readonly japaneseLabel: string;
    readonly exp: number;
  }[];
  readonly recoveryExp: number;
  readonly stageProgress: {
    readonly completedQuestCount: number;
    readonly totalQuestCount: number;
    readonly bossQuestsRemaining: number;
    readonly percent: number;
  };
}

const TRAINING_EXP_LABELS = [
  { id: 'chest', label: 'CHEST', japaneseLabel: '胸' },
  { id: 'back', label: 'BACK', japaneseLabel: '背中' },
  { id: 'shoulders', label: 'SHOULDERS', japaneseLabel: '肩' },
  { id: 'arms', label: 'ARMS', japaneseLabel: '腕' },
  { id: 'legs', label: 'LEGS', japaneseLabel: '脚' },
] as const;

function nonnegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isDisplayableWeightedSet(
  set: ExerciseWorkoutResult['completedSets'][number],
): set is ExerciseWorkoutResult['completedSets'][number] & { readonly weightKg: number } {
  return Number.isSafeInteger(set.setNumber) && set.setNumber > 0 &&
    Number.isSafeInteger(set.reps) && set.reps > 0 && positiveFinite(set.weightKg);
}

/**
 * CURRENT is deliberately an actual result, not `nextSuggestion`: select the
 * latest cleared Training day with a valid Main result, then its highest setNumber.
 */
function latestClearedMainRecord(
  source: CharacterScreenSource,
  mainExerciseId: string | undefined,
  completedQuestCount: number,
): StrengthRecordDisplay | null {
  if (mainExerciseId === undefined || source.roadmap === undefined) return null;

  for (let dayIndex = completedQuestCount - 1; dayIndex >= 0; dayIndex -= 1) {
    if (source.roadmap.days[dayIndex]?.type !== 'training') continue;
    const results = Object.values(source.workoutResultsByDay?.[dayIndex] ?? {});
    const result = results.find((entry) => entry.performedExerciseId === mainExerciseId);
    if (result === undefined) continue;

    const representativeSet = result.completedSets
      .filter(isDisplayableWeightedSet)
      .reduce<ExerciseWorkoutResult['completedSets'][number] & { readonly weightKg: number } | null>(
        (selected, candidate) => selected === null || candidate.setNumber > selected.setNumber
          ? candidate
          : selected,
        null,
      );
    if (representativeSet !== null) {
      return { weightKg: representativeSet.weightKg, reps: representativeSet.reps };
    }
  }
  return null;
}

function safeGrowth(value: CharacterGrowth | undefined): CharacterGrowth {
  return value ?? createInitialCharacterGrowth();
}

export function deriveCharacterScreenModel(
  source: CharacterScreenSource | null,
): CharacterScreenModel {
  const data = source ?? {};
  const roadmap = data.roadmap;
  const progress = data.progress;
  const totalQuestCount = roadmap?.days.length ?? 0;
  const requestedCompleted = progress?.currentDayIndex ?? 0;
  const completedQuestCount = Number.isSafeInteger(requestedCompleted)
    ? Math.min(totalQuestCount, Math.max(0, requestedCompleted))
    : 0;
  const growth = safeGrowth(data.characterGrowth);
  const mainExerciseId = roadmap?.mainExerciseId;
  const baseline = mainExerciseId === undefined
    ? undefined
    : data.exerciseProgressById?.[mainExerciseId]?.baseline;
  const start = baseline !== undefined && positiveFinite(baseline.weightKg) &&
      Number.isSafeInteger(baseline.reps) && baseline.reps > 0
    ? { weightKg: baseline.weightKg, reps: baseline.reps }
    : null;
  const current = latestClearedMainRecord(data, mainExerciseId, completedQuestCount);
  const targetE1rmKg = positiveFinite(data.mainStrengthGoalE1rmKg)
    ? data.mainStrengthGoalE1rmKg
    : null;
  const total = growth.trainingExp;

  return {
    mainStrength: {
      exerciseName: mainExerciseId === undefined ? null : exerciseLabel(mainExerciseId),
      start,
      current,
      targetE1rmKg,
    },
    trainingExp: TRAINING_EXP_LABELS.map((item) => ({
      ...item,
      exp: nonnegativeInteger(total[item.id]),
    })),
    recoveryExp: nonnegativeInteger(growth.recoveryExp),
    stageProgress: {
      completedQuestCount,
      totalQuestCount,
      bossQuestsRemaining: Math.max(0, totalQuestCount - completedQuestCount),
      percent: totalQuestCount === 0 ? 0 : (completedQuestCount / totalQuestCount) * 100,
    },
  };
}

export const PROGRESS_PLACEHOLDER_COPY = {
  title: 'PROGRESS',
  message: '進行記録は準備中です',
} as const;
