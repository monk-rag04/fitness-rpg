import type { ExerciseId } from './exercise.js';
import {
  planNextStage,
  selectRoadmapDuration,
  validateAchievementDurationEstimate,
  validateAchievementDurationEstimatorInput,
  type AchievementDurationEstimatorInput,
} from './stagePlanning.js';
import {
  generateStageRoadmap,
  isValidLocalDate,
  type LocalDate,
  type StageRoadmap,
} from './stageRoadmap.js';
import { createInitialStageProgress, type StageProgress } from './stageProgress.js';

export interface NextStageRoadmapInput {
  readonly currentE1rmKg: number;
  readonly finalGoalE1rmKg: number;
  readonly mainExerciseId: ExerciseId;
  readonly trainingExperienceMonths: number;
  readonly trainingFrequencyPerWeek: number;
  readonly startDate: LocalDate;
}

export type NextStageRoadmapPreparation =
  | { readonly status: 'invalid_input' }
  | { readonly status: 'goal_reached'; readonly currentE1rmKg: number; readonly finalGoalE1rmKg: number }
  | {
    readonly status: 'ready_for_duration_estimate';
    readonly input: NextStageRoadmapInput;
    readonly stageTargetE1rmKg: number;
    readonly durationInput: AchievementDurationEstimatorInput;
  };

/** Prepare a subsequent roadmap using the existing D-025 stage and duration rules. */
export function prepareNextStageRoadmap(input: unknown): NextStageRoadmapPreparation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { status: 'invalid_input' };
  const allowedFields = ['currentE1rmKg', 'finalGoalE1rmKg', 'mainExerciseId', 'trainingExperienceMonths', 'trainingFrequencyPerWeek', 'startDate'];
  if (Object.keys(input).some((field) => !allowedFields.includes(field))) return { status: 'invalid_input' };
  const value = input as Partial<NextStageRoadmapInput>;
  if (typeof value.currentE1rmKg !== 'number' || !Number.isFinite(value.currentE1rmKg) || value.currentE1rmKg <= 0 ||
      typeof value.finalGoalE1rmKg !== 'number' || !Number.isFinite(value.finalGoalE1rmKg) || value.finalGoalE1rmKg <= 0 ||
      typeof value.mainExerciseId !== 'string' ||
      typeof value.trainingExperienceMonths !== 'number' || !Number.isSafeInteger(value.trainingExperienceMonths) || value.trainingExperienceMonths < 0 ||
      typeof value.trainingFrequencyPerWeek !== 'number' || !Number.isSafeInteger(value.trainingFrequencyPerWeek) || value.trainingFrequencyPerWeek < 1 || value.trainingFrequencyPerWeek > 7 ||
      !isValidLocalDate(value.startDate)) return { status: 'invalid_input' };

  const inputValue = value as NextStageRoadmapInput;
  const stage = planNextStage({ currentE1rmKg: inputValue.currentE1rmKg, finalGoalE1rmKg: inputValue.finalGoalE1rmKg });
  if (stage.status === 'goal_reached') {
    return { status: 'goal_reached', currentE1rmKg: stage.currentE1rmKg, finalGoalE1rmKg: stage.finalGoalE1rmKg };
  }
  if (stage.status !== 'stage_planned') return { status: 'invalid_input' };
  const durationInput = validateAchievementDurationEstimatorInput({
    exerciseId: inputValue.mainExerciseId,
    currentE1rmKg: inputValue.currentE1rmKg,
    stageTargetE1rmKg: stage.stageTargetE1rmKg,
    trainingExperienceMonths: inputValue.trainingExperienceMonths,
    trainingFrequencyPerWeek: inputValue.trainingFrequencyPerWeek,
  });
  if (!durationInput.valid) return { status: 'invalid_input' };
  return {
    status: 'ready_for_duration_estimate',
    input: inputValue,
    stageTargetE1rmKg: stage.stageTargetE1rmKg,
    durationInput: durationInput.value,
  };
}

export type NextStageRoadmapCompletion =
  | { readonly status: 'invalid_duration_estimate' }
  | { readonly status: 'stage_replanning_required'; readonly estimatedAchievementDays: number }
  | {
    readonly status: 'roadmap_created';
    readonly estimatedAchievementDays: number;
    readonly roadmap: StageRoadmap;
    readonly progress: StageProgress;
  };

/** Complete from the estimator response; no Provider call or persistence lives in Domain. */
export function completeNextStageRoadmap(
  prepared: Extract<NextStageRoadmapPreparation, { readonly status: 'ready_for_duration_estimate' }>,
  durationResponse: unknown,
): NextStageRoadmapCompletion {
  const estimate = validateAchievementDurationEstimate(durationResponse);
  if (!estimate.valid) return { status: 'invalid_duration_estimate' };
  const selection = selectRoadmapDuration(estimate.value.estimatedAchievementDays);
  if (selection.status === 'stage_replanning_required') {
    return { status: 'stage_replanning_required', estimatedAchievementDays: selection.estimatedAchievementDays };
  }
  const roadmap = generateStageRoadmap({
    startDate: prepared.input.startDate,
    durationDays: selection.selectedRoadmapDurationDays,
    trainingFrequencyPerWeek: prepared.input.trainingFrequencyPerWeek,
    mainExerciseId: prepared.input.mainExerciseId,
    stageTargetE1rmKg: prepared.stageTargetE1rmKg,
  });
  return {
    status: 'roadmap_created',
    estimatedAchievementDays: selection.estimatedAchievementDays,
    roadmap,
    progress: createInitialStageProgress(roadmap),
  };
}
