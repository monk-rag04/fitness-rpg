import { calculateSetE1rm, E1RM_RULE, isBossE1rmExerciseId } from './e1rm.js';
import { estimateMainStrengthProfile, type MainStrengthProfileEstimate } from './mainStrengthEstimate.js';
import type { ExerciseId } from './exercise.js';
import { getExerciseById } from './exerciseCatalog.js';
import {
  planNextStage,
  ROADMAP_DURATION_CANDIDATES,
  selectRoadmapDuration,
  validateAchievementDurationEstimate,
  type AchievementDurationEstimatorInput,
  type StagePlanningResult,
} from './stagePlanning.js';
import {
  generateStageRoadmap,
  isValidLocalDate,
  type LocalDate,
  type StageRoadmap,
} from './stageRoadmap.js';
import { createInitialStageProgress, type StageProgress } from './stageProgress.js';

/** D-029 input for one new roadmap, not a persisted profile or Workout Result. */
export interface OnboardingRoadmapInput {
  /** Present only for a profile-derived, provisional starting strength. */
  readonly strengthKnowledge?: 'unknown';
  readonly bodyWeightKg: number;
  readonly trainingExperienceMonths: number;
  readonly trainingFrequencyPerWeek: number;
  readonly mainExerciseId: ExerciseId;
  /** Both baseline fields may be absent when the user does not know a recent set. */
  readonly baselineWeightKg?: number | null;
  readonly baselineReps?: number | null;
  readonly finalGoalE1rmKg: number;
  readonly startDate: LocalDate;
}

export interface OnboardingSelfReportedBaseline {
  readonly source: 'onboarding_self_reported';
  readonly exerciseId: ExerciseId;
  readonly weightKg: number;
  readonly reps: number;
  readonly baselineE1rmKg: number;
  readonly ruleVersion: typeof E1RM_RULE.version;
}

export interface OnboardingEstimatedProfileBaseline {
  readonly source: 'estimated_profile';
  readonly exerciseId: ExerciseId;
  readonly weightKg: number;
  readonly reps: number;
  readonly baselineE1rmKg: number;
  readonly ruleVersion: typeof E1RM_RULE.version;
  readonly estimateRuleVersion: MainStrengthProfileEstimate['ruleVersion'];
}

export type OnboardingBaseline = OnboardingSelfReportedBaseline | OnboardingEstimatedProfileBaseline;

export type OnboardingRoadmapInputErrorCode =
  | 'INVALID_INPUT_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'INVALID_BODY_WEIGHT'
  | 'INVALID_TRAINING_EXPERIENCE_MONTHS'
  | 'INVALID_TRAINING_FREQUENCY'
  | 'UNKNOWN_MAIN_EXERCISE'
  | 'MAIN_EXERCISE_NOT_BOSS_ELIGIBLE'
  | 'BASELINE_SET_INCOMPLETE'
  | 'INVALID_BASELINE_WEIGHT'
  | 'INVALID_BASELINE_REPS'
  | 'INVALID_BASELINE_ESTIMATE'
  | 'INVALID_FINAL_GOAL'
  | 'FINAL_GOAL_NOT_ABOVE_BASELINE'
  | 'INVALID_STRENGTH_KNOWLEDGE'
  | 'UNKNOWN_STRENGTH_FIELDS_NOT_ALLOWED'
  | 'ESTIMATE_UNAVAILABLE'
  | 'INVALID_START_DATE';

export interface OnboardingRoadmapInputError {
  readonly code: OnboardingRoadmapInputErrorCode;
  readonly path: string;
}

export type OnboardingRoadmapInputValidationResult =
  | {
    readonly valid: true;
    readonly value: OnboardingRoadmapInput;
    readonly baseline: OnboardingBaseline | null;
  }
  | { readonly valid: false; readonly errors: readonly OnboardingRoadmapInputError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isMissing(value: unknown): value is undefined | null {
  return value === undefined || value === null;
}

/** Reject untrusted fields and derive only the explicitly requested provisional profile estimate. */
export function validateOnboardingRoadmapInput(input: unknown): OnboardingRoadmapInputValidationResult {
  if (!isRecord(input)) {
    return { valid: false, errors: [{ code: 'INVALID_INPUT_SHAPE', path: 'input' }] };
  }

  const errors: OnboardingRoadmapInputError[] = [];
  const allowedFields = [
    'bodyWeightKg', 'trainingExperienceMonths', 'trainingFrequencyPerWeek',
    'mainExerciseId', 'baselineWeightKg', 'baselineReps',
    'finalGoalE1rmKg', 'startDate', 'strengthKnowledge',
  ];
  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) errors.push({ code: 'UNKNOWN_FIELD', path: `input.${field}` });
  }
  const unknownStrength = input.strengthKnowledge === 'unknown';
  if (input.strengthKnowledge !== undefined && !unknownStrength) {
    errors.push({ code: 'INVALID_STRENGTH_KNOWLEDGE', path: 'input.strengthKnowledge' });
  }

  if (!isPositiveFinite(input.bodyWeightKg)) {
    errors.push({ code: 'INVALID_BODY_WEIGHT', path: 'input.bodyWeightKg' });
  }
  if (!isNonnegativeInteger(input.trainingExperienceMonths)) {
    errors.push({ code: 'INVALID_TRAINING_EXPERIENCE_MONTHS', path: 'input.trainingExperienceMonths' });
  }
  if (!isNonnegativeInteger(input.trainingFrequencyPerWeek) ||
      input.trainingFrequencyPerWeek < 1 || input.trainingFrequencyPerWeek > 7) {
    errors.push({ code: 'INVALID_TRAINING_FREQUENCY', path: 'input.trainingFrequencyPerWeek' });
  }

  const mainExercise = typeof input.mainExerciseId === 'string'
    ? getExerciseById(input.mainExerciseId)
    : undefined;
  if (mainExercise === undefined) {
    errors.push({ code: 'UNKNOWN_MAIN_EXERCISE', path: 'input.mainExerciseId' });
  } else if (!isBossE1rmExerciseId(mainExercise.id)) {
    errors.push({ code: 'MAIN_EXERCISE_NOT_BOSS_ELIGIBLE', path: 'input.mainExerciseId' });
  }

  const weightMissing = isMissing(input.baselineWeightKg);
  const repsMissing = isMissing(input.baselineReps);
  if (unknownStrength) {
    if (['baselineWeightKg', 'baselineReps', 'finalGoalE1rmKg'].some((field) => Object.hasOwn(input, field))) {
      errors.push({ code: 'UNKNOWN_STRENGTH_FIELDS_NOT_ALLOWED', path: 'input.strengthKnowledge' });
    }
  } else {
    if (weightMissing !== repsMissing) {
      errors.push({ code: 'BASELINE_SET_INCOMPLETE', path: 'input.baselineWeightKg' });
    }
    if (!weightMissing && !isPositiveFinite(input.baselineWeightKg)) {
      errors.push({ code: 'INVALID_BASELINE_WEIGHT', path: 'input.baselineWeightKg' });
    }
    if (!repsMissing && (!isNonnegativeInteger(input.baselineReps) ||
        input.baselineReps < E1RM_RULE.minEligibleReps || input.baselineReps > E1RM_RULE.maxEligibleReps)) {
      errors.push({ code: 'INVALID_BASELINE_REPS', path: 'input.baselineReps' });
    }
    if (!isPositiveFinite(input.finalGoalE1rmKg)) {
      errors.push({ code: 'INVALID_FINAL_GOAL', path: 'input.finalGoalE1rmKg' });
    }
  }
  if (!isValidLocalDate(input.startDate)) {
    errors.push({ code: 'INVALID_START_DATE', path: 'input.startDate' });
  }
  if (errors.length > 0) return { valid: false, errors };

  if (unknownStrength) {
    const estimate = estimateMainStrengthProfile({
      bodyWeightKg: input.bodyWeightKg as number,
      trainingExperienceMonths: input.trainingExperienceMonths as number,
      mainExerciseId: mainExercise!.id,
    });
    if (estimate === null) {
      return { valid: false, errors: [{ code: 'ESTIMATE_UNAVAILABLE', path: 'input.bodyWeightKg' }] };
    }
    return {
      valid: true,
      value: {
        bodyWeightKg: input.bodyWeightKg as number,
        trainingExperienceMonths: input.trainingExperienceMonths as number,
        trainingFrequencyPerWeek: input.trainingFrequencyPerWeek as number,
        mainExerciseId: mainExercise!.id,
        baselineWeightKg: estimate.workingWeightKg,
        baselineReps: estimate.workingReps,
        finalGoalE1rmKg: estimate.finalGoalE1rmKg,
        startDate: input.startDate as LocalDate,
        strengthKnowledge: 'unknown',
      },
      baseline: {
        source: 'estimated_profile',
        exerciseId: mainExercise!.id,
        weightKg: estimate.workingWeightKg,
        reps: estimate.workingReps,
        baselineE1rmKg: estimate.baselineE1rmKg,
        ruleVersion: E1RM_RULE.version,
        estimateRuleVersion: estimate.ruleVersion,
      },
    };
  }

  let baseline: OnboardingSelfReportedBaseline | null = null;
  if (!weightMissing) {
    try {
      const estimate = calculateSetE1rm({
        weightKg: input.baselineWeightKg as number,
        reps: input.baselineReps as number,
      });
      if (!estimate.eligible) {
        return { valid: false, errors: [{ code: 'INVALID_BASELINE_REPS', path: 'input.baselineReps' }] };
      }
      baseline = {
        source: 'onboarding_self_reported',
        exerciseId: mainExercise!.id,
        weightKg: input.baselineWeightKg as number,
        reps: input.baselineReps as number,
        baselineE1rmKg: estimate.estimated1rmKg,
        ruleVersion: estimate.ruleVersion,
      };
    } catch {
      return { valid: false, errors: [{ code: 'INVALID_BASELINE_ESTIMATE', path: 'input.baselineWeightKg' }] };
    }
  }
  if (baseline !== null && (input.finalGoalE1rmKg as number) <= baseline.baselineE1rmKg) {
    return {
      valid: false,
      errors: [{ code: 'FINAL_GOAL_NOT_ABOVE_BASELINE', path: 'input.finalGoalE1rmKg' }],
    };
  }

  return {
    valid: true,
    value: {
      bodyWeightKg: input.bodyWeightKg as number,
      trainingExperienceMonths: input.trainingExperienceMonths as number,
      trainingFrequencyPerWeek: input.trainingFrequencyPerWeek as number,
      mainExerciseId: mainExercise!.id,
      baselineWeightKg: weightMissing ? null : input.baselineWeightKg as number,
      baselineReps: repsMissing ? null : input.baselineReps as number,
      finalGoalE1rmKg: input.finalGoalE1rmKg as number,
      startDate: input.startDate as LocalDate,
    },
    baseline,
  };
}

export interface OnboardingRoadmapReadyForEstimate {
  readonly status: 'ready_for_duration_estimate';
  readonly input: OnboardingRoadmapInput;
  readonly baseline: OnboardingBaseline;
  readonly stage: Extract<StagePlanningResult, { readonly status: 'stage_planned' }>;
  readonly durationInput: AchievementDurationEstimatorInput;
}

export type OnboardingRoadmapPreparationResult =
  | { readonly status: 'invalid_input'; readonly errors: readonly OnboardingRoadmapInputError[] }
  | { readonly status: 'baseline_required'; readonly input: OnboardingRoadmapInput }
  | OnboardingRoadmapReadyForEstimate;

/** Pure first half of the application flow; no AI call or Workout History mutation. */
export function prepareOnboardingRoadmap(input: unknown): OnboardingRoadmapPreparationResult {
  const validation = validateOnboardingRoadmapInput(input);
  if (!validation.valid) return { status: 'invalid_input', errors: validation.errors };

  const stage = planNextStage({
    currentE1rmKg: validation.baseline?.baselineE1rmKg,
    finalGoalE1rmKg: validation.value.finalGoalE1rmKg,
  });
  if (stage.status === 'baseline_required') {
    return { status: 'baseline_required', input: validation.value };
  }
  if (stage.status !== 'stage_planned' || validation.baseline === null) {
    throw new Error('Validated onboarding goal must produce a new stage.');
  }
  return {
    status: 'ready_for_duration_estimate',
    input: validation.value,
    baseline: validation.baseline,
    stage,
    durationInput: {
      exerciseId: validation.value.mainExerciseId,
      currentE1rmKg: validation.baseline.baselineE1rmKg,
      stageTargetE1rmKg: stage.stageTargetE1rmKg,
      trainingExperienceMonths: validation.value.trainingExperienceMonths,
      trainingFrequencyPerWeek: validation.value.trainingFrequencyPerWeek,
    },
  };
}

export type OnboardingRoadmapCompletionResult =
  | { readonly status: 'invalid_duration_estimate' }
  | { readonly status: 'stage_replanning_required'; readonly estimatedAchievementDays: number }
  | {
    readonly status: 'roadmap_created';
    readonly input: OnboardingRoadmapInput;
    readonly baseline: OnboardingBaseline;
    readonly stage: OnboardingRoadmapReadyForEstimate['stage'];
    readonly estimatedAchievementDays: number;
    readonly selectedRoadmapDurationDays: StageRoadmap['durationDays'];
    readonly roadmap: StageRoadmap;
    readonly progress: StageProgress;
  };

/** Pure second half; the caller supplies the already-fetched AI proposal. */
export function completeOnboardingRoadmap(
  prepared: OnboardingRoadmapReadyForEstimate,
  durationResponse: unknown,
): OnboardingRoadmapCompletionResult {
  const estimate = validateAchievementDurationEstimate(durationResponse);
  if (!estimate.valid) return { status: 'invalid_duration_estimate' };

  const selection = selectRoadmapDuration(estimate.value.estimatedAchievementDays);
  if (selection.status === 'stage_replanning_required') {
    if (prepared.baseline.source !== 'estimated_profile') {
      return { status: 'stage_replanning_required', estimatedAchievementDays: selection.estimatedAchievementDays };
    }

    // D-041 resilience: an unknown-strength newcomer has no better manual value
    // to edit. Keep D-025 unchanged for known strength, avoid provider retries,
    // and use the largest established Roadmap duration for this provisional case.
    const selectedRoadmapDurationDays = ROADMAP_DURATION_CANDIDATES[ROADMAP_DURATION_CANDIDATES.length - 1];
    const roadmap = generateStageRoadmap({
      startDate: prepared.input.startDate,
      durationDays: selectedRoadmapDurationDays,
      trainingFrequencyPerWeek: prepared.input.trainingFrequencyPerWeek,
      mainExerciseId: prepared.input.mainExerciseId,
      stageTargetE1rmKg: prepared.stage.stageTargetE1rmKg,
    });
    return {
      status: 'roadmap_created',
      input: prepared.input,
      baseline: prepared.baseline,
      stage: prepared.stage,
      estimatedAchievementDays: selection.estimatedAchievementDays,
      selectedRoadmapDurationDays,
      roadmap,
      progress: createInitialStageProgress(roadmap),
    };
  }
  const roadmap = generateStageRoadmap({
    startDate: prepared.input.startDate,
    durationDays: selection.selectedRoadmapDurationDays,
    trainingFrequencyPerWeek: prepared.input.trainingFrequencyPerWeek,
    mainExerciseId: prepared.input.mainExerciseId,
    stageTargetE1rmKg: prepared.stage.stageTargetE1rmKg,
  });
  return {
    status: 'roadmap_created',
    input: prepared.input,
    baseline: prepared.baseline,
    stage: prepared.stage,
    estimatedAchievementDays: selection.estimatedAchievementDays,
    selectedRoadmapDurationDays: selection.selectedRoadmapDurationDays,
    roadmap,
    progress: createInitialStageProgress(roadmap),
  };
}
