import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXERCISE_CATALOG,
  EXERCISE_EXP_CATEGORY_BY_ID,
  EXERCISE_EXP_CATEGORY_RULE_VERSION,
  RECOVERY_QUEST_EXP,
  TRAINING_EXP_PER_COMPLETED_PLANNED_SET,
  applyQuestReward,
  calculateRecoveryQuestReward,
  calculateTrainingQuestReward,
  createInitialCharacterGrowth,
} from '../dist/index.js';

const plan = {
  exercises: [
    { exerciseId: 'barbell_bench_press', role: 'main', sets: 3, repRange: { min: 8, max: 10 } },
  ],
};

function result(overrides = {}) {
  return {
    plannedExerciseId: 'barbell_bench_press',
    performedExerciseId: 'barbell_bench_press',
    role: 'main',
    plannedSets: 3,
    plannedRepRange: { min: 8, max: 10 },
    completedSets: [
      { setNumber: 1, weightKg: 60, reps: 8 },
      { setNumber: 2, weightKg: 60, reps: 8 },
      { setNumber: 3, weightKg: 60, reps: 8 },
    ],
    performedAt: '2026-09-24T10:00:00.000Z',
    ...overrides,
  };
}

function planWith(...exercises) {
  return { exercises };
}

test('Exercise EXP mapping is versioned and covers exactly the Catalog IDs once', () => {
  const catalogIds = EXERCISE_CATALOG.map(({ id }) => id).sort();
  const mappedIds = Object.keys(EXERCISE_EXP_CATEGORY_BY_ID).sort();

  assert.equal(EXERCISE_EXP_CATEGORY_RULE_VERSION, 'exercise-exp-category-v1');
  assert.equal(catalogIds.length, 40);
  assert.deepEqual(mappedIds, catalogIds);
  assert.ok(Object.values(EXERCISE_EXP_CATEGORY_BY_ID).every((category) =>
    ['chest', 'back', 'shoulders', 'arms', 'legs'].includes(category),
  ));
});

test('initial CharacterGrowth starts every category and Recovery EXP at zero', () => {
  assert.deepEqual(createInitialCharacterGrowth(), {
    trainingExp: { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0 },
    recoveryExp: 0,
  });
});

test('reward constants define the accepted versioned MVP values', () => {
  assert.equal(TRAINING_EXP_PER_COMPLETED_PLANNED_SET, 5);
  assert.equal(RECOVERY_QUEST_EXP, 10);
});

test('three completed planned sets award 15 EXP', () => {
  const calculation = calculateTrainingQuestReward(4, plan, [result()]);
  assert.deepEqual(calculation, {
    valid: true,
    rewardSummary: {
      dayIndex: 4,
      questType: 'training',
      trainingExpGained: { chest: 15 },
      recoveryExpGained: 0,
      mapProgressGained: 1,
    },
  });
});

test('partial planned sets award only the sets with recorded results', () => {
  const calculation = calculateTrainingQuestReward(0, plan, [result({
    completedSets: [
      { setNumber: 1, weightKg: 60, reps: 8 },
      { setNumber: 2, weightKg: 60, reps: 8 },
    ],
  })]);
  assert.equal(calculation.valid, true);
  assert.deepEqual(calculation.rewardSummary.trainingExpGained, { chest: 10 });
});

test('mixed performed and skipped Exercises reward only performed eligible sets', () => {
  const mixedPlan = planWith(
    plan.exercises[0],
    { exerciseId: 'dumbbell_curl', role: 'accessory', sets: 2, repRange: { min: 8, max: 12 } },
  );
  const calculation = calculateTrainingQuestReward(0, mixedPlan, [result({
    completedSets: [{ setNumber: 1, weightKg: 60, reps: 8 }],
  })], undefined, [
    { exerciseId: 'dumbbell_curl', reason: 'time_constraint', pledgeAccepted: true },
  ]);
  assert.equal(calculation.valid, true);
  assert.deepEqual(calculation.rewardSummary.trainingExpGained, { chest: 5 });

  const allSkipped = calculateTrainingQuestReward(0, mixedPlan, [], undefined, [
    { exerciseId: 'barbell_bench_press', reason: 'condition', pledgeAccepted: true },
    { exerciseId: 'dumbbell_curl', reason: 'other', pledgeAccepted: true },
  ]);
  assert.deepEqual(allSkipped, { valid: false, code: 'QUEST_NOT_READY' });
});

test('extra sets and out-of-range set numbers cannot increase EXP', () => {
  const calculation = calculateTrainingQuestReward(0, plan, [result({
    completedSets: [
      { setNumber: 1, weightKg: 60, reps: 8 },
      { setNumber: 2, weightKg: 60, reps: 8 },
      { setNumber: 99, weightKg: 60, reps: 8 },
    ],
  })]);
  assert.equal(calculation.valid, true);
  assert.deepEqual(calculation.rewardSummary.trainingExpGained, { chest: 10 });
});

test('multiple exercises in one category are combined and zero-gain categories omitted', () => {
  const multiPlan = planWith(
    plan.exercises[0],
    { exerciseId: 'dumbbell_chest_fly', role: 'accessory', sets: 2, repRange: { min: 10, max: 15 } },
    { exerciseId: 'dumbbell_curl', role: 'accessory', sets: 2, repRange: { min: 8, max: 12 } },
  );
  const calculation = calculateTrainingQuestReward(2, multiPlan, [
    result(),
    result({
      plannedExerciseId: 'dumbbell_chest_fly',
      performedExerciseId: 'dumbbell_chest_fly',
      role: 'accessory',
      plannedSets: 2,
      plannedRepRange: { min: 10, max: 15 },
      completedSets: [{ setNumber: 1, weightKg: 8, reps: 12 }, { setNumber: 2, weightKg: 8, reps: 10 }],
    }),
    result({
      plannedExerciseId: 'dumbbell_curl',
      performedExerciseId: 'dumbbell_curl',
      role: 'accessory',
      plannedSets: 2,
      plannedRepRange: { min: 8, max: 12 },
      completedSets: [{ setNumber: 1, weightKg: 8, reps: 10 }, { setNumber: 99, weightKg: 8, reps: 10 }],
    }),
  ]);
  assert.equal(calculation.valid, true);
  assert.deepEqual(calculation.rewardSummary.trainingExpGained, { chest: 25, arms: 5 });
});

test('a valid allowed substitution is classified by performedExerciseId', () => {
  const equipmentProfile = {
    id: 'dumbbell-gym',
    displayName: 'Dumbbell Gym',
    availableEquipmentIds: ['dumbbell', 'flat_bench'],
  };
  const calculation = calculateTrainingQuestReward(0, plan, [result({
    performedExerciseId: 'dumbbell_bench_press',
  })], equipmentProfile);
  assert.equal(calculation.valid, true);
  assert.deepEqual(calculation.rewardSummary.trainingExpGained, { chest: 15 });
});

test('rep-range misses remain reward-eligible when the set result is valid', () => {
  const calculation = calculateTrainingQuestReward(0, plan, [result({
    completedSets: [{ setNumber: 1, weightKg: 60, reps: 6 }],
  })]);
  assert.equal(calculation.valid, true);
  assert.deepEqual(calculation.rewardSummary.trainingExpGained, { chest: 5 });
});

test('only validated plan-consistent results can be rewarded', () => {
  const invalid = calculateTrainingQuestReward(0, plan, [result({
    role: 'accessory',
  })]);
  const duplicate = calculateTrainingQuestReward(0, plan, [result(), result()]);
  const invalidSubstitution = calculateTrainingQuestReward(0, plan, [result({
    performedExerciseId: 'dumbbell_bench_press',
  })]);

  assert.deepEqual(invalid, { valid: false, code: 'QUEST_NOT_READY' });
  assert.deepEqual(duplicate, { valid: false, code: 'QUEST_NOT_READY' });
  assert.deepEqual(invalidSubstitution, { valid: false, code: 'QUEST_NOT_READY' });
});

test('recorded sets outside planned set numbers yield no category entry', () => {
  const calculation = calculateTrainingQuestReward(0, plan, [result({
    completedSets: [{ setNumber: 99, weightKg: 60, reps: 8 }],
  })]);
  assert.equal(calculation.valid, true);
  assert.deepEqual(calculation.rewardSummary.trainingExpGained, {});
});

test('Recovery reward grants only Recovery EXP and applies immutably', () => {
  const initial = createInitialCharacterGrowth();
  const summary = calculateRecoveryQuestReward(6);
  assert.deepEqual(summary, {
    dayIndex: 6,
    questType: 'recovery',
    trainingExpGained: {},
    recoveryExpGained: 10,
    mapProgressGained: 1,
  });
  const applied = applyQuestReward(initial, summary);
  assert.equal(applied.valid, true);
  assert.deepEqual(applied.characterGrowth, {
    trainingExp: { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0 },
    recoveryExp: 10,
  });
  assert.equal(initial.recoveryExp, 0);
});

test('applyQuestReward rejects malformed growth and summaries without mutation', () => {
  const initial = createInitialCharacterGrowth();
  assert.deepEqual(applyQuestReward({ ...initial, recoveryExp: -1 }, calculateRecoveryQuestReward(0)), {
    valid: false,
    code: 'INVALID_CHARACTER_GROWTH',
  });
  assert.deepEqual(applyQuestReward(initial, {
    ...calculateRecoveryQuestReward(0),
    trainingExpGained: { unknown: 10 },
  }), { valid: false, code: 'INVALID_QUEST_REWARD' });
  assert.equal(initial.trainingExp.chest, 0);
});
