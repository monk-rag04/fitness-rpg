import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOSS_E1RM_EXERCISE_IDS,
  E1RM_RULE,
  E1rmValidationError,
  calculateSetE1rm,
  calculateWorkoutE1rm,
  getCurrentE1rm,
  getHistoricalBestE1rm,
  isBossE1rmExerciseId,
} from '../dist/index.js';

const bench = 'barbell_bench_press';
const squat = 'barbell_back_squat';
const asOf = new Date('2026-09-22T12:00:00.000Z');

function workout(daysAgo, sets, exerciseId = bench) {
  return calculateWorkoutE1rm(
    exerciseId,
    new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    sets,
  );
}

function assertE1rmError(input, code) {
  assert.throws(
    () => calculateSetE1rm(input),
    (error) => error instanceof E1rmValidationError && error.code === code,
  );
}

test('one rep equals the recorded weight', () => {
  assert.deepEqual(calculateSetE1rm({ weightKg: 80, reps: 1 }), {
    eligible: true, estimated1rmKg: 80, ruleVersion: E1RM_RULE.version,
  });
});

test('five and ten reps use unrounded Epley', () => {
  assert.equal(calculateSetE1rm({ weightKg: 60, reps: 5 }).estimated1rmKg, 60 * (1 + 5 / 30));
  assert.equal(calculateSetE1rm({ weightKg: 60, reps: 10 }).estimated1rmKg, 80);
});

test('eleven or more reps are valid records but ineligible for e1RM', () => {
  for (const reps of [11, 20]) {
    assert.deepEqual(calculateSetE1rm({ weightKg: 60, reps }), {
      eligible: false, estimated1rmKg: null, ruleVersion: E1RM_RULE.version,
    });
  }
});

test('zero, negative, fractional and non-finite reps are invalid', () => {
  for (const reps of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
    assertE1rmError({ weightKg: 60, reps }, 'INVALID_REPS');
  }
});

test('zero, negative and non-finite weight are invalid', () => {
  for (const weightKg of [0, -1, NaN, Infinity, -Infinity]) {
    assertE1rmError({ weightKg, reps: 5 }, 'INVALID_WEIGHT_KG');
  }
});

test('an overflowing estimate is invalid', () => {
  assertE1rmError({ weightKg: Number.MAX_VALUE, reps: 10 }, 'INVALID_ESTIMATE');
});

test('workout selects the largest unrounded estimate, not necessarily the heaviest set', () => {
  const result = workout(1, [
    { weightKg: 60, reps: 10 },
    { weightKg: 65, reps: 8 },
    { weightKg: 70, reps: 5 },
  ]);
  assert.equal(result.estimated1rmKg, 65 * (1 + 8 / 30));
  assert.equal(result.sourceSetIndex, 1);
  assert.equal(result.ruleVersion, E1RM_RULE.version);
});

test('workout ignores high-rep sets and returns no estimate without eligible sets', () => {
  const mixed = workout(1, [{ weightKg: 100, reps: 11 }, { weightKg: 50, reps: 5 }]);
  assert.equal(mixed.estimated1rmKg, 50 * (1 + 5 / 30));
  assert.equal(mixed.sourceSetIndex, 1);
  for (const sets of [[], [{ weightKg: 100, reps: 11 }]]) {
    const result = workout(1, sets);
    assert.equal(result.estimated1rmKg, null);
    assert.equal(result.sourceSetIndex, null);
  }
});

test('workout rejects an invalid set rather than silently ignoring it', () => {
  assert.throws(
    () => workout(1, [{ weightKg: 60, reps: 5 }, { weightKg: 0, reps: 5 }]),
    (error) => error instanceof E1rmValidationError && error.code === 'INVALID_WEIGHT_KG',
  );
});

test('current estimate is the maximum in the inclusive rolling 30 days for the same exercise', () => {
  const recentLow = workout(2, [{ weightKg: 60, reps: 5 }]);
  const recentHigh = workout(10, [{ weightKg: 70, reps: 5 }]);
  const oldPb = workout(31, [{ weightKg: 100, reps: 5 }]);
  const otherExercise = workout(1, [{ weightKg: 200, reps: 5 }], squat);
  assert.equal(getCurrentE1rm(bench, [recentLow, recentHigh, oldPb, otherExercise], asOf), recentHigh);
});

test('exactly 30 days ago is included; one millisecond older is excluded', () => {
  const boundary = workout(30, [{ weightKg: 70, reps: 5 }]);
  const older = calculateWorkoutE1rm(
    bench, new Date(boundary.performedAt.getTime() - 1), [{ weightKg: 100, reps: 5 }],
  );
  assert.equal(getCurrentE1rm(bench, [older, boundary], asOf), boundary);
  assert.equal(getCurrentE1rm(bench, [older], asOf), null);
});

test('current ignores future records and returns none without eligible recent records', () => {
  const future = calculateWorkoutE1rm(bench, new Date(asOf.getTime() + 1), [{ weightKg: 100, reps: 5 }]);
  assert.equal(getCurrentE1rm(bench, [workout(31, [{ weightKg: 100, reps: 5 }]), future], asOf), null);
  assert.equal(getCurrentE1rm(bench, [workout(1, [{ weightKg: 100, reps: 11 }])], asOf), null);
});

test('historical PB can remain higher than current', () => {
  const recent = workout(1, [{ weightKg: 60, reps: 5 }]);
  const oldPb = workout(100, [{ weightKg: 100, reps: 5 }]);
  assert.equal(getCurrentE1rm(bench, [recent, oldPb], asOf), recent);
  assert.equal(getHistoricalBestE1rm(bench, [recent, oldPb]), oldPb);
  assert.equal(getHistoricalBestE1rm(bench, [workout(1, [{ weightKg: 100, reps: 11 }])]), null);
});

test('invalid timestamps are rejected', () => {
  assert.throws(
    () => calculateWorkoutE1rm(bench, new Date(NaN), [{ weightKg: 60, reps: 5 }]),
    (error) => error instanceof E1rmValidationError && error.code === 'INVALID_TIMESTAMP',
  );
  assert.throws(
    () => getCurrentE1rm(bench, [], new Date(NaN)),
    (error) => error instanceof E1rmValidationError && error.code === 'INVALID_TIMESTAMP',
  );
});

test('a result from a different rule version is not silently mixed into current or PB', () => {
  const incompatible = { ...workout(1, [{ weightKg: 60, reps: 5 }]), ruleVersion: 'other-v1' };
  for (const aggregate of [
    () => getCurrentE1rm(bench, [incompatible], asOf),
    () => getHistoricalBestE1rm(bench, [incompatible]),
  ]) {
    assert.throws(aggregate, (error) =>
      error instanceof E1rmValidationError && error.code === 'UNSUPPORTED_RULE_VERSION');
  }
  assert.equal(getCurrentE1rm(bench, [{ ...incompatible, performedAt: workout(31, []).performedAt }], asOf), null);
  assert.equal(getCurrentE1rm(bench, [{ ...incompatible, exerciseId: squat }], asOf), null);
});

test('Boss e1RM scope uses only the four catalog main-lift IDs', () => {
  assert.deepEqual(BOSS_E1RM_EXERCISE_IDS, [
    'barbell_bench_press', 'barbell_back_squat', 'barbell_deadlift', 'barbell_overhead_press',
  ]);
  for (const id of BOSS_E1RM_EXERCISE_IDS) assert.equal(isBossE1rmExerciseId(id), true);
  for (const id of ['pull_up', 'goblet_squat', 'romanian_deadlift']) {
    assert.equal(isBossE1rmExerciseId(id), false);
  }
});

test('the core keeps fractional precision instead of rounding for UI or Boss comparison', () => {
  const result = calculateSetE1rm({ weightKg: 65, reps: 8 });
  assert.equal(result.estimated1rmKg, 65 * (1 + 8 / 30));
  assert.notEqual(result.estimated1rmKg, Math.round(result.estimated1rmKg));
  assert.notEqual(result.estimated1rmKg, Math.round(result.estimated1rmKg * 10) / 10);
});
