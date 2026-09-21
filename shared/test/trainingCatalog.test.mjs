import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EQUIPMENT_CATALOG,
  EXERCISE_CATALOG,
  filterExercises,
  getSubstitutionCandidates,
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

const dumbbellAndBenchProfile = {
  id: 'dumbbell-and-bench',
  displayName: 'Dumbbell and Flat Bench',
  availableEquipmentIds: ['dumbbell', 'flat_bench'],
};

function idsOf(exercises) {
  return exercises.map((exercise) => exercise.id);
}

test('dumbbell-only equipment excludes barbell bench press', () => {
  const candidateIds = idsOf(
    filterExercises({ equipmentProfile: dumbbellOnlyProfile }),
  );

  assert.ok(!candidateIds.includes('barbell_bench_press'));
});

test('barbell and flat bench enable barbell bench press', () => {
  const candidateIds = idsOf(
    filterExercises({ equipmentProfile: barbellAndBenchProfile }),
  );

  assert.ok(candidateIds.includes('barbell_bench_press'));
});

test('chest horizontal push filter contains only matching exercises', () => {
  const candidates = filterExercises({
    primaryMuscle: 'chest',
    movementPattern: 'horizontal_push',
  });

  assert.ok(candidates.length > 0);

  for (const exercise of candidates) {
    assert.ok(exercise.primaryMuscles.includes('chest'));
    assert.equal(exercise.movementPattern, 'horizontal_push');
  }
});

test('bench press substitution includes dumbbell bench press when available', () => {
  const candidateIds = idsOf(
    getSubstitutionCandidates(
      'barbell_bench_press',
      dumbbellAndBenchProfile,
    ),
  );

  assert.ok(candidateIds.includes('dumbbell_bench_press'));
});

test('bench press substitution excludes unavailable chest press machine', () => {
  const candidateIds = idsOf(
    getSubstitutionCandidates(
      'barbell_bench_press',
      dumbbellAndBenchProfile,
    ),
  );

  assert.ok(!candidateIds.includes('chest_press_machine'));
});

test('catalog integrity', async (context) => {
  const equipmentIds = EQUIPMENT_CATALOG.map((equipment) => equipment.id);
  const exerciseIds = EXERCISE_CATALOG.map((exercise) => exercise.id);
  const equipmentIdSet = new Set(equipmentIds);
  const exerciseIdSet = new Set(exerciseIds);

  await context.test('equipment IDs are unique', () => {
    assert.equal(equipmentIdSet.size, equipmentIds.length);
  });

  await context.test('exercise IDs are unique', () => {
    assert.equal(exerciseIdSet.size, exerciseIds.length);
  });

  await context.test('required equipment IDs exist in the equipment catalog', () => {
    for (const exercise of EXERCISE_CATALOG) {
      for (const equipmentOption of exercise.requiredEquipmentOptions) {
        for (const equipmentId of equipmentOption) {
          assert.ok(
            equipmentIdSet.has(equipmentId),
            `${exercise.id} references unknown equipment ${equipmentId}`,
          );
        }
      }
    }
  });

  await context.test('alternative exercise IDs exist in the exercise catalog', () => {
    for (const exercise of EXERCISE_CATALOG) {
      for (const alternativeId of exercise.alternativeExerciseIds) {
        assert.ok(
          exerciseIdSet.has(alternativeId),
          `${exercise.id} references unknown alternative ${alternativeId}`,
        );
      }
    }
  });

  await context.test('exercises do not reference themselves as alternatives', () => {
    for (const exercise of EXERCISE_CATALOG) {
      assert.ok(!exercise.alternativeExerciseIds.includes(exercise.id));
    }
  });

  await context.test('every exercise has at least one primary muscle', () => {
    for (const exercise of EXERCISE_CATALOG) {
      assert.ok(exercise.primaryMuscles.length > 0);
    }
  });

  await context.test('required equipment options have a valid structure', () => {
    for (const exercise of EXERCISE_CATALOG) {
      const options = exercise.requiredEquipmentOptions;

      assert.ok(Array.isArray(options));
      assert.ok(options.length > 0, `${exercise.id} has no equipment options`);

      const normalizedOptions = new Set();

      for (const option of options) {
        assert.ok(Array.isArray(option));
        assert.equal(
          new Set(option).size,
          option.length,
          `${exercise.id} repeats equipment in an option`,
        );

        const normalizedOption = [...option].sort().join('|');
        assert.ok(
          !normalizedOptions.has(normalizedOption),
          `${exercise.id} repeats an equipment option`,
        );
        normalizedOptions.add(normalizedOption);

        if (option.length === 0) {
          assert.equal(
            options.length,
            1,
            `${exercise.id} mixes equipment-free and equipped options`,
          );
        }
      }
    }
  });
});
