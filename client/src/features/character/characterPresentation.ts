import {
  createInitialCharacterGrowth,
  isBodyweightExerciseId,
  type CharacterGrowth,
  type ExerciseProgressState,
  type ExerciseProgressById,
  type ExerciseSuggestion,
  type ExerciseWorkoutResult,
  type StageProgress,
  type StageRoadmap,
  type TrainingExpCategory,
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

export interface ExerciseRecordDisplay {
  readonly weightKg?: number;
  readonly reps: number;
}

export interface StageProgressSummary {
  readonly completedQuestCount: number;
  readonly totalQuestCount: number;
  readonly trainingQuestClearCount: number;
  readonly recoveryQuestClearCount: number;
  readonly bossQuestsRemaining: number;
  readonly percent: number;
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
  readonly stageProgress: StageProgressSummary;
}

const TRAINING_EXP_LABELS = [
  { id: 'chest', label: 'CHEST', japaneseLabel: '胸' },
  { id: 'back', label: 'BACK', japaneseLabel: '背中' },
  { id: 'shoulders', label: 'SHOULDERS', japaneseLabel: '肩' },
  { id: 'arms', label: 'ARMS', japaneseLabel: '腕' },
  { id: 'legs', label: 'LEGS', japaneseLabel: '脚' },
] as const;

export function getTrainingExpCategoryPresentation(category: TrainingExpCategory) {
  return TRAINING_EXP_LABELS.find((item) => item.id === category) ?? null;
}

function nonnegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Actual record is deliberately independent of `nextSuggestion`: select the
 * latest cleared Training day for this performed exercise, then its highest setNumber.
 */
export function latestClearedExerciseRecord(
  source: CharacterScreenSource,
  exerciseId: string | undefined,
  completedQuestCount: number,
): ExerciseRecordDisplay | null {
  if (exerciseId === undefined || source.roadmap === undefined) return null;
  const bodyweight = isBodyweightExerciseId(exerciseId);

  for (let dayIndex = completedQuestCount - 1; dayIndex >= 0; dayIndex -= 1) {
    if (source.roadmap.days[dayIndex]?.type !== 'training') continue;
    const results = Object.values(source.workoutResultsByDay?.[dayIndex] ?? {});
    const result = results.find((entry) => entry.performedExerciseId === exerciseId);
    if (result === undefined) continue;

    const representativeSet = result.completedSets
      .reduce<ExerciseWorkoutResult['completedSets'][number] | null>((selected, candidate) => {
        const validSet = Number.isSafeInteger(candidate.setNumber) && candidate.setNumber > 0 &&
          Number.isSafeInteger(candidate.reps) && candidate.reps > 0 &&
          (bodyweight
            ? candidate.weightKg === undefined
            : positiveFinite(candidate.weightKg));
        if (!validSet) return selected;
        return selected === null || candidate.setNumber > selected.setNumber ? candidate : selected;
      }, null);
    if (representativeSet !== null) {
      return representativeSet.weightKg === undefined
        ? { reps: representativeSet.reps }
        : { weightKg: representativeSet.weightKg, reps: representativeSet.reps };
    }
  }
  return null;
}

export function formatNextExerciseSuggestion(
  exerciseProgress: ExerciseProgressState | undefined,
  exerciseId: string | undefined,
): string {
  if (exerciseId === undefined || exerciseProgress?.exerciseId !== exerciseId) return '目安未設定';
  const suggestion: ExerciseSuggestion | undefined = exerciseProgress.nextSuggestion;
  if (suggestion === undefined) return '目安未設定';
  const bodyweight = isBodyweightExerciseId(exerciseId);
  if (suggestion.status === 'weight_up_ready' && !bodyweight) return '重量UPのタイミング';
  if (suggestion.status !== 'active' || !Number.isSafeInteger(suggestion.targetReps) || suggestion.targetReps <= 0) {
    return '目安未設定';
  }
  if (bodyweight) return `${suggestion.targetReps}回`;
  if (suggestion.weightKg === undefined) return `重量未設定 / ${suggestion.targetReps}回`;
  return positiveFinite(suggestion.weightKg)
    ? `${suggestion.weightKg}kg × ${suggestion.targetReps}回`
    : '目安未設定';
}

export function deriveStageProgressSummary(
  source: Pick<CharacterScreenSource, 'roadmap' | 'progress'> | null,
): StageProgressSummary {
  const roadmap = source?.roadmap;
  const totalQuestCount = roadmap?.days.length ?? 0;
  const requestedCompleted = source?.progress?.currentDayIndex ?? 0;
  const completedQuestCount = Number.isSafeInteger(requestedCompleted)
    ? Math.min(totalQuestCount, Math.max(0, requestedCompleted))
    : 0;
  const completedDays = roadmap?.days.slice(0, completedQuestCount) ?? [];
  const trainingQuestClearCount = completedDays.filter((day) => day.type === 'training').length;
  const recoveryQuestClearCount = completedDays.filter((day) => day.type === 'recovery').length;

  return {
    completedQuestCount,
    totalQuestCount,
    trainingQuestClearCount,
    recoveryQuestClearCount,
    bossQuestsRemaining: Math.max(0, totalQuestCount - completedQuestCount),
    percent: totalQuestCount === 0 ? 0 : (completedQuestCount / totalQuestCount) * 100,
  };
}

function safeGrowth(value: CharacterGrowth | undefined): CharacterGrowth {
  return value ?? createInitialCharacterGrowth();
}

export function deriveCharacterScreenModel(
  source: CharacterScreenSource | null,
): CharacterScreenModel {
  const data = source ?? {};
  const roadmap = data.roadmap;
  const stageProgress = deriveStageProgressSummary(data);
  const growth = safeGrowth(data.characterGrowth);
  const mainExerciseId = roadmap?.mainExerciseId;
  const baseline = mainExerciseId === undefined
    ? undefined
    : data.exerciseProgressById?.[mainExerciseId]?.baseline;
  const start = baseline !== undefined && positiveFinite(baseline.weightKg) &&
      Number.isSafeInteger(baseline.reps) && baseline.reps > 0
    ? { weightKg: baseline.weightKg, reps: baseline.reps }
    : null;
  const mainActualRecord = latestClearedExerciseRecord(
    data,
    mainExerciseId,
    stageProgress.completedQuestCount,
  );
  const current = mainActualRecord?.weightKg === undefined
    ? null
    : { weightKg: mainActualRecord.weightKg, reps: mainActualRecord.reps };
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
    stageProgress,
  };
}
