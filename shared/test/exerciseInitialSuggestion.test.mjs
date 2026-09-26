import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BODYWEIGHT_EXERCISE_IDS,
  EXERCISE_CATALOG,
  EXERCISE_INITIAL_BODYWEIGHT_RATIOS,
  EXERCISE_INITIAL_SUGGESTION_RULE_VERSION,
  isMachineOrCableExercise,
  recommendInitialMainStrengthSuggestion,
  recommendInitialExerciseSuggestion,
} from '../dist/index.js';

const repRange = { min: 8, max: 12 };

test('versioned first-session rule explicitly covers every weighted Catalog exercise', () => {
  const weightedCatalogIds = EXERCISE_CATALOG
    .map(({ id }) => id)
    .filter((id) => !BODYWEIGHT_EXERCISE_IDS.includes(id))
    .sort();
  assert.equal(EXERCISE_INITIAL_SUGGESTION_RULE_VERSION, 'exercise-initial-suggestion-v1');
  assert.deepEqual(Object.keys(EXERCISE_INITIAL_BODYWEIGHT_RATIOS).sort(), weightedCatalogIds);
  assert.ok(Object.values(EXERCISE_INITIAL_BODYWEIGHT_RATIOS).every((ratio) => ratio > 0 && ratio <= 0.45));
});

test('weighted first-session recommendation is deterministic, conservative, and begins at min reps', () => {
  const input = {
    exerciseId: 'barbell_bench_press',
    bodyWeightKg: 60,
    trainingExperienceMonths: 0,
    repRange,
  };
  assert.deepEqual(recommendInitialExerciseSuggestion(input), {
    exerciseId: 'barbell_bench_press',
    weightKg: 18,
    targetReps: 8,
    repRange,
    ruleVersion: EXERCISE_INITIAL_SUGGESTION_RULE_VERSION,
  });
  assert.deepEqual(recommendInitialExerciseSuggestion(input), recommendInitialExerciseSuggestion(input));
});

test('bodyweight recommendation has reps only and no synthetic zero-weight baseline data', () => {
  const suggestion = recommendInitialExerciseSuggestion({
    exerciseId: 'push_up', bodyWeightKg: 60, trainingExperienceMonths: 0, repRange,
  });
  assert.deepEqual(suggestion, {
    exerciseId: 'push_up', targetReps: 8, repRange,
    ruleVersion: EXERCISE_INITIAL_SUGGESTION_RULE_VERSION,
  });
  assert.equal(Object.hasOwn(suggestion, 'weightKg'), false);
  assert.equal(Object.hasOwn(suggestion, 'baseline'), false);
});

test('dumbbell recommendation is per one dumbbell and uses only a capped light history factor', () => {
  const beginner = recommendInitialExerciseSuggestion({
    exerciseId: 'dumbbell_curl', bodyWeightKg: 60, trainingExperienceMonths: 0, repRange,
  });
  const experienced = recommendInitialExerciseSuggestion({
    exerciseId: 'dumbbell_curl', bodyWeightKg: 60, trainingExperienceMonths: 120, repRange,
  });
  assert.equal(beginner.weightKg, 2.5);
  assert.equal(experienced.weightKg, 2.5);
});

test('machine and cable movements are covered and marked for equipment-specific scale caveat', () => {
  for (const exerciseId of ['chest_press_machine', 'lat_pulldown', 'cable_chest_fly']) {
    assert.ok(recommendInitialExerciseSuggestion({
      exerciseId, bodyWeightKg: 70, trainingExperienceMonths: 4, repRange,
    }));
    assert.equal(isMachineOrCableExercise(exerciseId), true);
  }
  assert.equal(isMachineOrCableExercise('barbell_bench_press'), false);
  assert.equal(isMachineOrCableExercise('standing_calf_raise'), false);
});

test('invalid inputs and unknown exercise IDs do not produce a suggestion', () => {
  const base = { exerciseId: 'dumbbell_curl', bodyWeightKg: 60, trainingExperienceMonths: 0, repRange };
  assert.equal(recommendInitialExerciseSuggestion({ ...base, bodyWeightKg: 0 }), null);
  assert.equal(recommendInitialExerciseSuggestion({ ...base, trainingExperienceMonths: 1.5 }), null);
  assert.equal(recommendInitialExerciseSuggestion({ ...base, exerciseId: 'unknown' }), null);
  assert.equal(recommendInitialExerciseSuggestion({ ...base, repRange: { min: 0, max: 10 } }), null);
});

test('known Main Strength baseline is projected from D-023 e1RM to planned minimum reps', () => {
  const baseline = { weightKg: 40, reps: 3, source: 'onboarding', capturedDayIndex: 0 };
  const before = structuredClone(baseline);
  const suggestion = recommendInitialMainStrengthSuggestion({
    exerciseId: 'barbell_bench_press', baseline, repRange: { min: 5, max: 8 },
  });
  assert.deepEqual(suggestion, {
    exerciseId: 'barbell_bench_press', weightKg: 37.5, targetReps: 5,
    repRange: { min: 5, max: 8 }, e1rmRuleVersion: 'epley-v1',
  });
  assert.deepEqual(baseline, before);
});

test('Main Strength baseline already in range still yields a numeric initial suggestion', () => {
  const suggestion = recommendInitialMainStrengthSuggestion({
    exerciseId: 'barbell_bench_press',
    baseline: { weightKg: 60, reps: 8, source: 'onboarding', capturedDayIndex: 0 },
    repRange: { min: 5, max: 8 },
  });
  assert.deepEqual(suggestion, {
    exerciseId: 'barbell_bench_press', weightKg: 65, targetReps: 5,
    repRange: { min: 5, max: 8 }, e1rmRuleVersion: 'epley-v1',
  });
});

test('estimated_profile Main Strength uses its provisional set and never a post-clear actual baseline', () => {
  const estimated = recommendInitialMainStrengthSuggestion({
    exerciseId: 'barbell_bench_press',
    baseline: { weightKg: 30, reps: 5, source: 'estimated_profile', capturedDayIndex: 0 },
    repRange: { min: 8, max: 12 },
  });
  assert.deepEqual(estimated, {
    exerciseId: 'barbell_bench_press', weightKg: 27.5, targetReps: 8,
    repRange: { min: 8, max: 12 }, e1rmRuleVersion: 'epley-v1',
  });
  assert.equal(recommendInitialMainStrengthSuggestion({
    exerciseId: 'barbell_bench_press',
    baseline: { weightKg: 60, reps: 8, source: 'workout_result', capturedDayIndex: 1 },
    repRange: { min: 5, max: 8 },
  }), null);
});

test('Main Strength recommendation respects D-023 ineligible reps and input validation', () => {
  assert.equal(recommendInitialMainStrengthSuggestion({
    exerciseId: 'barbell_bench_press',
    baseline: { weightKg: 40, reps: 11, source: 'onboarding', capturedDayIndex: 0 },
    repRange: { min: 5, max: 8 },
  }), null);
  assert.equal(recommendInitialMainStrengthSuggestion({
    exerciseId: 'push_up',
    baseline: { weightKg: 40, reps: 3, source: 'onboarding', capturedDayIndex: 0 },
    repRange: { min: 5, max: 8 },
  }), null);
  assert.equal(recommendInitialMainStrengthSuggestion({
    exerciseId: 'barbell_bench_press',
    baseline: { weightKg: 40, reps: 3, source: 'onboarding', capturedDayIndex: 0 },
    repRange: { min: 0, max: 8 },
  }), null);
});
