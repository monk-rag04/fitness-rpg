import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SELF_REPORT_BASELINE_UNSUPPORTED_EXERCISE_IDS,
  canSelfReportExerciseBaseline,
  captureFirstWorkoutExerciseBaseline,
  createInitialExerciseProgressState,
  createOnboardingExerciseProgressState,
  incrementExerciseSessionsCompleted,
  registerSelfReportedExerciseBaseline,
} from '../dist/index.js';

function workoutResult({ plannedExerciseId = 'dumbbell_lateral_raise', performedExerciseId = plannedExerciseId, completedSets } = {}) {
  return {
    plannedExerciseId,
    performedExerciseId,
    role: 'accessory',
    plannedSets: 3,
    plannedRepRange: { min: 10, max: 15 },
    completedSets: completedSets ?? [{ setNumber: 1, weightKg: 8, reps: 8 }],
    performedAt: '2026-09-24T10:00:00.000Z',
  };
}

test('Main Strength progress initializes from Onboarding and starts with zero completed sessions', () => {
  const state = createOnboardingExerciseProgressState({
    exerciseId: 'barbell_bench_press',
    weightKg: 60,
    reps: 8,
    capturedDayIndex: 0,
  });

  assert.deepEqual(state, {
    exerciseId: 'barbell_bench_press',
    baseline: {
      weightKg: 60,
      reps: 8,
      estimatedE1rmKg: 76,
      e1rmRuleVersion: 'epley-v1',
      source: 'onboarding',
      capturedDayIndex: 0,
    },
    sessionsCompleted: 0,
  });
});

test('self-reported baseline stores current day and does not count as a completed session', () => {
  const before = {};
  const result = registerSelfReportedExerciseBaseline(before, {
    exerciseId: 'dumbbell_lateral_raise',
    weightKg: 8,
    reps: 8,
    capturedDayIndex: 4,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.baseline, {
    weightKg: 8,
    reps: 8,
    estimatedE1rmKg: 10.133333333333333,
    e1rmRuleVersion: 'epley-v1',
    source: 'self_report',
    capturedDayIndex: 4,
  });
  assert.equal(result.exerciseProgressById.dumbbell_lateral_raise.sessionsCompleted, 0);
  assert.deepEqual(before, {});
});

test('self-reported baseline rejects non-positive weight and invalid reps', () => {
  const baseInput = {
    exerciseId: 'dumbbell_curl',
    weightKg: 5,
    reps: 8,
    capturedDayIndex: 0,
  };

  assert.deepEqual(registerSelfReportedExerciseBaseline({}, { ...baseInput, weightKg: 0 }), {
    valid: false,
    code: 'INVALID_BASELINE_WEIGHT',
  });
  for (const reps of [0, 1.5, -2]) {
    assert.deepEqual(registerSelfReportedExerciseBaseline({}, { ...baseInput, reps }), {
      valid: false,
      code: 'INVALID_BASELINE_REPS',
    });
  }
});

test('eligible self-report baseline uses D-023 e1RM; high reps keep the baseline without an estimate', () => {
  const eligible = registerSelfReportedExerciseBaseline({}, {
    exerciseId: 'dumbbell_curl', weightKg: 10, reps: 5, capturedDayIndex: 1,
  });
  const highRep = registerSelfReportedExerciseBaseline({}, {
    exerciseId: 'dumbbell_curl', weightKg: 10, reps: 11, capturedDayIndex: 1,
  });

  assert.equal(eligible.valid, true);
  assert.equal(eligible.baseline.estimatedE1rmKg, 10 * (1 + 5 / 30));
  assert.equal(eligible.baseline.e1rmRuleVersion, 'epley-v1');
  assert.equal(highRep.valid, true);
  assert.deepEqual(highRep.baseline, {
    weightKg: 10,
    reps: 11,
    source: 'self_report',
    capturedDayIndex: 1,
  });
});

test('Workout Result baseline uses the maximum eligible D-023 set and retains its evidence', () => {
  const input = workoutResult({ completedSets: [
    { setNumber: 1, weightKg: 8, reps: 8 },
    { setNumber: 2, weightKg: 10, reps: 8 },
    { setNumber: 3, weightKg: 9, reps: 8 },
  ] });
  const progress = captureFirstWorkoutExerciseBaseline({}, input, 2);

  assert.deepEqual(progress.dumbbell_lateral_raise.baseline, {
    weightKg: 10,
    reps: 8,
    estimatedE1rmKg: 10 * (1 + 8 / 30),
    e1rmRuleVersion: 'epley-v1',
    source: 'workout_result',
    capturedDayIndex: 2,
  });
  assert.equal(progress.dumbbell_lateral_raise.sessionsCompleted, 0);
});

test('existing baseline is not overwritten by a later Workout Result', () => {
  const existing = createOnboardingExerciseProgressState({
    exerciseId: 'dumbbell_lateral_raise', weightKg: 6, reps: 6, capturedDayIndex: 0,
  });
  const before = { dumbbell_lateral_raise: existing };
  const next = captureFirstWorkoutExerciseBaseline(before, workoutResult(), 3);

  assert.equal(next, before);
  assert.deepEqual(next.dumbbell_lateral_raise.baseline, existing.baseline);
});

test('Workout Result baseline is attributed to performedExerciseId, not plannedExerciseId', () => {
  const progress = captureFirstWorkoutExerciseBaseline(
    {},
    workoutResult({ plannedExerciseId: 'dumbbell_bench_press', performedExerciseId: 'push_up' }),
    1,
  );

  assert.equal(progress.push_up.baseline.source, 'workout_result');
  assert.equal(progress.push_up.baseline.weightKg, 8);
  assert.equal(Object.hasOwn(progress, 'dumbbell_bench_press'), false);
});

test('ineligible Workout Result sets still establish a baseline from the first working set', () => {
  const progress = captureFirstWorkoutExerciseBaseline({}, workoutResult({ completedSets: [
    { setNumber: 3, weightKg: 12, reps: 12 },
    { setNumber: 1, weightKg: 10, reps: 11 },
  ] }), 5);

  assert.deepEqual(progress.dumbbell_lateral_raise.baseline, {
    weightKg: 10,
    reps: 11,
    source: 'workout_result',
    capturedDayIndex: 5,
  });
});

test('bodyweight Catalog exercises do not offer kg self-report', () => {
  assert.deepEqual(SELF_REPORT_BASELINE_UNSUPPORTED_EXERCISE_IDS, ['push_up', 'pull_up', 'glute_bridge']);
  for (const exerciseId of SELF_REPORT_BASELINE_UNSUPPORTED_EXERCISE_IDS) {
    assert.equal(canSelfReportExerciseBaseline(exerciseId), false);
    assert.equal(registerSelfReportedExerciseBaseline({}, {
      exerciseId, weightKg: 20, reps: 5, capturedDayIndex: 0,
    }).code, 'SELF_REPORT_NOT_SUPPORTED');
  }
  assert.equal(canSelfReportExerciseBaseline('dumbbell_curl'), true);
  assert.equal(canSelfReportExerciseBaseline('not_a_catalog_exercise'), false);
});

test('a successful Training Quest increments each performed exercise once; invalid results do not mutate state', () => {
  const initial = { dumbbell_curl: createInitialExerciseProgressState('dumbbell_curl') };
  const result = workoutResult({ performedExerciseId: 'dumbbell_curl' });
  const incremented = incrementExerciseSessionsCompleted(initial, [result, result]);

  assert.equal(incremented.valid, true);
  assert.equal(incremented.exerciseProgressById.dumbbell_curl.sessionsCompleted, 1);
  assert.equal(initial.dumbbell_curl.sessionsCompleted, 0);
  assert.deepEqual(incrementExerciseSessionsCompleted(initial, [{}]), {
    valid: false,
    code: 'INVALID_WORKOUT_RESULT',
  });
  assert.equal(incrementExerciseSessionsCompleted(initial, [{}]).valid, false);
});
