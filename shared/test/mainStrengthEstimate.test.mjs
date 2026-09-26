import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ESTIMATED_GOAL_HORIZON_DAYS,
  MAIN_STRENGTH_ESTIMATE_RULE_VERSION,
  calculateSetE1rm,
  estimateMainStrengthProfile,
} from '../dist/index.js';

const multipliers = [
  ['barbell_bench_press', 0.55],
  ['barbell_back_squat', 0.75],
  ['barbell_deadlift', 0.90],
  ['barbell_overhead_press', 0.35],
];

for (const [mainExerciseId, multiplier] of multipliers) {
  test(`${mainExerciseId} estimate uses its versioned exercise multiplier`, () => {
    const result = estimateMainStrengthProfile({
      bodyWeightKg: 60, trainingExperienceMonths: 1, mainExerciseId,
    });
    assert.equal(result.ruleVersion, MAIN_STRENGTH_ESTIMATE_RULE_VERSION);
    assert.equal(result.estimatedE1rmKg, Math.round(60 * multiplier * 2) / 2);
    assert.equal(result.workingReps, 5);
    assert.equal(result.workingWeightKg * 2, Math.round(result.workingWeightKg * 2));
    assert.equal(result.baselineE1rmKg, calculateSetE1rm({
      weightKg: result.workingWeightKg, reps: 5,
    }).estimated1rmKg);
    assert.ok(Math.abs(result.workingWeightKg - result.estimatedE1rmKg / (1 + 5 / 30)) <= 0.25);
    assert.equal(result.goalHorizonDays, ESTIMATED_GOAL_HORIZON_DAYS);
    assert.ok(result.finalGoalE1rmKg >= result.baselineE1rmKg + 2.5);
  });
}

test('history bins adjust strength and approximately three-month growth', () => {
  const expected = [
    [2, 1.00, 1.20], [3, 1.05, 1.18],
    [6, 1.10, 1.15], [12, 1.15, 1.10],
  ];
  for (const [trainingExperienceMonths, strength, growth] of expected) {
    const result = estimateMainStrengthProfile({
      bodyWeightKg: 100, trainingExperienceMonths,
      mainExerciseId: 'barbell_bench_press',
    });
    assert.equal(result.estimatedE1rmKg, Math.round(100 * 0.55 * strength * 2) / 2);
    assert.equal(result.finalGoalE1rmKg, Math.round(result.estimatedE1rmKg * growth * 2) / 2);
    assert.ok(result.finalGoalE1rmKg > result.estimatedE1rmKg);
  }
});

test('invalid or unsupported profile never fabricates an estimate', () => {
  for (const bodyWeightKg of [0, -1, Infinity, NaN]) {
    assert.equal(estimateMainStrengthProfile({
      bodyWeightKg, trainingExperienceMonths: 1, mainExerciseId: 'barbell_bench_press',
    }), null);
  }
  assert.equal(estimateMainStrengthProfile({
    bodyWeightKg: 60, trainingExperienceMonths: 1, mainExerciseId: 'push_up',
  }), null);
});
