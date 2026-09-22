import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EQUIPMENT_IDS,
  buildTrainingCandidates,
  validateTrainingPlanDraft,
} from '../dist/index.js';

const barbellAndBenchProfile = {
  id: 'barbell-and-bench',
  displayName: 'Barbell and Flat Bench',
  availableEquipmentIds: ['barbell', 'flat_bench'],
};

const candidatesWithMain = buildTrainingCandidates({
  mainExerciseId: 'barbell_bench_press',
  targetMuscles: ['chest'],
  targetMovementPatterns: ['horizontal_push'],
  equipmentProfile: barbellAndBenchProfile,
});

const candidatesWithoutMain = buildTrainingCandidates({
  equipmentProfile: barbellAndBenchProfile,
});

const candidatesForGuardrails = buildTrainingCandidates({
  mainExerciseId: 'barbell_bench_press',
  equipmentProfile: {
    id: 'all-equipment-test-profile',
    displayName: 'All equipment test fixture',
    availableEquipmentIds: EQUIPMENT_IDS,
  },
});

function plannedExercise(
  exerciseId = 'barbell_bench_press',
  role = 'main',
) {
  return { exerciseId, role, sets: 3, repRange: { min: 5, max: 8 } };
}

function errorCodes(result) {
  assert.equal(result.valid, false);
  return result.errors.map((error) => error.code);
}

test('valid plan passes and preserves exercise order', () => {
  const draft = {
    exercises: [
      plannedExercise(),
      plannedExercise('push_up', 'accessory'),
    ],
  };

  const result = validateTrainingPlanDraft(draft, candidatesWithMain);

  assert.equal(result.valid, true);
  assert.deepEqual(result.plan, draft);
  assert.notEqual(result.plan, draft);
});

test('empty plan fails', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('EMPTY_PLAN'));
});

test('unknown exercise ID is not allowed', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise(), plannedExercise('unknown_exercise', 'accessory')] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('EXERCISE_NOT_ALLOWED'));
});

test('catalog exercise outside this candidate result is not allowed', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise(), plannedExercise('chest_press_machine', 'accessory')] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('EXERCISE_NOT_ALLOWED'));
});

test('missing required main exercise fails', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise('push_up', 'accessory')] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('MAIN_EXERCISE_MISSING'));
});

test('required main exercise with accessory role fails', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise('barbell_bench_press', 'accessory')] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('MAIN_EXERCISE_ROLE_INVALID'));
});

test('multiple main roles fail', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise(), plannedExercise('push_up', 'main')] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('MULTIPLE_MAIN_EXERCISES'));
});

test('duplicate exercise ID fails', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise(), plannedExercise('barbell_bench_press', 'accessory')] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('DUPLICATE_EXERCISE'));
});

for (const sets of [0, -1, 1.5, NaN, Infinity]) {
  test(`invalid sets ${sets} fail`, () => {
    const result = validateTrainingPlanDraft(
      { exercises: [{ ...plannedExercise(), sets }] },
      candidatesWithMain,
    );

    assert.ok(errorCodes(result).includes('INVALID_SETS'));
  });
}

for (const [field, value] of [
  ['min', 0],
  ['min', -1],
  ['min', 1.5],
  ['max', 0],
  ['max', -1],
  ['max', 2.5],
]) {
  test(`invalid repRange.${field} ${value} fails`, () => {
    const repRange = { min: 5, max: 8, [field]: value };
    const result = validateTrainingPlanDraft(
      { exercises: [{ ...plannedExercise(), repRange }] },
      candidatesWithMain,
    );

    assert.ok(errorCodes(result).includes('INVALID_REP_RANGE'));
  });
}

test('rep range min greater than max fails', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [{ ...plannedExercise(), repRange: { min: 9, max: 8 } }] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('INVALID_REP_RANGE'));
});

test('unknown role fails', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise('barbell_bench_press', 'warmup')] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('INVALID_ROLE'));
});

test('main role is optional when no main exercise was requested', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [plannedExercise('push_up', 'accessory')] },
    candidatesWithoutMain,
  );

  assert.equal(result.valid, true);
});

test('D-030 rejects a plan with more than six exercises', () => {
  const ids = [
    'barbell_bench_press',
    'dumbbell_bench_press',
    'incline_dumbbell_press',
    'chest_press_machine',
    'cable_chest_fly',
    'dumbbell_chest_fly',
    'push_up',
  ];
  const draft = {
    exercises: ids.map((exerciseId, index) => ({
      exerciseId,
      role: index === 0 ? 'main' : 'accessory',
      sets: 1,
      repRange: index === 0 ? { min: 1, max: 10 } : { min: 5, max: 20 },
    })),
  };

  assert.ok(errorCodes(validateTrainingPlanDraft(draft, candidatesForGuardrails))
    .includes('TOO_MANY_EXERCISES'));
});

test('D-030 rejects sets and rep ranges outside the role limits', () => {
  const tooManySets = validateTrainingPlanDraft(
    { exercises: [{ ...plannedExercise(), sets: 6 }] },
    candidatesWithMain,
  );
  assert.ok(errorCodes(tooManySets).includes('INVALID_SETS'));

  const mainRepRange = validateTrainingPlanDraft(
    { exercises: [{ ...plannedExercise(), repRange: { min: 1, max: 11 } }] },
    candidatesWithMain,
  );
  assert.ok(errorCodes(mainRepRange).includes('INVALID_REP_RANGE'));

  const accessoryRepRange = validateTrainingPlanDraft(
    {
      exercises: [
        plannedExercise(),
        plannedExercise('push_up', 'accessory'),
      ].map((exercise, index) => index === 1
        ? { ...exercise, repRange: { min: 4, max: 20 } }
        : exercise),
    },
    candidatesWithMain,
  );
  assert.ok(errorCodes(accessoryRepRange).includes('INVALID_REP_RANGE'));
});

test('D-030 rejects a plan with more than twenty working sets', () => {
  const result = validateTrainingPlanDraft(
    {
      exercises: [
        { exerciseId: 'barbell_bench_press', role: 'main', sets: 5, repRange: { min: 1, max: 10 } },
        { exerciseId: 'dumbbell_bench_press', role: 'accessory', sets: 5, repRange: { min: 5, max: 20 } },
        { exerciseId: 'incline_dumbbell_press', role: 'accessory', sets: 5, repRange: { min: 5, max: 20 } },
        { exerciseId: 'chest_press_machine', role: 'accessory', sets: 4, repRange: { min: 5, max: 20 } },
        { exerciseId: 'cable_chest_fly', role: 'accessory', sets: 1, repRange: { min: 5, max: 20 } },
        { exerciseId: 'dumbbell_chest_fly', role: 'accessory', sets: 1, repRange: { min: 5, max: 20 } },
      ],
    },
    candidatesForGuardrails,
  );

  assert.ok(errorCodes(result).includes('TOO_MANY_WORKING_SETS'));
});

test('untrusted input shape fails without throwing', () => {
  for (const draft of [null, {}, { exercises: null }, { exercises: [null] }]) {
    const result = validateTrainingPlanDraft(draft, candidatesWithMain);
    assert.ok(errorCodes(result).includes('INVALID_PLAN_SHAPE'));
  }
});

test('weight and other unsupported fields are rejected', () => {
  const result = validateTrainingPlanDraft(
    { exercises: [{ ...plannedExercise(), weight: 60 }] },
    candidatesWithMain,
  );

  assert.ok(errorCodes(result).includes('INVALID_FIELD'));
});
