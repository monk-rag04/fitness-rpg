import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STAGE_ROADMAP_GENERATION_RULE,
  STAGE_SESSION_FOCUS_PRESETS,
  STAGE_SESSION_SPLIT_BY_FREQUENCY,
  CurrentQuestRescheduleError,
  StageRoadmapValidationError,
  addLocalDays,
  compareLocalDates,
  differenceLocalDays,
  generateStageRoadmap,
  getTrainingOffsetsForFrequency,
  rescheduleCurrentQuest,
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

function assertCurrentQuestRescheduleError(roadmap, currentDayIndex, newDate, today, code) {
  assert.throws(
    () => rescheduleCurrentQuest(roadmap, currentDayIndex, newDate, today),
    (error) => error instanceof CurrentQuestRescheduleError && error.code === code,
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

test('delays the current slot, every later slot, and Boss while leaving completed slots untouched', () => {
  const original = roadmap();
  const currentDayIndex = 2;
  const result = rescheduleCurrentQuest(original, currentDayIndex, '2026-09-26', '2026-09-22');

  assert.notEqual(result, original);
  assert.deepEqual(result.days.slice(0, currentDayIndex), original.days.slice(0, currentDayIndex));
  assert.deepEqual(result.days.slice(currentDayIndex).map((day) => day.date),
    original.days.slice(currentDayIndex).map((day) => addLocalDays(day.date, 2)));
  assert.equal(result.days[currentDayIndex].type, 'training');
  assert.deepEqual(result.days[currentDayIndex].sessionFocus, original.days[currentDayIndex].sessionFocus);
  assert.equal(result.days[currentDayIndex].bossMainExposure, original.days[currentDayIndex].bossMainExposure);
  assert.equal(result.days[currentDayIndex + 1].type, 'recovery');
  assert.deepEqual(result.days.map((day) => day.type), original.days.map((day) => day.type));
  assert.equal(result.boss.date, addLocalDays(original.boss.date, 2));
  assert.equal(result.startDate, original.startDate);
  assert.equal(result.durationDays, original.durationDays);
  assert.equal(result.mainExerciseId, original.mainExerciseId);
  assert.equal(result.stageTargetE1rmKg, original.stageTargetE1rmKg);
  assert.equal(result.generationRuleVersion, original.generationRuleVersion);
  assert.deepEqual(original, roadmap());
});

test('same date is a no-op and an index after the Daily Quest range cannot reschedule the Boss', () => {
  const original = roadmap();
  assert.equal(rescheduleCurrentQuest(original, 0, original.days[0].date, '2026-09-22'), original);
  assertCurrentQuestRescheduleError(original, original.days.length, '2026-10-21', '2026-09-22', 'CURRENT_QUEST_UNAVAILABLE');
  assertCurrentQuestRescheduleError(original, -1, '2026-09-23', '2026-09-22', 'INVALID_CURRENT_DAY_INDEX');
  assertCurrentQuestRescheduleError(original, 1.5, '2026-09-23', '2026-09-22', 'INVALID_CURRENT_DAY_INDEX');
});

test('rejects dates before today, before the current slot, malformed dates, and nonexistent dates', () => {
  const original = roadmap();
  assertCurrentQuestRescheduleError(original, 2, '2026-09-23', '2026-09-24', 'DATE_BEFORE_TODAY');
  assertCurrentQuestRescheduleError(original, 2, '2026-09-23', '2026-09-22', 'DATE_BEFORE_CURRENT_QUEST');
  for (const date of ['2026/09/26', '2026-9-26', '2026-02-30', 'not-a-date']) {
    assertCurrentQuestRescheduleError(original, 2, date, '2026-09-22', 'INVALID_DATE');
  }
  assertCurrentQuestRescheduleError(original, 2, '2026-09-26', '2026-02-30', 'INVALID_DATE');
});

test('rescheduling uses calendar arithmetic across month, year, and leap-day boundaries', () => {
  const cases = [
    { startDate: '2026-01-30', index: 0, next: '2026-02-01', shift: 2 },
    { startDate: '2026-12-30', index: 0, next: '2027-01-01', shift: 2 },
    { startDate: '2028-02-28', index: 0, next: '2028-02-29', shift: 1 },
  ];
  for (const { startDate, index, next, shift } of cases) {
    const original = roadmap({ startDate });
    const result = rescheduleCurrentQuest(original, index, next, startDate);
    assert.equal(result.days[0].date, next);
    assert.equal(result.boss.date, addLocalDays(original.boss.date, shift));
  }
  assert.equal(compareLocalDates('2026-12-31', '2027-01-01'), -1);
  assert.equal(differenceLocalDays('2027-01-01', '2026-12-31'), 1);
  assert.equal(differenceLocalDays('2028-03-01', '2028-02-28'), 2);
});

test('a later Current Quest can be rescheduled again without moving earlier slots', () => {
  const original = roadmap();
  const first = rescheduleCurrentQuest(original, 2, '2026-09-26', '2026-09-22');
  const secondCurrentIndex = 4;
  const secondCurrentDate = first.days[secondCurrentIndex].date;
  const second = rescheduleCurrentQuest(first, secondCurrentIndex, '2026-10-01', '2026-09-22');

  assert.deepEqual(second.days.slice(0, secondCurrentIndex), first.days.slice(0, secondCurrentIndex));
  assert.deepEqual(second.days.slice(secondCurrentIndex).map((day) => day.date),
    first.days.slice(secondCurrentIndex).map((day) => addLocalDays(day.date, 3)));
  assert.equal(second.days[secondCurrentIndex].date, addLocalDays(secondCurrentDate, 3));
  assert.equal(second.boss.date, addLocalDays(first.boss.date, 3));
  assert.deepEqual(second.days.map((day) => day.type), first.days.map((day) => day.type));
});
