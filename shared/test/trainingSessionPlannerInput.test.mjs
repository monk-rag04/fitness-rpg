import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrainingCandidates,
  validateTrainingSessionPlannerInput,
} from '../dist/index.js';

const candidates = buildTrainingCandidates({
  mainExerciseId: 'barbell_bench_press',
  targetMuscles: ['chest'],
  targetMovementPatterns: ['horizontal_push'],
  equipmentProfile: {
    id: 'barbell-bench',
    displayName: 'Barbell and Bench',
    availableEquipmentIds: ['barbell', 'flat_bench'],
  },
});

function makeInput(context = {}) {
  return {
    candidates,
    context: {
      trainingExperienceMonths: 8,
      sessionFocus: {
        targetMuscles: ['chest'],
        targetMovementPatterns: ['horizontal_push'],
      },
      ...context,
    },
  };
}

function codes(result) {
  assert.equal(result.valid, false);
  return result.errors.map((error) => error.code);
}

test('valid session input returns a value', () => {
  const result = validateTrainingSessionPlannerInput(makeInput());
  assert.equal(result.valid, true);
  assert.deepEqual(result.value.context.sessionFocus.targetMuscles, ['chest']);
});

test('zero training experience months is valid', () => {
  assert.equal(validateTrainingSessionPlannerInput(makeInput({ trainingExperienceMonths: 0 })).valid, true);
});

for (const months of [-1, 1.5, NaN, Infinity, -Infinity]) {
  test(`invalid trainingExperienceMonths ${months} is rejected`, () => {
    assert.ok(codes(validateTrainingSessionPlannerInput(makeInput({ trainingExperienceMonths: months })))
      .includes('INVALID_TRAINING_EXPERIENCE_MONTHS'));
  });
}

test('unknown muscle and movement pattern are rejected', () => {
  const result = validateTrainingSessionPlannerInput(makeInput({
    sessionFocus: {
      targetMuscles: ['unknown_muscle'],
      targetMovementPatterns: ['unknown_movement'],
    },
  }));
  assert.ok(codes(result).includes('INVALID_TARGET_MUSCLE'));
  assert.ok(result.errors.some((error) => error.code === 'INVALID_TARGET_MOVEMENT_PATTERN'));
});

test('unknown fields at all input levels are rejected', () => {
  const base = makeInput({ extra: true, sessionFocus: { targetMuscles: ['chest'], extra: true } });
  const result = validateTrainingSessionPlannerInput({ ...base, extra: true });
  assert.equal(codes(result).filter((code) => code === 'INVALID_FIELD').length, 3);
});

test('missing sessionFocus is rejected', () => {
  assert.ok(codes(validateTrainingSessionPlannerInput(makeInput({ sessionFocus: undefined })))
    .includes('INVALID_SESSION_FOCUS'));
});

test('targetMuscles must be an array', () => {
  assert.ok(codes(validateTrainingSessionPlannerInput(makeInput({ sessionFocus: { targetMuscles: 'chest' } })))
    .includes('INVALID_TARGET_MUSCLES'));
});

test('targetMovementPatterns may be omitted but must be an array when present', () => {
  assert.equal(validateTrainingSessionPlannerInput(makeInput({ sessionFocus: { targetMuscles: ['chest'] } })).valid, true);
  assert.ok(codes(validateTrainingSessionPlannerInput(makeInput({
    sessionFocus: { targetMuscles: ['chest'], targetMovementPatterns: 'horizontal_push' },
  }))).includes('INVALID_TARGET_MOVEMENT_PATTERNS'));
});

test('candidate IDs and metadata must match the catalog', () => {
  const invalid = { ...candidates, candidateExercises: [{
    ...candidates.candidateExercises[0],
    displayName: 'Fabricated',
  }] };
  assert.ok(codes(validateTrainingSessionPlannerInput({ ...makeInput(), candidates: invalid }))
    .includes('INVALID_CANDIDATE'));
});

test('Stage exposure metadata requires the Boss Main as the separate main candidate', () => {
  const stageCandidates = buildTrainingCandidates({
    bossMainExerciseId: 'barbell_bench_press',
    bossMainExposure: true,
    targetMuscles: ['chest'],
    targetMovementPatterns: ['horizontal_push'],
    equipmentProfile: {
      id: 'stage-equipment',
      displayName: 'Barbell and bench',
      availableEquipmentIds: ['barbell', 'flat_bench'],
    },
  });
  assert.equal(validateTrainingSessionPlannerInput({
    candidates: { ...stageCandidates, mainExercise: undefined },
    context: makeInput().context,
  }).valid, false);
});

test('duplicate candidate IDs are rejected', () => {
  const invalid = { ...candidates, candidateExercises: [
    candidates.candidateExercises[0], candidates.candidateExercises[0],
  ] };
  assert.ok(codes(validateTrainingSessionPlannerInput({ ...makeInput(), candidates: invalid }))
    .includes('DUPLICATE_CANDIDATE'));
});

test('empty focus and focus without overlap are not silently made Product rules', () => {
  assert.equal(validateTrainingSessionPlannerInput(makeInput({ sessionFocus: { targetMuscles: [] } })).valid, true);
  assert.equal(validateTrainingSessionPlannerInput(makeInput({ sessionFocus: { targetMuscles: ['calves'] } })).valid, true);
});

test('malformed input and missing candidates are rejected', () => {
  assert.ok(codes(validateTrainingSessionPlannerInput(null)).includes('INVALID_INPUT_SHAPE'));
  assert.ok(codes(validateTrainingSessionPlannerInput({ context: makeInput().context })).includes('INVALID_CANDIDATES'));
});
