import { getExerciseById } from './exerciseCatalog.js';
import type { ExerciseId } from './exercise.js';

/** D-025 MVP rule. Persist this version with a generated stage target. */
export const STAGE_PLANNING_RULE = {
  version: 'stage-target-fixed-5kg-v1',
  stepKg: 5,
} as const;

/** Product-owned duration options. Do not duplicate this list in UI or AI prompts. */
export const ROADMAP_DURATION_CANDIDATES = [14, 21, 28, 35, 42] as const;

/** D-025 MVP rule. Persist this version with a selected roadmap duration. */
export const ROADMAP_DURATION_SELECTION_RULE = {
  version: 'roadmap-duration-ceiling-v1',
} as const;

export interface StagePlanningInput {
  /** Missing current e1RM means a current strength baseline must be recorded first. */
  readonly currentE1rmKg?: number | null;
  readonly finalGoalE1rmKg: number;
}

export type StagePlanningResult =
  | {
    readonly status: 'stage_planned';
    readonly currentE1rmKg: number;
    readonly finalGoalE1rmKg: number;
    readonly stageTargetE1rmKg: number;
    readonly ruleVersion: typeof STAGE_PLANNING_RULE.version;
  }
  | {
    readonly status: 'baseline_required';
    readonly finalGoalE1rmKg: number;
    readonly ruleVersion: typeof STAGE_PLANNING_RULE.version;
  }
  | {
    readonly status: 'goal_reached';
    readonly currentE1rmKg: number;
    readonly finalGoalE1rmKg: number;
    /** True means the persisted final goal is lower than the current strength. */
    readonly goalUpdateRequired: boolean;
    readonly ruleVersion: typeof STAGE_PLANNING_RULE.version;
  };

export type StagePlanningErrorCode = 'INVALID_INPUT' | 'INVALID_CURRENT_E1RM' | 'INVALID_FINAL_GOAL_E1RM';

export class StagePlanningError extends Error {
  public readonly name = 'StagePlanningError';

  public constructor(public readonly code: StagePlanningErrorCode) {
    super(`Invalid stage planning input: ${code}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Determine only the next boss strength requirement. This does not create a
 * roadmap, select a duration, or alter the user's final goal.
 */
export function planNextStage(input: StagePlanningInput): StagePlanningResult {
  if (!isRecord(input)) {
    throw new StagePlanningError('INVALID_INPUT');
  }
  if (!isPositiveFinite(input.finalGoalE1rmKg)) {
    throw new StagePlanningError('INVALID_FINAL_GOAL_E1RM');
  }

  const currentE1rmKg = input.currentE1rmKg;
  if (currentE1rmKg === undefined || currentE1rmKg === null) {
    return {
      status: 'baseline_required',
      finalGoalE1rmKg: input.finalGoalE1rmKg,
      ruleVersion: STAGE_PLANNING_RULE.version,
    };
  }
  if (!isPositiveFinite(currentE1rmKg)) {
    throw new StagePlanningError('INVALID_CURRENT_E1RM');
  }

  if (currentE1rmKg >= input.finalGoalE1rmKg) {
    return {
      status: 'goal_reached',
      currentE1rmKg,
      finalGoalE1rmKg: input.finalGoalE1rmKg,
      goalUpdateRequired: currentE1rmKg > input.finalGoalE1rmKg,
      ruleVersion: STAGE_PLANNING_RULE.version,
    };
  }

  return {
    status: 'stage_planned',
    currentE1rmKg,
    finalGoalE1rmKg: input.finalGoalE1rmKg,
    stageTargetE1rmKg: Math.min(input.finalGoalE1rmKg, currentE1rmKg + STAGE_PLANNING_RULE.stepKg),
    ruleVersion: STAGE_PLANNING_RULE.version,
  };
}

/** Input for the separate AI achievement-duration estimator use case. */
export interface AchievementDurationEstimatorInput {
  readonly exerciseId: ExerciseId;
  readonly currentE1rmKg: number;
  readonly stageTargetE1rmKg: number;
  readonly trainingExperienceMonths: number;
  readonly trainingFrequencyPerWeek: number;
}

export type AchievementDurationEstimatorInputErrorCode =
  | 'INVALID_INPUT_SHAPE'
  | 'INVALID_FIELD'
  | 'INVALID_EXERCISE_ID'
  | 'INVALID_CURRENT_E1RM'
  | 'INVALID_STAGE_TARGET_E1RM'
  | 'INVALID_TRAINING_EXPERIENCE_MONTHS'
  | 'INVALID_TRAINING_FREQUENCY_PER_WEEK';

export interface AchievementDurationEstimatorInputError {
  readonly code: AchievementDurationEstimatorInputErrorCode;
  readonly path: string;
}

export type AchievementDurationEstimatorInputValidationResult =
  | { readonly valid: true; readonly value: AchievementDurationEstimatorInput }
  | { readonly valid: false; readonly errors: readonly AchievementDurationEstimatorInputError[] };

/** Validate only the input's structure and established domain facts. */
export function validateAchievementDurationEstimatorInput(
  input: unknown,
): AchievementDurationEstimatorInputValidationResult {
  if (!isRecord(input)) {
    return { valid: false, errors: [{ code: 'INVALID_INPUT_SHAPE', path: 'input' }] };
  }

  const errors: AchievementDurationEstimatorInputError[] = [];
  const allowedFields = [
    'exerciseId',
    'currentE1rmKg',
    'stageTargetE1rmKg',
    'trainingExperienceMonths',
    'trainingFrequencyPerWeek',
  ];
  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) errors.push({ code: 'INVALID_FIELD', path: `input.${field}` });
  }

  if (typeof input.exerciseId !== 'string' || getExerciseById(input.exerciseId) === undefined) {
    errors.push({ code: 'INVALID_EXERCISE_ID', path: 'input.exerciseId' });
  }
  if (!isPositiveFinite(input.currentE1rmKg)) {
    errors.push({ code: 'INVALID_CURRENT_E1RM', path: 'input.currentE1rmKg' });
  }
  if (!isPositiveFinite(input.stageTargetE1rmKg) ||
      (isPositiveFinite(input.currentE1rmKg) && input.stageTargetE1rmKg <= input.currentE1rmKg)) {
    errors.push({ code: 'INVALID_STAGE_TARGET_E1RM', path: 'input.stageTargetE1rmKg' });
  }
  const trainingExperienceMonths = input.trainingExperienceMonths;
  if (typeof trainingExperienceMonths !== 'number' ||
      !Number.isSafeInteger(trainingExperienceMonths) || trainingExperienceMonths < 0) {
    errors.push({ code: 'INVALID_TRAINING_EXPERIENCE_MONTHS', path: 'input.trainingExperienceMonths' });
  }
  const trainingFrequencyPerWeek = input.trainingFrequencyPerWeek;
  if (typeof trainingFrequencyPerWeek !== 'number' ||
      !Number.isSafeInteger(trainingFrequencyPerWeek) || trainingFrequencyPerWeek <= 0) {
    errors.push({ code: 'INVALID_TRAINING_FREQUENCY_PER_WEEK', path: 'input.trainingFrequencyPerWeek' });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      exerciseId: input.exerciseId as ExerciseId,
      currentE1rmKg: input.currentE1rmKg as number,
      stageTargetE1rmKg: input.stageTargetE1rmKg as number,
      trainingExperienceMonths: trainingExperienceMonths as number,
      trainingFrequencyPerWeek: trainingFrequencyPerWeek as number,
    },
  };
}

export interface AchievementDurationEstimate {
  readonly estimatedAchievementDays: number;
}

export type AchievementDurationEstimateValidationResult =
  | { readonly valid: true; readonly value: AchievementDurationEstimate }
  | { readonly valid: false; readonly errors: readonly { code: 'INVALID_OUTPUT_SHAPE' | 'INVALID_OUTPUT_FIELD' | 'INVALID_ESTIMATED_ACHIEVEMENT_DAYS'; path: string }[] };

/** Validate the AI's deliberately small structured output before using it. */
export function validateAchievementDurationEstimate(
  output: unknown,
): AchievementDurationEstimateValidationResult {
  if (!isRecord(output)) {
    return { valid: false, errors: [{ code: 'INVALID_OUTPUT_SHAPE', path: 'output' }] };
  }

  const errors: { code: 'INVALID_OUTPUT_FIELD' | 'INVALID_ESTIMATED_ACHIEVEMENT_DAYS'; path: string }[] = [];
  for (const field of Object.keys(output)) {
    if (field !== 'estimatedAchievementDays') errors.push({ code: 'INVALID_OUTPUT_FIELD', path: `output.${field}` });
  }
  const estimatedAchievementDays = output.estimatedAchievementDays;
  if (typeof estimatedAchievementDays !== 'number' ||
      !Number.isSafeInteger(estimatedAchievementDays) || estimatedAchievementDays < 1) {
    errors.push({ code: 'INVALID_ESTIMATED_ACHIEVEMENT_DAYS', path: 'output.estimatedAchievementDays' });
  }
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, value: { estimatedAchievementDays: estimatedAchievementDays as number } };
}

export type RoadmapDurationSelectionResult =
  | {
    readonly status: 'roadmap_duration_selected';
    readonly estimatedAchievementDays: number;
    readonly selectedRoadmapDurationDays: (typeof ROADMAP_DURATION_CANDIDATES)[number];
    readonly ruleVersion: typeof ROADMAP_DURATION_SELECTION_RULE.version;
  }
  | {
    readonly status: 'stage_replanning_required';
    readonly estimatedAchievementDays: number;
    readonly ruleVersion: typeof ROADMAP_DURATION_SELECTION_RULE.version;
  };

export class RoadmapDurationSelectionError extends Error {
  public readonly name = 'RoadmapDurationSelectionError';

  public constructor(public readonly code: 'INVALID_ESTIMATED_ACHIEVEMENT_DAYS') {
    super(`Invalid roadmap duration estimate: ${code}`);
  }
}

/** Select the smallest Product duration candidate that is at least the AI estimate. */
export function selectRoadmapDuration(estimatedAchievementDays: number): RoadmapDurationSelectionResult {
  if (!Number.isSafeInteger(estimatedAchievementDays) || estimatedAchievementDays < 1) {
    throw new RoadmapDurationSelectionError('INVALID_ESTIMATED_ACHIEVEMENT_DAYS');
  }

  const selectedRoadmapDurationDays = ROADMAP_DURATION_CANDIDATES.find(
    (candidate) => candidate >= estimatedAchievementDays,
  );
  if (selectedRoadmapDurationDays === undefined) {
    return {
      status: 'stage_replanning_required',
      estimatedAchievementDays,
      ruleVersion: ROADMAP_DURATION_SELECTION_RULE.version,
    };
  }

  return {
    status: 'roadmap_duration_selected',
    estimatedAchievementDays,
    selectedRoadmapDurationDays,
    ruleVersion: ROADMAP_DURATION_SELECTION_RULE.version,
  };
}
