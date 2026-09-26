import {
  getRoadmapDurationCandidatesForStage,
  planNextStage,
  selectRoadmapDurationForStage,
  STAGE_ONE_QUICK_START_RULE,
  validateAchievementDurationEstimate,
  type RoadmapDurationCandidate,
} from './stagePlanning.js';

export interface StageOneQuickStartEstimateInput {
  readonly currentE1rmKg: number;
  readonly finalGoalE1rmKg: number;
}

export interface StageOneQuickStartMetadata {
  readonly ruleVersion: typeof STAGE_ONE_QUICK_START_RULE.version;
  readonly originalPlannedStageTargetE1rmKg: number;
  readonly selectedStageTargetE1rmKg: number;
  readonly firstEstimatedAchievementDays: number;
  readonly selectedTargetEstimatedAchievementDays: number;
  readonly selectedDurationDays: RoadmapDurationCandidate;
  readonly quickStartAdjusted: boolean;
}

export type StageOneQuickStartResolution =
  | { readonly status: 'invalid_duration_estimate' }
  | { readonly status: 'stage_not_planned'; readonly estimatedAchievementDays: number }
  | {
    readonly status: 'reduced_target_estimate_required';
    readonly originalPlannedStageTargetE1rmKg: number;
    readonly reducedStageTargetE1rmKg: number;
    readonly firstEstimatedAchievementDays: number;
    readonly ruleVersion: typeof STAGE_ONE_QUICK_START_RULE.version;
  }
  | {
    readonly status: 'stage_one_plan_selected';
    readonly estimatedAchievementDays: number;
    readonly selectedRoadmapDurationDays: RoadmapDurationCandidate;
    readonly metadata: StageOneQuickStartMetadata;
  };

/**
 * Resolve Stage 1's two-estimate planning rule. A >28-day first estimate gets
 * one smaller-target estimate when the final-goal cap permits a smaller target;
 * otherwise 28 days is the maximum first challenge window.
 */
export function resolveStageOneQuickStart(
  input: StageOneQuickStartEstimateInput,
  firstDurationResponse: unknown,
  reducedTargetDurationResponse?: unknown,
): StageOneQuickStartResolution {
  const firstEstimate = validateAchievementDurationEstimate(firstDurationResponse);
  if (!firstEstimate.valid) return { status: 'invalid_duration_estimate' };

  const stage = planNextStage(input);
  if (stage.status !== 'stage_planned') {
    return { status: 'stage_not_planned', estimatedAchievementDays: firstEstimate.value.estimatedAchievementDays };
  }

  let selectedStageTargetE1rmKg = stage.stageTargetE1rmKg;
  let selectedEstimateDays = firstEstimate.value.estimatedAchievementDays;
  if (selectedEstimateDays > STAGE_ONE_QUICK_START_RULE.maxDurationDays) {
    const reducedTarget = Math.min(
      input.finalGoalE1rmKg,
      input.currentE1rmKg + STAGE_ONE_QUICK_START_RULE.reducedTargetStepKg,
    );
    if (reducedTarget < stage.stageTargetE1rmKg) {
      if (reducedTargetDurationResponse === undefined) {
        return {
          status: 'reduced_target_estimate_required',
          originalPlannedStageTargetE1rmKg: stage.stageTargetE1rmKg,
          reducedStageTargetE1rmKg: reducedTarget,
          firstEstimatedAchievementDays: selectedEstimateDays,
          ruleVersion: STAGE_ONE_QUICK_START_RULE.version,
        };
      }
      const reducedEstimate = validateAchievementDurationEstimate(reducedTargetDurationResponse);
      if (!reducedEstimate.valid) return { status: 'invalid_duration_estimate' };
      selectedStageTargetE1rmKg = reducedTarget;
      selectedEstimateDays = reducedEstimate.value.estimatedAchievementDays;
    }
  }

  const selection = selectRoadmapDurationForStage(1, selectedEstimateDays);
  // Stage 1 remains startable when even the reduced-target estimate exceeds 28.
  const candidates = getRoadmapDurationCandidatesForStage(1);
  const selectedRoadmapDurationDays = selection.status === 'roadmap_duration_selected'
    ? selection.selectedRoadmapDurationDays
    : candidates[candidates.length - 1]!;
  const metadata: StageOneQuickStartMetadata = {
    ruleVersion: STAGE_ONE_QUICK_START_RULE.version,
    originalPlannedStageTargetE1rmKg: stage.stageTargetE1rmKg,
    selectedStageTargetE1rmKg,
    firstEstimatedAchievementDays: firstEstimate.value.estimatedAchievementDays,
    selectedTargetEstimatedAchievementDays: selectedEstimateDays,
    selectedDurationDays: selectedRoadmapDurationDays,
    quickStartAdjusted: selectedStageTargetE1rmKg < stage.stageTargetE1rmKg,
  };
  return {
    status: 'stage_one_plan_selected',
    estimatedAchievementDays: selectedEstimateDays,
    selectedRoadmapDurationDays,
    metadata,
  };
}
