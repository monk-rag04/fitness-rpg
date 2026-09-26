import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASIC_STAGE_EQUIPMENT_IDS,
  BODYWEIGHT_EXERCISE_IDS,
  NO_EQUIPMENT_EXERCISE_IDS,
  OPTIONAL_STAGE_EQUIPMENT_IDS,
  buildTrainingCandidates,
  evaluateStageEquipmentReadiness,
  validateExerciseWorkoutResult,
} from '../dist/index.js';

function profile(availableEquipmentIds) {
  return { id: 'equipment-readiness-test', displayName: 'Test', availableEquipmentIds };
}

test('the 16 Equipment IDs are partitioned into eight basic and eight optional choices', () => {
  assert.equal(BASIC_STAGE_EQUIPMENT_IDS.length, 8);
  assert.equal(OPTIONAL_STAGE_EQUIPMENT_IDS.length, 8);
  assert.equal(new Set([...BASIC_STAGE_EQUIPMENT_IDS, ...OPTIONAL_STAGE_EQUIPMENT_IDS]).size, 16);
});

test('core 0/1 or missing Bench requirement blocks; two core and no optional permits generation', () => {
  const none = evaluateStageEquipmentReadiness('barbell_bench_press', []);
  const one = evaluateStageEquipmentReadiness('barbell_bench_press', ['barbell']);
  const wrongTwo = evaluateStageEquipmentReadiness('barbell_bench_press', ['barbell', 'dumbbell']);
  const ready = evaluateStageEquipmentReadiness('barbell_bench_press', ['barbell', 'flat_bench']);
  assert.deepEqual([none.ready, one.ready, wrongTwo.ready, ready.ready], [false, false, false, true]);
  assert.equal(one.selectedBasicCount, 1);
  assert.equal(wrongTwo.selectedBasicCount, 2);
  assert.deepEqual(wrongTwo.missingMainEquipmentIds, ['flat_bench']);
  assert.equal(ready.mainAvailable, true);
  assert.equal(ready.selectedBasicCount, 2);
});

test('Deadlift permits barbell plus dumbbell without rack or optional machines', () => {
  const readiness = evaluateStageEquipmentReadiness('barbell_deadlift', ['barbell', 'dumbbell']);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.mainRequiredEquipmentIds, ['barbell']);
});

test('no-equipment candidates cover five body categories; pull-up still needs its bar', () => {
  const focus = [
    ['chest', 'push_up'],
    ['back', 'reverse_snow_angel'],
    ['shoulders', 'pike_push_up'],
    ['triceps', 'close_grip_push_up'],
    ['quads', 'bodyweight_squat'],
  ];
  for (const [muscle, expectedId] of focus) {
    const candidates = buildTrainingCandidates({ equipmentProfile: profile([]), targetMuscles: [muscle] });
    assert.ok(candidates.candidateExercises.some((item) => item.exerciseId === expectedId), muscle);
  }
  assert.equal(NO_EQUIPMENT_EXERCISE_IDS.includes('pull_up'), false);
  assert.equal(BODYWEIGHT_EXERCISE_IDS.includes('pull_up'), true);
  const withoutBar = buildTrainingCandidates({ equipmentProfile: profile([]), targetMuscles: ['back'] });
  const withBar = buildTrainingCandidates({ equipmentProfile: profile(['pullup_bar']), targetMuscles: ['back'] });
  assert.equal(withoutBar.candidateExercises.some((item) => item.exerciseId === 'pull_up'), false);
  assert.equal(withBar.candidateExercises.some((item) => item.exerciseId === 'pull_up'), true);
});

test('new bodyweight results require reps only; weighted results still require kg', () => {
  for (const exerciseId of ['close_grip_push_up', 'reverse_snow_angel', 'pike_push_up',
    'bodyweight_squat', 'reverse_lunge', 'bodyweight_calf_raise']) {
    const result = {
      plannedExerciseId: exerciseId, performedExerciseId: exerciseId,
      role: 'accessory', plannedSets: 3, plannedRepRange: { min: 8, max: 12 },
      completedSets: [{ setNumber: 1, reps: 8 }], performedAt: '2026-09-24T10:00:00.000Z',
    };
    assert.equal(validateExerciseWorkoutResult(result).valid, true, exerciseId);
    assert.equal(validateExerciseWorkoutResult({
      ...result, completedSets: [{ setNumber: 1, weightKg: 0, reps: 8 }],
    }).valid, false, exerciseId);
  }
  const weighted = {
    plannedExerciseId: 'dumbbell_curl', performedExerciseId: 'dumbbell_curl',
    role: 'accessory', plannedSets: 3, plannedRepRange: { min: 8, max: 12 },
    completedSets: [{ setNumber: 1, reps: 8 }], performedAt: '2026-09-24T10:00:00.000Z',
  };
  assert.equal(validateExerciseWorkoutResult(weighted).valid, false);
});
