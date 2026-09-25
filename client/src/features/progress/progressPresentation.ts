import {
  getExerciseById,
  getExerciseExpCategory,
  isBodyweightExerciseId,
  type ExerciseProgressState,
} from '@fitness-rpg/shared';
import { exerciseLabel } from '../../presentation/trainingLabels.ts';
import {
  deriveCharacterScreenModel,
  formatNextExerciseSuggestion,
  getTrainingExpCategoryPresentation,
  latestClearedExerciseRecord,
  type CharacterScreenSource,
  type ExerciseRecordDisplay,
} from '../character/characterPresentation.ts';

export interface ProgressExerciseRecordModel {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly catalogName: string;
  readonly categoryJapanese: string;
  readonly categoryEnglish: string;
  readonly sessionsCompleted: number;
  readonly isBodyweight: boolean;
  readonly initialRecord: ExerciseRecordDisplay | null;
  readonly latestRecord: ExerciseRecordDisplay | null;
  readonly nextSuggestion: string;
}

export interface ProgressScreenModel {
  readonly stageProgress: ReturnType<typeof deriveCharacterScreenModel>['stageProgress'];
  readonly mainStrength: {
    readonly exerciseName: string | null;
    readonly start: ExerciseRecordDisplay | null;
    readonly latest: ExerciseRecordDisplay | null;
    readonly targetE1rmKg: number | null;
    readonly nextSuggestion: string;
  };
  readonly exerciseRecords: readonly ProgressExerciseRecordModel[];
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function baselineRecord(
  exerciseProgress: ExerciseProgressState,
  isBodyweight: boolean,
): ExerciseRecordDisplay | null {
  const baseline = exerciseProgress.baseline;
  if (isBodyweight || baseline === undefined || !isPositiveFinite(baseline.weightKg) ||
      !isPositiveInteger(baseline.reps)) {
    return null;
  }
  return { weightKg: baseline.weightKg, reps: baseline.reps };
}

export function deriveProgressScreenModel(
  source: CharacterScreenSource | null,
): ProgressScreenModel {
  const data = source ?? {};
  const character = deriveCharacterScreenModel(data);
  const mainExerciseId = data.roadmap?.mainExerciseId;
  const mainProgress = mainExerciseId === undefined
    ? undefined
    : data.exerciseProgressById?.[mainExerciseId];
  const exerciseRecords = Object.values(data.exerciseProgressById ?? {}).flatMap((state) => {
    if (state === undefined || !Number.isSafeInteger(state.sessionsCompleted) || state.sessionsCompleted <= 0 ||
        state.exerciseId === mainExerciseId) {
      return [];
    }

    const exercise = getExerciseById(state.exerciseId);
    const category = getExerciseExpCategory(state.exerciseId);
    const categoryPresentation = category === undefined
      ? null
      : getTrainingExpCategoryPresentation(category);
    if (exercise === undefined || categoryPresentation === null) return [];

    const isBodyweight = isBodyweightExerciseId(state.exerciseId);
    return [{
      exerciseId: state.exerciseId,
      exerciseName: exerciseLabel(state.exerciseId),
      catalogName: exercise.displayName,
      categoryJapanese: categoryPresentation.japaneseLabel,
      categoryEnglish: categoryPresentation.label,
      sessionsCompleted: state.sessionsCompleted,
      isBodyweight,
      initialRecord: baselineRecord(state, isBodyweight),
      latestRecord: latestClearedExerciseRecord(
        data,
        state.exerciseId,
        character.stageProgress.completedQuestCount,
      ),
      nextSuggestion: formatNextExerciseSuggestion(state, state.exerciseId),
    }];
  });

  return {
    stageProgress: character.stageProgress,
    mainStrength: {
      exerciseName: character.mainStrength.exerciseName,
      start: character.mainStrength.start,
      latest: character.mainStrength.current,
      targetE1rmKg: character.mainStrength.targetE1rmKg,
      nextSuggestion: formatNextExerciseSuggestion(mainProgress, mainExerciseId),
    },
    exerciseRecords,
  };
}
