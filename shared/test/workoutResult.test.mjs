import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrainingCandidates,
  calculateWorkoutResultE1rm,
  validateExerciseWorkoutResult,
  validateTrainingPlanDraft,
  validateWorkoutResultAgainstPlan,
} from '../dist/index.js';

const performedAt = '2026-09-22T12:00:00.000Z';

function set(setNumber, weightKg, reps) {
  return { setNumber, weightKg, reps };
}

function workoutResult(overrides = {}) {
  return {
    plannedExerciseId: 'barbell_bench_press',
    performedExerciseId: 'barbell_bench_press',
    role: 'main',
    plannedSets: 3,
    plannedRepRange: { min: 8, max: 12 },
    completedSets: [set(1, 60, 10), set(2, 65, 8), set(3, 70, 5)],
    performedAt,
    ...overrides,
  };
}

function expectValid(input) {
  const result = validateExerciseWorkoutResult(input);
  assert.equal(result.valid, true);
  return result.value;
}

function errorCodes(input) {
  const result = validateExerciseWorkoutResult(input);
  assert.equal(result.valid, false);
  return result.errors.map((error) => error.code);
}

test('valid main exercise workout result records each completed set', () => {
  const result = expectValid(workoutResult());
  assert.deepEqual(result.completedSets, [
    set(1, 60, 10), set(2, 65, 8), set(3, 70, 5),
  ]);
  assert.equal(result.role, 'main');
});

test('accessory exercise result is valid', () => {
  const result = expectValid(workoutResult({
    plannedExerciseId: 'dumbbell_curl',
    performedExerciseId: 'dumbbell_curl',
    role: 'accessory',
    plannedSets: 2,
    plannedRepRange: { min: 10, max: 15 },
    completedSets: [set(1, 12, 12), set(2, 12, 10)],
  }));
  assert.equal(result.role, 'accessory');
});

test('substitution is valid without re-evaluating the substitution policy', () => {
  const result = expectValid(workoutResult({
    performedExerciseId: 'dumbbell_bench_press',
    completedSets: [set(1, 20, 10), set(2, 20, 9)],
  }));
  assert.equal(result.plannedExerciseId, 'barbell_bench_press');
  assert.equal(result.performedExerciseId, 'dumbbell_bench_press');
});

test('multiple set weights are preserved and normalized by set number', () => {
  const result = expectValid(workoutResult({
    completedSets: [set(3, 70, 5), set(1, 60, 10), set(2, 65, 8)],
  }));
  assert.deepEqual(result.completedSets, [
    set(1, 60, 10), set(2, 65, 8), set(3, 70, 5),
  ]);
});

test('reps outside the planned range remain valid workout records', () => {
  assert.equal(expectValid(workoutResult({ completedSets: [set(1, 60, 6)] })).completedSets[0].reps, 6);
  assert.equal(expectValid(workoutResult({ completedSets: [set(1, 60, 13)] })).completedSets[0].reps, 13);
});

test('partial sets are valid and an empty result is not treated as a workout result', () => {
  const partial = expectValid(workoutResult({ completedSets: [set(1, 60, 10), set(2, 60, 8)] }));
  assert.equal(partial.completedSets.length, 2);
  assert.ok(errorCodes(workoutResult({ completedSets: [] })).includes('EMPTY_COMPLETED_SETS'));
});

for (const weightKg of [0, -1, NaN, Infinity, -Infinity]) {
  test(`invalid weight ${weightKg} is rejected`, () => {
    assert.ok(errorCodes(workoutResult({ completedSets: [set(1, weightKg, 8)] }))
      .includes('INVALID_WEIGHT_KG'));
  });
}

for (const reps of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
  test(`invalid reps ${reps} is rejected`, () => {
    assert.ok(errorCodes(workoutResult({ completedSets: [set(1, 60, reps)] }))
      .includes('INVALID_REPS'));
  });
}

for (const plannedSets of [0, -1, 1.5, NaN, Infinity]) {
  test(`invalid planned sets ${plannedSets} is rejected`, () => {
    assert.ok(errorCodes(workoutResult({ plannedSets }))
      .includes('INVALID_PLANNED_SETS'));
  });
}

test('invalid planned rep range is rejected', () => {
  for (const plannedRepRange of [
    { min: 0, max: 8 },
    { min: 8, max: 0 },
    { min: 8, max: 7 },
    { min: 8.5, max: 10 },
  ]) {
    assert.ok(errorCodes(workoutResult({ plannedRepRange }))
      .includes('INVALID_PLANNED_REP_RANGE'));
  }
});

test('unknown planned or performed exercise IDs are rejected', () => {
  assert.ok(errorCodes(workoutResult({ plannedExerciseId: 'unknown_exercise' }))
    .includes('PLANNED_EXERCISE_NOT_FOUND'));
  assert.ok(errorCodes(workoutResult({ performedExerciseId: 'unknown_exercise' }))
    .includes('PERFORMED_EXERCISE_NOT_FOUND'));
});

test('invalid role, timestamp, and unknown fields are rejected', () => {
  assert.ok(errorCodes(workoutResult({ role: 'warmup' })).includes('INVALID_ROLE'));
  assert.ok(errorCodes(workoutResult({ performedAt: 'not-a-timestamp' })).includes('INVALID_PERFORMED_AT'));
  assert.ok(errorCodes({ ...workoutResult(), unexpected: true }).includes('INVALID_FIELD'));
  assert.ok(errorCodes(workoutResult({ completedSets: [{ ...set(1, 60, 8), note: 'unexpected' }] }))
    .includes('INVALID_FIELD'));
});

test('duplicate set numbers are rejected', () => {
  assert.ok(errorCodes(workoutResult({ completedSets: [set(1, 60, 8), set(1, 65, 8)] }))
    .includes('DUPLICATE_SET_NUMBER'));
});

test('set numbers must be positive integers', () => {
  for (const setNumber of [0, -1, 1.5, NaN, Infinity]) {
    assert.ok(errorCodes(workoutResult({ completedSets: [set(setNumber, 60, 8)] }))
      .includes('INVALID_SET_NUMBER'));
  }
});

test('unknown fields in the plan snapshot are rejected', () => {
  assert.ok(errorCodes(workoutResult({ plannedRepRange: { min: 8, max: 12, extra: true } }))
    .includes('INVALID_FIELD'));
});

test('a result can be checked against the immutable plan snapshot without checking actual reps', () => {
  const candidates = buildTrainingCandidates({
    mainExerciseId: 'barbell_bench_press',
    equipmentProfile: {
      id: 'barbell-bench',
      displayName: 'Barbell and Bench',
      availableEquipmentIds: ['barbell', 'flat_bench'],
    },
  });
  const planValidation = validateTrainingPlanDraft({
    exercises: [{ exerciseId: 'barbell_bench_press', role: 'main', sets: 3, repRange: { min: 8, max: 10 } }],
  }, candidates);
  assert.equal(planValidation.valid, true);

  assert.deepEqual(
    validateWorkoutResultAgainstPlan(
      expectValid(workoutResult({
        plannedRepRange: { min: 8, max: 10 },
        completedSets: [set(1, 60, 6), set(2, 60, 6)],
      })),
      planValidation.plan.exercises[0],
    ),
    { valid: true },
  );
  const inconsistent = validateWorkoutResultAgainstPlan(
    expectValid(workoutResult({ plannedSets: 2, plannedRepRange: { min: 8, max: 10 } })),
    planValidation.plan.exercises[0],
  );
  assert.equal(inconsistent.valid, false);
  assert.ok(inconsistent.errors.some((error) => error.code === 'PLANNED_SETS_MISMATCH'));
});

test('workout result delegates representative e1RM calculation to D-023', () => {
  const e1rm = calculateWorkoutResultE1rm(expectValid(workoutResult()));
  assert.equal(e1rm.exerciseId, 'barbell_bench_press');
  assert.equal(e1rm.estimated1rmKg, 65 * (1 + 8 / 30));
  assert.equal(e1rm.sourceSetIndex, 1);
});

test('eleven-plus reps are valid but excluded from e1RM calculation', () => {
  const highRepOnly = calculateWorkoutResultE1rm(expectValid(workoutResult({
    completedSets: [set(1, 100, 11)],
  })));
  assert.equal(highRepOnly.estimated1rmKg, null);

  const mixed = calculateWorkoutResultE1rm(expectValid(workoutResult({
    completedSets: [set(1, 100, 11), set(2, 50, 5)],
  })));
  assert.equal(mixed.estimated1rmKg, 50 * (1 + 5 / 30));
  assert.equal(mixed.sourceSetIndex, 1);
});

test('substitution result computes e1RM for the performed exercise', () => {
  const e1rm = calculateWorkoutResultE1rm(expectValid(workoutResult({
    performedExerciseId: 'dumbbell_bench_press',
    completedSets: [set(1, 20, 10)],
  })));
  assert.equal(e1rm.exerciseId, 'dumbbell_bench_press');
  assert.equal(e1rm.estimated1rmKg, 20 * (1 + 10 / 30));
});
