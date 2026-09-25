import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BODYWEIGHT_EXERCISE_IDS,
  EXERCISE_PROGRESSION_RULE_VERSION,
  applyExerciseLoadStep,
  calculateWorkoutResultE1rm,
  createInitialExerciseProgressState,
  evaluateExerciseProgression,
  resolveExerciseSuggestion,
  validateExerciseWorkoutResult,
} from '../dist/index.js';

const exerciseId = 'barbell_bench_press';
const repRange = { min: 8, max: 10 };
const plan = {
  exerciseId,
  role: 'main',
  sets: 3,
  repRange,
};

function progress({ weightKg = 60, targetReps = 8, status = 'active', loadStepKg } = {}) {
  return {
    ...createInitialExerciseProgressState(exerciseId),
    ...(loadStepKg === undefined ? {} : { loadStepKg }),
    nextSuggestion: {
      ...(weightKg === undefined ? {} : { weightKg }),
      targetReps,
      repRange,
      status,
      ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
    },
  };
}

function result({ reps = [8, 8, 8], weights = [60, 60, 60], feedback, performedExerciseId = exerciseId } = {}) {
  return {
    plannedExerciseId: exerciseId,
    performedExerciseId,
    role: 'main',
    plannedSets: 3,
    plannedRepRange: repRange,
    completedSets: reps.map((count, index) => ({
      setNumber: index + 1,
      ...(weights[index] === undefined ? {} : { weightKg: weights[index] }),
      reps: count,
    })),
    ...(feedback === undefined ? {} : { difficultyFeedback: feedback }),
    performedAt: '2026-09-24T10:00:00.000Z',
  };
}

function evaluate(currentProgress, workoutResult) {
  return evaluateExerciseProgression({
    exerciseProgress: currentProgress,
    plannedExercise: plan,
    workoutResult,
    currentDayIndex: 2,
  });
}

test('initial suggestion uses an in-range baseline and starts at minimum reps', () => {
  const current = {
    ...createInitialExerciseProgressState(exerciseId),
    baseline: { weightKg: 60, reps: 9, source: 'self_report', capturedDayIndex: 0 },
  };
  assert.deepEqual(resolveExerciseSuggestion(current, exerciseId, repRange), {
    weightKg: 60,
    targetReps: 8,
    repRange,
    status: 'active',
    ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
  });
});

test('out-of-range or missing baseline never fabricates an initial weight', () => {
  for (const reps of [5, 12]) {
    const current = {
      ...createInitialExerciseProgressState(exerciseId),
      baseline: { weightKg: 60, reps, source: 'self_report', capturedDayIndex: 0 },
    };
    const suggestion = resolveExerciseSuggestion(current, exerciseId, repRange);
    assert.equal(suggestion.weightKg, undefined);
    assert.equal(suggestion.targetReps, repRange.min);
  }
  const empty = resolveExerciseSuggestion(undefined, exerciseId, repRange);
  assert.equal(empty.weightKg, undefined);
  assert.equal(empty.targetReps, repRange.min);
});

test('stored target reps clamp to a changed current rep range', () => {
  const current = progress({ targetReps: 10 });
  const suggestion = resolveExerciseSuggestion(current, exerciseId, { min: 5, max: 8 });
  assert.equal(suggestion.targetReps, 8);
  assert.deepEqual(suggestion.repRange, { min: 5, max: 8 });
});

test('bodyweight suggestion contains reps only and never weight-up status', () => {
  for (const bodyweightId of BODYWEIGHT_EXERCISE_IDS) {
    const suggestion = resolveExerciseSuggestion(undefined, bodyweightId, { min: 8, max: 12 });
    assert.deepEqual(suggestion, {
      targetReps: 8,
      repRange: { min: 8, max: 12 },
      status: 'active',
      ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
    });
  }
});

test('all planned sets at target reps advance only one rep; feedback alone does not advance', () => {
  assert.deepEqual(evaluate(progress(), result({ feedback: 'just_right' })), {
    weightKg: 60,
    targetReps: 9,
    repRange,
    status: 'active',
    ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
  });
  assert.equal(evaluate(progress(), result({ reps: [7, 7, 7], feedback: 'easy' })).targetReps, 8);
});

test('max reps advances one user-configured load step and never more than one', () => {
  const next = evaluate(progress({ loadStepKg: 2.5 }), result({ reps: [10, 10, 10], feedback: 'easy' }));
  assert.deepEqual(next, {
    weightKg: 62.5,
    targetReps: 8,
    repRange,
    status: 'active',
    ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
  });
});

test('partial, too-hard, below-target, or under-suggestion sets retain progression', () => {
  const current = progress();
  assert.deepEqual(evaluate(current, result({ reps: [8, 7, 6], feedback: 'too_hard' })), current.nextSuggestion);
  assert.deepEqual(evaluate(current, result({ reps: [8, 8] })), current.nextSuggestion);
  assert.deepEqual(evaluate(current, result({ reps: [8, 8, 8], weights: [60, 60, 57.5] })), current.nextSuggestion);
});

test('max reps without a load step enters weight_up_ready with current weight', () => {
  assert.deepEqual(evaluate(progress(), result({ reps: [10, 10, 10] })), {
    weightKg: 60,
    targetReps: 10,
    repRange,
    status: 'weight_up_ready',
    ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
  });
});

test('a first same-day Workout Result is treated as having no prior numeric suggestion', () => {
  const learnedBaseline = {
    ...createInitialExerciseProgressState(exerciseId),
    baseline: { weightKg: 60, reps: 8, source: 'workout_result', capturedDayIndex: 2 },
  };
  const suggestion = evaluate(learnedBaseline, result({ weights: [20, 20, 17.5] }));
  assert.deepEqual(suggestion, {
    weightKg: 17.5,
    targetReps: 9,
    repRange,
    status: 'active',
    ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
  });
  assert.equal(evaluate(learnedBaseline, result({ weights: [20, 20, 17.5], feedback: 'too_hard' })).weightKg, undefined);
});

test('load-step action requires a ready numeric suggestion and consumes it once', () => {
  const pending = progress({ status: 'weight_up_ready', targetReps: 10 });
  const applied = applyExerciseLoadStep({ exerciseProgress: pending, exerciseId, loadStepKg: 2.5, repRange });
  assert.equal(applied.valid, true);
  assert.equal(applied.exerciseProgress.loadStepKg, 2.5);
  assert.equal(applied.exerciseProgress.nextSuggestion.weightKg, 62.5);
  assert.equal(applied.exerciseProgress.nextSuggestion.targetReps, repRange.min);
  assert.equal(applied.exerciseProgress.nextSuggestion.status, 'active');
  assert.equal(applyExerciseLoadStep({ exerciseProgress: applied.exerciseProgress, exerciseId, loadStepKg: 2.5, repRange }).status, 'already_applied');
  for (const loadStepKg of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(applyExerciseLoadStep({ exerciseProgress: pending, exerciseId, loadStepKg, repRange }).status, 'invalid_load_step');
  }
  const fractional = applyExerciseLoadStep({ exerciseProgress: pending, exerciseId, loadStepKg: 0.25, repRange });
  assert.equal(fractional.valid && fractional.exerciseProgress.nextSuggestion.weightKg, 60.25);
});

test('bodyweight Workout Results are reps-only; weighted exercises still require positive weight', () => {
  for (const bodyweightId of BODYWEIGHT_EXERCISE_IDS) {
    const input = {
      plannedExerciseId: bodyweightId,
      performedExerciseId: bodyweightId,
      role: 'accessory',
      plannedSets: 3,
      plannedRepRange: { min: 8, max: 12 },
      completedSets: [{ setNumber: 1, reps: 8 }],
      performedAt: '2026-09-24T10:00:00.000Z',
    };
    const validated = validateExerciseWorkoutResult(input);
    assert.equal(validated.valid, true);
    assert.deepEqual(validated.value.completedSets, [{ setNumber: 1, reps: 8 }]);
    assert.equal(calculateWorkoutResultE1rm(validated.value).estimated1rmKg, null);
    assert.equal(validateExerciseWorkoutResult({ ...input, completedSets: [{ setNumber: 1, reps: 8, weightKg: 5 }] }).valid, false);
  }
  const weighted = {
    plannedExerciseId: exerciseId,
    performedExerciseId: exerciseId,
    role: 'main',
    plannedSets: 3,
    plannedRepRange: repRange,
    completedSets: [{ setNumber: 1, reps: 8 }],
    performedAt: '2026-09-24T10:00:00.000Z',
  };
  assert.equal(validateExerciseWorkoutResult(weighted).valid, false);
});

test('bodyweight progression increments reps, caps at max, and obeys hard / partial vetoes', () => {
  const bodyPlan = { exerciseId: 'push_up', role: 'accessory', sets: 3, repRange: { min: 8, max: 12 } };
  const current = {
    exerciseId: 'push_up',
    sessionsCompleted: 0,
    nextSuggestion: {
      targetReps: 8,
      repRange: bodyPlan.repRange,
      status: 'active',
      ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
    },
  };
  const bodyResult = (reps, feedback) => ({
    plannedExerciseId: 'push_up',
    performedExerciseId: 'push_up',
    role: 'accessory',
    plannedSets: 3,
    plannedRepRange: bodyPlan.repRange,
    completedSets: reps.map((count, index) => ({ setNumber: index + 1, reps: count })),
    ...(feedback === undefined ? {} : { difficultyFeedback: feedback }),
    performedAt: '2026-09-24T10:00:00.000Z',
  });
  const evaluateBody = (state, input) => evaluateExerciseProgression({
    exerciseProgress: state,
    plannedExercise: bodyPlan,
    workoutResult: input,
    currentDayIndex: 0,
  });

  assert.equal(evaluateBody(current, bodyResult([8, 8, 8])).targetReps, 9);
  assert.equal(evaluateBody({ ...current, nextSuggestion: { ...current.nextSuggestion, targetReps: 12 } }, bodyResult([12, 12, 12])).targetReps, 12);
  assert.equal(evaluateBody(current, bodyResult([12, 12, 12], 'too_hard')).targetReps, 8);
  assert.equal(evaluateBody(current, bodyResult([8, 8])).targetReps, 8);
});
