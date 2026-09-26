import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveStageOneQuickStart,
  STAGE_ONE_QUICK_START_RULE,
} from '../dist/index.js';

const profile = { currentE1rmKg: 40, finalGoalE1rmKg: 60 };

test('keeps the original +5kg target and selects the Stage 1 ceiling for estimates within 28 days', () => {
  const result = resolveStageOneQuickStart(profile, { estimatedAchievementDays: 18 });
  assert.equal(result.status, 'stage_one_plan_selected');
  assert.equal(result.estimatedAchievementDays, 18);
  assert.equal(result.selectedRoadmapDurationDays, 21);
  assert.deepEqual(result.metadata, {
    ruleVersion: STAGE_ONE_QUICK_START_RULE.version,
    originalPlannedStageTargetE1rmKg: 45,
    selectedStageTargetE1rmKg: 45,
    firstEstimatedAchievementDays: 18,
    selectedTargetEstimatedAchievementDays: 18,
    selectedDurationDays: 21,
    quickStartAdjusted: false,
  });
});

test('requires exactly one reduced-target estimate when the first estimate exceeds 28 days', () => {
  assert.deepEqual(resolveStageOneQuickStart(profile, { estimatedAchievementDays: 35 }), {
    status: 'reduced_target_estimate_required',
    originalPlannedStageTargetE1rmKg: 45,
    reducedStageTargetE1rmKg: 42.5,
    firstEstimatedAchievementDays: 35,
    ruleVersion: STAGE_ONE_QUICK_START_RULE.version,
  });
});

test('re-estimates the +2.5kg target and chooses its 14/21/28-day ceiling', () => {
  const result = resolveStageOneQuickStart(
    profile,
    { estimatedAchievementDays: 38 },
    { estimatedAchievementDays: 19 },
  );
  assert.equal(result.status, 'stage_one_plan_selected');
  assert.equal(result.estimatedAchievementDays, 19);
  assert.equal(result.selectedRoadmapDurationDays, 21);
  assert.equal(result.metadata.originalPlannedStageTargetE1rmKg, 45);
  assert.equal(result.metadata.selectedStageTargetE1rmKg, 42.5);
  assert.equal(result.metadata.firstEstimatedAchievementDays, 38);
  assert.equal(result.metadata.quickStartAdjusted, true);
});

test('a reduced estimate above 28 starts a maximum 28-day challenge without claiming success', () => {
  const result = resolveStageOneQuickStart(
    profile,
    { estimatedAchievementDays: 35 },
    { estimatedAchievementDays: 35 },
  );
  assert.equal(result.status, 'stage_one_plan_selected');
  assert.equal(result.selectedRoadmapDurationDays, 28);
  assert.equal(result.metadata.selectedStageTargetE1rmKg, 42.5);
  assert.equal(result.estimatedAchievementDays, 35);
});

test('a reduced estimate of 27 days selects the 28-day Stage 1 candidate', () => {
  const result = resolveStageOneQuickStart(
    profile,
    { estimatedAchievementDays: 35 },
    { estimatedAchievementDays: 27 },
  );
  assert.equal(result.status, 'stage_one_plan_selected');
  assert.equal(result.estimatedAchievementDays, 27);
  assert.equal(result.selectedRoadmapDurationDays, 28);
  assert.equal(result.metadata.selectedStageTargetE1rmKg, 42.5);
});

test('final goal caps both targets and avoids an unnecessary second estimate', () => {
  const result = resolveStageOneQuickStart(
    { currentE1rmKg: 40, finalGoalE1rmKg: 42 },
    { estimatedAchievementDays: 35 },
  );
  assert.equal(result.status, 'stage_one_plan_selected');
  assert.equal(result.selectedRoadmapDurationDays, 28);
  assert.equal(result.metadata.originalPlannedStageTargetE1rmKg, 42);
  assert.equal(result.metadata.selectedStageTargetE1rmKg, 42);
  assert.equal(result.metadata.quickStartAdjusted, false);
});

test('a close but higher final goal still caps a reduced Stage 1 target', () => {
  const result = resolveStageOneQuickStart(
    { currentE1rmKg: 40, finalGoalE1rmKg: 43 },
    { estimatedAchievementDays: 35 },
    { estimatedAchievementDays: 18 },
  );
  assert.equal(result.status, 'stage_one_plan_selected');
  assert.equal(result.metadata.selectedStageTargetE1rmKg, 42.5);
  assert.equal(result.selectedRoadmapDurationDays, 21);
});

test('invalid estimator output remains explicit and a reached goal creates no Stage 1 plan', () => {
  assert.deepEqual(resolveStageOneQuickStart(profile, { estimatedAchievementDays: 0 }), {
    status: 'invalid_duration_estimate',
  });
  assert.deepEqual(resolveStageOneQuickStart(
    profile,
    { estimatedAchievementDays: 35 },
    { estimatedAchievementDays: 0 },
  ), { status: 'invalid_duration_estimate' });
  assert.deepEqual(resolveStageOneQuickStart(
    { currentE1rmKg: 60, finalGoalE1rmKg: 60 },
    { estimatedAchievementDays: 14 },
  ), { status: 'stage_not_planned', estimatedAchievementDays: 14 });
});
