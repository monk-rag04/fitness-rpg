import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ROADMAP_DURATION_CANDIDATES,
  ROADMAP_DURATION_SELECTION_RULE,
  STAGE_ONE_QUICK_START_RULE,
  STAGE_ONE_ROADMAP_DURATION_CANDIDATES,
  STAGE_PLANNING_RULE,
  RoadmapDurationSelectionError,
  StagePlanningError,
  planNextStage,
  getRoadmapDurationCandidatesForStage,
  selectRoadmapDuration,
  selectRoadmapDurationForStage,
  validateAchievementDurationEstimate,
  validateAchievementDurationEstimatorInput,
} from '../dist/index.js';

function validEstimatorInput(overrides = {}) {
  return {
    exerciseId: 'barbell_bench_press',
    currentE1rmKg: 70,
    stageTargetE1rmKg: 75,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: 3,
    ...overrides,
  };
}

function inputCodes(input) {
  const result = validateAchievementDurationEstimatorInput(input);
  assert.equal(result.valid, false);
  return result.errors.map((error) => error.code);
}

test('plans the next fixed 5kg stage target', () => {
  const result = planNextStage({ currentE1rmKg: 70, finalGoalE1rmKg: 90 });
  assert.deepEqual(result, {
    status: 'stage_planned',
    currentE1rmKg: 70,
    finalGoalE1rmKg: 90,
    stageTargetE1rmKg: 75,
    ruleVersion: STAGE_PLANNING_RULE.version,
  });
});

test('caps the next fixed step at the final goal', () => {
  const result = planNextStage({ currentE1rmKg: 85, finalGoalE1rmKg: 88 });
  assert.equal(result.status, 'stage_planned');
  assert.equal(result.stageTargetE1rmKg, 88);
});

test('does not change the final goal while planning a stage', () => {
  const input = { currentE1rmKg: 70, finalGoalE1rmKg: 88 };
  const result = planNextStage(input);
  assert.equal(input.finalGoalE1rmKg, 88);
  assert.equal(result.finalGoalE1rmKg, 88);
});

test('returns goal reached when current e1RM equals the final goal', () => {
  assert.deepEqual(planNextStage({ currentE1rmKg: 80, finalGoalE1rmKg: 80 }), {
    status: 'goal_reached',
    currentE1rmKg: 80,
    finalGoalE1rmKg: 80,
    goalUpdateRequired: false,
    ruleVersion: STAGE_PLANNING_RULE.version,
  });
});

test('does not lower a stage when current e1RM exceeds the final goal', () => {
  assert.deepEqual(planNextStage({ currentE1rmKg: 85, finalGoalE1rmKg: 80 }), {
    status: 'goal_reached',
    currentE1rmKg: 85,
    finalGoalE1rmKg: 80,
    goalUpdateRequired: true,
    ruleVersion: STAGE_PLANNING_RULE.version,
  });
});

test('requires a baseline when current e1RM is null or missing', () => {
  for (const input of [
    { currentE1rmKg: null, finalGoalE1rmKg: 80 },
    { finalGoalE1rmKg: 80 },
  ]) {
    assert.equal(planNextStage(input).status, 'baseline_required');
  }
});

test('rejects invalid current and final e1RM values', () => {
  for (const currentE1rmKg of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => planNextStage({ currentE1rmKg, finalGoalE1rmKg: 80 }),
      (error) => error instanceof StagePlanningError && error.code === 'INVALID_CURRENT_E1RM',
    );
  }
  for (const finalGoalE1rmKg of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => planNextStage({ currentE1rmKg: 70, finalGoalE1rmKg }),
      (error) => error instanceof StagePlanningError && error.code === 'INVALID_FINAL_GOAL_E1RM',
    );
  }
});

test('stage planning rule is versioned and owns the 5kg step', () => {
  assert.deepEqual(STAGE_PLANNING_RULE, { version: 'stage-target-fixed-5kg-v1', stepKg: 5 });
});

test('validates the achievement duration estimator input', () => {
  const result = validateAchievementDurationEstimatorInput(validEstimatorInput());
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, validEstimatorInput());
});

test('rejects unknown exercises and invalid e1RM boundaries', () => {
  assert.ok(inputCodes(validEstimatorInput({ exerciseId: 'not_in_catalog' })).includes('INVALID_EXERCISE_ID'));
  for (const currentE1rmKg of [0, -1, NaN, Infinity, -Infinity]) {
    assert.ok(inputCodes(validEstimatorInput({ currentE1rmKg })).includes('INVALID_CURRENT_E1RM'));
  }
  for (const stageTargetE1rmKg of [70, 69, 0, NaN, Infinity]) {
    assert.ok(inputCodes(validEstimatorInput({ stageTargetE1rmKg })).includes('INVALID_STAGE_TARGET_E1RM'));
  }
});

test('rejects invalid experience and frequency but does not infer a frequency ceiling', () => {
  for (const trainingExperienceMonths of [-1, 1.5, NaN, Infinity]) {
    assert.ok(inputCodes(validEstimatorInput({ trainingExperienceMonths }))
      .includes('INVALID_TRAINING_EXPERIENCE_MONTHS'));
  }
  for (const trainingFrequencyPerWeek of [0, -1, 1.5, NaN, Infinity]) {
    assert.ok(inputCodes(validEstimatorInput({ trainingFrequencyPerWeek }))
      .includes('INVALID_TRAINING_FREQUENCY_PER_WEEK'));
  }
  assert.equal(validateAchievementDurationEstimatorInput(validEstimatorInput({ trainingFrequencyPerWeek: 99 })).valid, true);
});

test('rejects unknown fields in estimator input', () => {
  assert.ok(inputCodes(validEstimatorInput({ unexpected: true })).includes('INVALID_FIELD'));
});

test('validates the deliberately small AI output', () => {
  assert.deepEqual(validateAchievementDurationEstimate({ estimatedAchievementDays: 24 }), {
    valid: true,
    value: { estimatedAchievementDays: 24 },
  });
  for (const output of [
    { estimatedAchievementDays: 24, confidence: 0.8 },
    { estimatedAchievementDays: 0 },
    { estimatedAchievementDays: 1.5 },
    { estimatedAchievementDays: NaN },
  ]) {
    assert.equal(validateAchievementDurationEstimate(output).valid, false);
  }
});

for (const [estimate, duration] of [
  [1, 14], [9, 14], [14, 14], [15, 21], [21, 21], [22, 28], [24, 28],
  [28, 28], [29, 35], [35, 35], [36, 42], [42, 42],
]) {
  test(`selects ${duration} days by ceiling for estimate ${estimate}`, () => {
    const result = selectRoadmapDuration(estimate);
    assert.equal(result.status, 'roadmap_duration_selected');
    assert.equal(result.selectedRoadmapDurationDays, duration);
    assert.equal(result.estimatedAchievementDays, estimate);
  });
}

test('requires stage replanning instead of clamping estimates above 42 days', () => {
  for (const estimate of [43, 60]) {
    assert.deepEqual(selectRoadmapDuration(estimate), {
      status: 'stage_replanning_required',
      estimatedAchievementDays: estimate,
      ruleVersion: ROADMAP_DURATION_SELECTION_RULE.version,
    });
  }
});

test('rejects invalid duration estimates', () => {
  for (const estimate of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => selectRoadmapDuration(estimate),
      (error) => error instanceof RoadmapDurationSelectionError && error.code === 'INVALID_ESTIMATED_ACHIEVEMENT_DAYS',
    );
  }
});

test('duration candidates and selection rule are defined once and versioned', () => {
  assert.deepEqual(ROADMAP_DURATION_CANDIDATES, [14, 21, 28, 35, 42]);
  assert.deepEqual(STAGE_ONE_ROADMAP_DURATION_CANDIDATES, [14, 21, 28]);
  assert.deepEqual(ROADMAP_DURATION_SELECTION_RULE, { version: 'roadmap-duration-ceiling-v1' });
  assert.deepEqual(STAGE_ONE_QUICK_START_RULE, {
    version: 'stage-one-quick-start-v1', reducedTargetStepKg: 2.5, maxDurationDays: 28,
  });
  assert.deepEqual(getRoadmapDurationCandidatesForStage(1), [14, 21, 28]);
  assert.deepEqual(getRoadmapDurationCandidatesForStage(2), [14, 21, 28, 35, 42]);
});

for (const [estimate, duration] of [
  [10, 14], [14, 14], [15, 21], [21, 21], [22, 28], [28, 28],
]) {
  test(`Stage 1 selects ${duration} days for estimate ${estimate}`, () => {
    const result = selectRoadmapDurationForStage(1, estimate);
    assert.equal(result.status, 'roadmap_duration_selected');
    assert.equal(result.selectedRoadmapDurationDays, duration);
    assert.equal(result.ruleVersion, STAGE_ONE_QUICK_START_RULE.version);
  });
}

test('Stage 1 does not expose standard 35/42-day duration candidates', () => {
  assert.deepEqual(selectRoadmapDurationForStage(1, 35), {
    status: 'stage_replanning_required',
    estimatedAchievementDays: 35,
    ruleVersion: STAGE_ONE_QUICK_START_RULE.version,
  });
  assert.equal(selectRoadmapDurationForStage(2, 35).selectedRoadmapDurationDays, 35);
  assert.equal(selectRoadmapDurationForStage(2, 42).selectedRoadmapDurationDays, 42);
});
