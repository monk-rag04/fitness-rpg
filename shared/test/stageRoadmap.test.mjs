import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STAGE_ROADMAP_GENERATION_RULE,
  STAGE_SESSION_FOCUS_PRESETS,
  STAGE_SESSION_SPLIT_BY_FREQUENCY,
  StageRoadmapRescheduleError,
  StageRoadmapValidationError,
  generateStageRoadmap,
  getTrainingOffsetsForFrequency,
  rescheduleTrainingDay,
} from '../dist/index.js';

function makeInput(overrides = {}) {
  return {
    startDate: '2026-09-22',
    durationDays: 28,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
    ...overrides,
  };
}

function roadmap(overrides = {}) {
  return generateStageRoadmap(makeInput(overrides));
}

function types(roadmap) {
  return roadmap.days.map((day) => day.type);
}

function trainingCount(roadmap) {
  return roadmap.days.filter((day) => day.type === 'training').length;
}

function assertGenerationError(input, code) {
  assert.throws(
    () => generateStageRoadmap(input),
    (error) => error instanceof StageRoadmapValidationError && error.code === code,
  );
}

function assertRescheduleError(roadmap, sourceDate, targetDate, code) {
  assert.throws(
    () => rescheduleTrainingDay(roadmap, sourceDate, targetDate),
    (error) => error instanceof StageRoadmapRescheduleError && error.code === code,
  );
}

for (const durationDays of [14, 21, 28, 35, 42]) {
  test(`generates the selected ${durationDays}-day roadmap and one following boss anchor`, () => {
    const result = roadmap({ durationDays });
    assert.equal(result.days.length, durationDays);
    assert.equal(result.boss.type, 'boss');
    assert.equal(result.boss.date, {
      14: '2026-10-06', 21: '2026-10-13', 28: '2026-10-20',
      35: '2026-10-27', 42: '2026-11-03',
    }[durationDays]);
    assert.equal(result.days[0].type, 'training');
    assert.ok(result.days.some((day) => day.type === 'recovery'));
  });
}

test('uses the D-026 generation rule and preserves D-025 stage target input', () => {
  const result = roadmap();
  assert.equal(result.generationRuleVersion, 'stage-roadmap-even-spread-v1');
  assert.equal(result.generationRuleVersion, STAGE_ROADMAP_GENERATION_RULE.version);
  assert.equal(result.stageTargetE1rmKg, 75);
  assert.equal(result.mainExerciseId, 'barbell_bench_press');
});

test('uses exact relative weekly even-spread offsets for frequencies 1 through 7', () => {
  const expected = {
    1: [0],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  for (const [frequency, offsets] of Object.entries(expected)) {
    assert.deepEqual(getTrainingOffsetsForFrequency(Number(frequency)), offsets);
  }
});

test('repeats the weekly pattern with exact weekly and full-roadmap training counts', () => {
  const result = roadmap({ durationDays: 28, trainingFrequencyPerWeek: 3 });
  assert.deepEqual(types(result).slice(0, 7), [
    'training', 'recovery', 'training', 'recovery', 'training', 'recovery', 'recovery',
  ]);
  for (let week = 0; week < 4; week += 1) {
    assert.equal(result.days.slice(week * 7, week * 7 + 7).filter((day) => day.type === 'training').length, 3);
  }
  assert.equal(trainingCount(result), 12);
  assert.equal(trainingCount(roadmap({ durationDays: 42, trainingFrequencyPerWeek: 5 })), 30);
});

test('frequency three uses deterministic Upper, Lower, Full Body focus and Boss exposure', () => {
  const result = roadmap();
  const trainingDays = result.days.filter((day) => day.type === 'training');
  assert.deepEqual(trainingDays.slice(0, 3).map((day) => day.sessionFocus.targetMuscles), [
    ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
    ['quads', 'hamstrings', 'glutes', 'calves'],
    ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves'],
  ]);
  assert.deepEqual(trainingDays.slice(0, 3).map((day) => day.bossMainExposure), [true, false, true]);
  for (const day of result.days) {
    if (day.type === 'training') {
      assert.ok(Array.isArray(day.sessionFocus.targetMovementPatterns));
    } else {
      assert.equal(Object.hasOwn(day, 'sessionFocus'), false);
      assert.equal(Object.hasOwn(day, 'bossMainExposure'), false);
    }
  }
});

test('all supported frequencies use the deterministic session split and bounded Boss exposure', () => {
  const expectedExposureCount = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2 };
  for (const frequency of Object.keys(STAGE_SESSION_SPLIT_BY_FREQUENCY).map(Number)) {
    const result = roadmap({ durationDays: 14, trainingFrequencyPerWeek: frequency });
    const trainingDays = result.days.filter((day) => day.type === 'training');
    const cycle = STAGE_SESSION_SPLIT_BY_FREQUENCY[frequency];
    assert.deepEqual(
      trainingDays.slice(0, cycle.length).map((day) => day.sessionFocus),
      cycle.map((preset) => STAGE_SESSION_FOCUS_PRESETS[preset]),
    );
    assert.equal(trainingDays.slice(0, cycle.length).filter((day) => day.bossMainExposure).length, expectedExposureCount[frequency]);
  }
});

test('Boss Main exposure follows its compatible focus family', () => {
  const expected = {
    barbell_bench_press: [true, false, false, true, false],
    barbell_overhead_press: [true, false, false, true, false],
    barbell_back_squat: [false, false, true, false, true],
    barbell_deadlift: [false, true, false, false, true],
  };
  for (const [exerciseId, presets] of Object.entries(expected)) {
    const result = roadmap({ trainingFrequencyPerWeek: 5, mainExerciseId: exerciseId });
    const trainingDays = result.days.filter((day) => day.type === 'training').slice(0, 5);
    assert.deepEqual(
      trainingDays.map((day) => day.bossMainExposure),
      presets,
    );
  }
});

test('rejects unselected duration, invalid frequency, unknown exercise, and invalid stage target', () => {
  assertGenerationError(makeInput({ durationDays: 20 }), 'INVALID_DURATION_DAYS');
  for (const trainingFrequencyPerWeek of [0, -1, 1.5, 8, NaN, Infinity]) {
    assertGenerationError(makeInput({ trainingFrequencyPerWeek }), 'INVALID_TRAINING_FREQUENCY');
  }
  assertGenerationError(makeInput({ mainExerciseId: 'unknown_exercise' }), 'INVALID_MAIN_EXERCISE_ID');
  for (const stageTargetE1rmKg of [0, -1, NaN, Infinity, -Infinity]) {
    assertGenerationError(makeInput({ stageTargetE1rmKg }), 'INVALID_STAGE_TARGET_E1RM');
  }
});

test('rejects malformed or nonexistent local dates and unknown input fields', () => {
  for (const startDate of ['2026/09/22', '2026-9-22', '2026-02-30', 'not-a-date']) {
    assertGenerationError(makeInput({ startDate }), 'INVALID_START_DATE');
  }
  assertGenerationError({ ...makeInput(), extra: true }, 'INVALID_FIELD');
  assertGenerationError(null, 'INVALID_INPUT_SHAPE');
});

test('uses timezone-independent local date arithmetic across month, year, and leap-year boundaries', () => {
  assert.equal(roadmap({ startDate: '2026-12-31', durationDays: 14 }).days[1].date, '2027-01-01');
  assert.equal(roadmap({ startDate: '2026-12-31', durationDays: 14 }).boss.date, '2027-01-14');
  assert.equal(roadmap({ startDate: '2028-02-28', durationDays: 14 }).days[2].date, '2028-03-01');
});

test('generates deterministic output without depending on Date.now or host timezone', () => {
  assert.deepEqual(roadmap(), roadmap());
});

test('moves a training day to a future recovery day and preserves the session focus', () => {
  const original = roadmap();
  const changed = rescheduleTrainingDay(original, '2026-09-22', '2026-09-23');
  assert.equal(changed.days[0].type, 'recovery');
  assert.deepEqual(changed.days[1], {
    date: '2026-09-23',
    type: 'training',
    sessionFocus: { ...original.days[0].sessionFocus },
    bossMainExposure: true,
  });
  assert.equal(trainingCount(changed), trainingCount(original));
  assert.equal(changed.boss.date, original.boss.date);
  assert.equal(changed.durationDays, original.durationDays);
  assert.equal(changed.stageTargetE1rmKg, original.stageTargetE1rmKg);
  assert.deepEqual(changed.days.slice(2), original.days.slice(2));
  assert.equal(original.days[0].type, 'training');
});

test('rejects invalid schedule changes without changing roadmap state', () => {
  const original = roadmap();
  assertRescheduleError(original, '2026-09-23', '2026-09-24', 'SOURCE_NOT_TRAINING');
  assertRescheduleError(original, '2026-09-22', '2026-09-24', 'TARGET_NOT_RECOVERY');
  assertRescheduleError(original, '2026-09-22', '2026-09-22', 'SOURCE_EQUALS_TARGET');
  assertRescheduleError(original, '2026-09-24', '2026-09-23', 'TARGET_NOT_FUTURE');
  assertRescheduleError(original, '2026-09-22', '2026-10-20', 'TARGET_IS_BOSS_DATE');
  assertRescheduleError(original, '2026-09-22', '2026-10-21', 'DATE_OUTSIDE_ROADMAP');
  assertRescheduleError(original, '2026-02-30', '2026-09-23', 'INVALID_DATE');
});
