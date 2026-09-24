import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STAGE_PROGRESS_RULE,
  StageProgressValidationError,
  completeRecoveryQuest,
  completeTrainingQuest,
  createInitialStageProgress,
  deriveStageProgressView,
  evaluateTrainingQuestCompletion,
  generateStageRoadmap,
  rescheduleCurrentQuest,
} from '../dist/index.js';

function roadmap(overrides = {}) {
  return generateStageRoadmap({
    startDate: '2026-09-22',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
    ...overrides,
  });
}

const plan = {
  exercises: [
    { exerciseId: 'barbell_bench_press', role: 'main', sets: 3, repRange: { min: 8, max: 12 } },
    { exerciseId: 'dumbbell_curl', role: 'accessory', sets: 2, repRange: { min: 10, max: 15 } },
  ],
};

const mainOnlyPlan = { exercises: [plan.exercises[0]] };

const dumbbellBenchProfile = {
  id: 'dumbbell-bench',
  displayName: 'Dumbbell and flat bench',
  availableEquipmentIds: ['dumbbell', 'flat_bench'],
};

function completedSet(setNumber, weightKg = 60, reps = 10) {
  return { setNumber, weightKg, reps };
}

function workoutResult(overrides = {}) {
  return {
    plannedExerciseId: 'barbell_bench_press',
    performedExerciseId: 'barbell_bench_press',
    role: 'main',
    plannedSets: 3,
    plannedRepRange: { min: 8, max: 12 },
    completedSets: [completedSet(1), completedSet(2, 62.5), completedSet(3, 65)],
    performedAt: '2026-09-22T12:00:00.000Z',
    ...overrides,
  };
}

function fullResults(overrides = {}) {
  return [
    workoutResult(overrides.main),
    workoutResult({
      plannedExerciseId: 'dumbbell_curl',
      performedExerciseId: 'dumbbell_curl',
      role: 'accessory',
      plannedSets: 2,
      plannedRepRange: { min: 10, max: 15 },
      completedSets: [completedSet(1, 12, 12), completedSet(2, 12, 10)],
      ...overrides.accessory,
    }),
  ];
}

function expectProgressError(roadmapInput, progress, code) {
  assert.throws(
    () => deriveStageProgressView(roadmapInput, progress),
    (error) => error instanceof StageProgressValidationError && error.code === code,
  );
}

test('creates initial progress at day index zero without consulting a calendar', () => {
  assert.deepEqual(createInitialStageProgress(roadmap()), { currentDayIndex: 0 });
  assert.deepEqual(createInitialStageProgress(roadmap({ startDate: '2020-01-01' })), { currentDayIndex: 0 });
});

test('derives completed, available, and locked statuses solely from currentDayIndex', () => {
  const view = deriveStageProgressView(roadmap(), { currentDayIndex: 2 });
  assert.deepEqual(view.dailyNodes.slice(0, 4).map((node) => node.status), [
    'completed', 'completed', 'available', 'locked',
  ]);
  assert.equal(view.currentDailyNode?.dayIndex, 2);
  assert.deepEqual(view.completedDailyNodes.map((node) => node.dayIndex), [0, 1]);
  assert.deepEqual(view.lockedFutureDailyNodes.map((node) => node.dayIndex), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(view.completedDailyNodeCount, 2);
  assert.equal(view.totalDailyNodeCount, 14);
});

test('exposes training focus but no UI-specific map state', () => {
  const view = deriveStageProgressView(roadmap(), { currentDayIndex: 0 });
  assert.deepEqual(view.currentDailyNode, {
    dayIndex: 0,
    date: '2026-09-22',
    type: 'training',
    status: 'available',
    sessionFocus: {
      targetMuscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
      targetMovementPatterns: [
        'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
        'elbow_flexion', 'elbow_extension', 'shoulder_abduction', 'chest_fly',
      ],
    },
  });
  assert.equal(Object.hasOwn(view, 'exp'), false);
  assert.equal(Object.hasOwn(view.boss, 'defeated'), false);
  assert.equal(view.ruleVersion, STAGE_PROGRESS_RULE.version);
});

test('is deterministic and schedule dates alone do not move progress', () => {
  const progress = { currentDayIndex: 1 };
  const original = roadmap();
  const rescheduled = rescheduleCurrentQuest(original, progress.currentDayIndex, '2026-09-25', '2026-09-22');
  assert.deepEqual(deriveStageProgressView(original, progress), deriveStageProgressView(original, progress));
  assert.equal(deriveStageProgressView(rescheduled, progress).currentDayIndex, 1);
  assert.deepEqual(progress, { currentDayIndex: 1 });
});

test('makes the boss available only after every daily node is complete', () => {
  const value = roadmap();
  assert.equal(deriveStageProgressView(value, { currentDayIndex: 13 }).bossAvailable, false);
  const completeView = deriveStageProgressView(value, { currentDayIndex: value.days.length });
  assert.equal(completeView.currentDailyNode, null);
  assert.equal(completeView.bossAvailable, true);
  assert.deepEqual(completeView.boss, value.boss);
});

test('rejects malformed, negative, fractional, and out-of-range progress', () => {
  const value = roadmap();
  expectProgressError(value, null, 'INVALID_PROGRESS_SHAPE');
  expectProgressError(value, { currentDayIndex: 0, extra: true }, 'INVALID_PROGRESS_SHAPE');
  for (const currentDayIndex of [-1, 1.5, NaN, Infinity, value.days.length + 1]) {
    expectProgressError(value, { currentDayIndex }, 'INVALID_CURRENT_DAY_INDEX');
  }
});

test('all main and accessory plan exercises must each have one valid result', () => {
  const evaluation = evaluateTrainingQuestCompletion(plan, fullResults());
  assert.equal(evaluation.readyToClear, true);
  assert.deepEqual(evaluation.exercises, [
    { exerciseId: 'barbell_bench_press', role: 'main', completed: true, status: 'completed' },
    { exerciseId: 'dumbbell_curl', role: 'accessory', completed: true, status: 'completed' },
  ]);

  for (const results of [[fullResults()[1]], [fullResults()[0]]]) {
    const incomplete = evaluateTrainingQuestCompletion(plan, results);
    assert.equal(incomplete.readyToClear, false);
    assert.ok(incomplete.errors.some((error) => error.code === 'MISSING_REQUIRED_EXERCISE_RESULT'));
  }
});

test('partial sets and reps outside the planned range remain valid quest-completion evidence', () => {
  const partial = evaluateTrainingQuestCompletion(mainOnlyPlan, [workoutResult({
    completedSets: [completedSet(1, 60, 6), completedSet(2, 60, 14)],
  })]);
  assert.equal(partial.readyToClear, true);
  assert.equal(partial.exercises[0].completed, true);
});

test('requires valid structural workout results and immutable plan snapshot matching', () => {
  const malformed = evaluateTrainingQuestCompletion(mainOnlyPlan, [{}]);
  assert.equal(malformed.readyToClear, false);
  assert.ok(malformed.errors.some((error) => error.code === 'INVALID_WORKOUT_RESULT'));

  const mismatch = evaluateTrainingQuestCompletion(mainOnlyPlan, [workoutResult({ plannedSets: 2 })]);
  assert.equal(mismatch.readyToClear, false);
  assert.ok(mismatch.errors.some((error) => error.code === 'WORKOUT_RESULT_PLAN_MISMATCH'));
});

test('rejects a missing or malformed training plan without creating checkbox state', () => {
  const missing = evaluateTrainingQuestCompletion(undefined, []);
  assert.equal(missing.readyToClear, false);
  assert.deepEqual(missing.errors, [{ code: 'MISSING_TRAINING_PLAN', path: 'trainingPlan' }]);

  const invalid = evaluateTrainingQuestCompletion({ exercises: [] }, []);
  assert.equal(invalid.readyToClear, false);
  assert.equal(invalid.errors[0].code, 'INVALID_TRAINING_PLAN');
});

test('requires exactly one matching workout result per planned exercise', () => {
  const evaluation = evaluateTrainingQuestCompletion(mainOnlyPlan, [workoutResult(), workoutResult()]);
  assert.equal(evaluation.readyToClear, false);
  assert.ok(evaluation.errors.some((error) => error.code === 'DUPLICATE_WORKOUT_RESULT'));
  assert.equal(evaluation.exercises[0].completed, false);
});

test('accepts an explicit catalog substitution only when its required equipment is available', () => {
  const substituted = workoutResult({ performedExerciseId: 'dumbbell_bench_press' });
  const evaluation = evaluateTrainingQuestCompletion(mainOnlyPlan, [substituted], dumbbellBenchProfile);
  assert.equal(evaluation.readyToClear, true);

  const missingProfile = evaluateTrainingQuestCompletion(mainOnlyPlan, [substituted]);
  assert.equal(missingProfile.readyToClear, false);
  assert.ok(missingProfile.errors.some((error) => error.code === 'MISSING_EQUIPMENT_PROFILE'));

  const unavailable = evaluateTrainingQuestCompletion(mainOnlyPlan, [workoutResult({
    performedExerciseId: 'chest_press_machine',
  })], dumbbellBenchProfile);
  assert.equal(unavailable.readyToClear, false);
  assert.ok(unavailable.errors.some((error) => error.code === 'INVALID_SUBSTITUTION'));
});

test('does not reinterpret a performed substitution as the planned exercise', () => {
  const result = workoutResult({ performedExerciseId: 'dumbbell_bench_press' });
  const evaluation = evaluateTrainingQuestCompletion(mainOnlyPlan, [result], dumbbellBenchProfile);
  assert.equal(evaluation.readyToClear, true);
  assert.equal(result.performedExerciseId, 'dumbbell_bench_press');
  assert.equal(Object.hasOwn(evaluation.exercises[0], 'performedExerciseId'), false);
});

test('valid result evaluation alone does not advance map progress', () => {
  const value = roadmap();
  const progress = createInitialStageProgress(value);
  assert.equal(evaluateTrainingQuestCompletion(plan, fullResults()).readyToClear, true);
  assert.equal(progress.currentDayIndex, 0);
});

test('explicitly clears the current training node and advances exactly one node', () => {
  const value = roadmap();
  const result = completeTrainingQuest(value, createInitialStageProgress(value), 0, plan, fullResults());
  assert.equal(result.status, 'completed');
  assert.equal(result.progress.currentDayIndex, 1);
  assert.equal(result.bossAvailable, false);
  assert.equal(Object.hasOwn(result, 'exp'), false);
});

test('does not clear training when required results are incomplete', () => {
  const value = roadmap();
  const result = completeTrainingQuest(value, { currentDayIndex: 0 }, 0, plan, [fullResults()[0]]);
  assert.equal(result.status, 'not_ready_to_clear');
  assert.equal(result.progress.currentDayIndex, 0);
  if (result.status === 'not_ready_to_clear') {
    assert.equal(result.evaluation.readyToClear, false);
  }
});

test('rejects a training completion request for a current recovery node', () => {
  const value = roadmap();
  const result = completeTrainingQuest(value, { currentDayIndex: 1 }, 1, plan, fullResults());
  assert.deepEqual(result, { status: 'wrong_quest_type', progress: { currentDayIndex: 1 } });
});

test('explicitly clears recovery without a checklist and advances exactly one node', () => {
  const value = roadmap();
  const result = completeRecoveryQuest(value, { currentDayIndex: 1 }, 1);
  assert.deepEqual(result, {
    status: 'completed',
    progress: { currentDayIndex: 2 },
    completedDayIndex: 1,
    bossAvailable: false,
  });
});

test('rejects a recovery completion request for a current training node', () => {
  const value = roadmap();
  const result = completeRecoveryQuest(value, { currentDayIndex: 0 }, 0);
  assert.deepEqual(result, { status: 'wrong_quest_type', progress: { currentDayIndex: 0 } });
});

test('is idempotent for an already completed day and rejects a future day', () => {
  const value = roadmap();
  const progressed = { currentDayIndex: 1 };
  assert.deepEqual(
    completeTrainingQuest(value, progressed, 0, plan, fullResults()),
    { status: 'already_completed', progress: progressed },
  );
  assert.deepEqual(
    completeTrainingQuest(value, { currentDayIndex: 0 }, 2, plan, fullResults()),
    { status: 'not_current_quest', progress: { currentDayIndex: 0 } },
  );
});

test('rejects invalid requested day indexes without changing progress', () => {
  const value = roadmap();
  for (const requestedDayIndex of [-1, 1.5, NaN, value.days.length]) {
    assert.throws(
      () => completeRecoveryQuest(value, { currentDayIndex: 0 }, requestedDayIndex),
      (error) => error instanceof StageProgressValidationError && error.code === 'INVALID_REQUESTED_DAY_INDEX',
    );
  }
});

test('reaching the final daily node makes the boss available without creating boss state', () => {
  const value = roadmap();
  let progress = createInitialStageProgress(value);
  for (let dayIndex = 0; dayIndex < value.days.length; dayIndex += 1) {
    const result = value.days[dayIndex].type === 'training'
      ? completeTrainingQuest(value, progress, dayIndex, plan, fullResults())
      : completeRecoveryQuest(value, progress, dayIndex);
    assert.equal(result.status, 'completed');
    progress = result.progress;
  }
  const view = deriveStageProgressView(value, progress);
  assert.equal(view.bossAvailable, true);
  assert.equal(Object.hasOwn(view, 'stageClear'), false);
  assert.equal(Object.hasOwn(view.boss, 'challenge'), false);
});
