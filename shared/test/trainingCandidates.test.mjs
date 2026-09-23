import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXERCISE_CATALOG,
  TrainingCandidateError,
  buildTrainingCandidates,
  getExerciseById,
  hasRequiredEquipment,
} from '../dist/index.js';

const dumbbellOnlyProfile = {
  id: 'dumbbell-only',
  displayName: 'Dumbbell Only',
  availableEquipmentIds: ['dumbbell'],
};

const barbellAndBenchProfile = {
  id: 'barbell-and-bench',
  displayName: 'Barbell and Flat Bench',
  availableEquipmentIds: ['barbell', 'flat_bench'],
};

test('dumbbell-only profile excludes barbell exercises from planner candidates', () => {
  const result = buildTrainingCandidates({
    equipmentProfile: dumbbellOnlyProfile,
  });

  assert.ok(
    !result.candidateExercises.some(
      (candidate) => candidate.exerciseId === 'barbell_bench_press',
    ),
  );
  assert.ok(
    result.candidateExercises.every(
      (candidate) => !candidate.exerciseId.startsWith('barbell_'),
    ),
  );
});

test('available main exercise is retained separately from other candidates', () => {
  const result = buildTrainingCandidates({
    mainExerciseId: 'barbell_bench_press',
    targetMuscles: ['back'],
    targetMovementPatterns: ['horizontal_pull'],
    equipmentProfile: barbellAndBenchProfile,
  });

  assert.equal(result.mainExercise?.exerciseId, 'barbell_bench_press');
  assert.ok(
    !result.candidateExercises.some(
      (candidate) => candidate.exerciseId === 'barbell_bench_press',
    ),
  );
});

test('unknown main exercise produces an explicit error', () => {
  assert.throws(
    () =>
      buildTrainingCandidates({
        mainExerciseId: 'unknown_exercise',
        equipmentProfile: barbellAndBenchProfile,
      }),
    (error) =>
      error instanceof TrainingCandidateError &&
      error.code === 'MAIN_EXERCISE_NOT_FOUND' &&
      error.mainExerciseId === 'unknown_exercise',
  );
});

test('unavailable main exercise produces an explicit error', () => {
  assert.throws(
    () =>
      buildTrainingCandidates({
        mainExerciseId: 'barbell_bench_press',
        equipmentProfile: dumbbellOnlyProfile,
      }),
    (error) =>
      error instanceof TrainingCandidateError &&
      error.code === 'MAIN_EXERCISE_UNAVAILABLE' &&
      error.mainExerciseId === 'barbell_bench_press',
  );
});

test('chest horizontal-push request contains only matching candidates', () => {
  const result = buildTrainingCandidates({
    targetMuscles: ['chest'],
    targetMovementPatterns: ['horizontal_push'],
    equipmentProfile: barbellAndBenchProfile,
  });

  assert.ok(result.candidateExercises.length > 0);

  for (const candidate of result.candidateExercises) {
    assert.ok(candidate.primaryMuscles.includes('chest'));
    assert.equal(candidate.movementPattern, 'horizontal_push');
  }
});

test('Stage non-exposure excludes the Boss Main and retains focus-compatible candidates', () => {
  const result = buildTrainingCandidates({
    bossMainExerciseId: 'barbell_bench_press',
    bossMainExposure: false,
    targetMuscles: ['chest'],
    targetMovementPatterns: ['horizontal_push'],
    equipmentProfile: barbellAndBenchProfile,
  });

  assert.equal(result.mainExercise, undefined);
  assert.equal(result.bossMainExerciseId, 'barbell_bench_press');
  assert.equal(result.bossMainExposure, false);
  assert.ok(result.candidateExercises.length > 0);
  assert.ok(!result.candidateExercises.some((candidate) => candidate.exerciseId === 'barbell_bench_press'));
});

test('Stage exposure retains the Boss Main as the required primary', () => {
  const result = buildTrainingCandidates({
    bossMainExerciseId: 'barbell_bench_press',
    bossMainExposure: true,
    targetMuscles: ['chest'],
    targetMovementPatterns: ['horizontal_push'],
    equipmentProfile: barbellAndBenchProfile,
  });

  assert.equal(result.mainExercise?.exerciseId, 'barbell_bench_press');
  assert.equal(result.bossMainExposure, true);
  assert.ok(!result.candidateExercises.some((candidate) => candidate.exerciseId === 'barbell_bench_press'));
});

test('difficulty is applied through the deterministic exercise filter', () => {
  const result = buildTrainingCandidates({
    difficulty: 'beginner',
    equipmentProfile: dumbbellOnlyProfile,
  });

  assert.ok(result.candidateExercises.length > 0);
  assert.ok(
    result.candidateExercises.every(
      (candidate) => candidate.difficulty === 'beginner',
    ),
  );
});

test('every planner candidate is available with the equipment profile', () => {
  const result = buildTrainingCandidates({
    equipmentProfile: dumbbellOnlyProfile,
  });

  for (const candidate of result.candidateExercises) {
    const exercise = getExerciseById(candidate.exerciseId);
    assert.ok(exercise);
    assert.ok(hasRequiredEquipment(exercise, dumbbellOnlyProfile));
  }
});

test('every planner candidate ID exists in the exercise catalog', () => {
  const catalogIds = new Set(EXERCISE_CATALOG.map((exercise) => exercise.id));
  const result = buildTrainingCandidates({
    equipmentProfile: barbellAndBenchProfile,
  });

  for (const candidate of result.candidateExercises) {
    assert.ok(catalogIds.has(candidate.exerciseId));
  }
});
