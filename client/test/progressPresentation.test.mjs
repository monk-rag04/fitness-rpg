import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialCharacterGrowth, generateStageRoadmap, getExerciseExpCategory } from '@fitness-rpg/shared';
import { getBottomNavigationItems } from '../src/components/bottomNavigationItems.ts';
import { deriveCharacterScreenModel } from '../src/features/character/characterPresentation.ts';
import { deriveProgressScreenModel } from '../src/features/progress/progressPresentation.ts';

function makeRoadmap() {
  return generateStageRoadmap({
    startDate: '2026-09-25',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 45,
  });
}

function makeSource(overrides = {}) {
  const roadmap = makeRoadmap();
  return {
    roadmap,
    progress: { currentDayIndex: 0 },
    exerciseProgressById: {},
    workoutResultsByDay: {},
    characterGrowth: createInitialCharacterGrowth(),
    mainStrengthGoalE1rmKg: 60,
    ...overrides,
  };
}

function makeResult(exerciseId, sets, overrides = {}) {
  return {
    plannedExerciseId: exerciseId,
    performedExerciseId: exerciseId,
    role: exerciseId === 'barbell_bench_press' ? 'main' : 'accessory',
    plannedSets: 3,
    plannedRepRange: { min: 5, max: 8 },
    completedSets: sets,
    performedAt: '2026-09-25T10:00:00.000Z',
    ...overrides,
  };
}

function activeSuggestion({ weightKg, targetReps = 8 } = {}) {
  return {
    ...(weightKg === undefined ? {} : { weightKg }),
    targetReps,
    repRange: { min: 5, max: 8 },
    status: 'active',
    ruleVersion: 'exercise-progression-v1',
  };
}

function mainState(overrides = {}) {
  return { exerciseId: 'barbell_bench_press', sessionsCompleted: 0, ...overrides };
}

function exerciseState(exerciseId, overrides = {}) {
  return { exerciseId, sessionsCompleted: 1, ...overrides };
}

function firstTrainingDayIndex(roadmap) {
  return roadmap.days.findIndex((day) => day.type === 'training');
}

test('0 progress is an empty Training Log with zero counters and no exercise records', () => {
  const model = deriveProgressScreenModel(makeSource());
  assert.deepEqual(model.stageProgress, {
    completedQuestCount: 0,
    totalQuestCount: 14,
    trainingQuestClearCount: 0,
    recoveryQuestClearCount: 0,
    bossQuestsRemaining: 14,
    percent: 0,
  });
  assert.equal(model.mainStrength.latest, null);
  assert.equal(model.mainStrength.nextSuggestion, '目安未設定');
  assert.deepEqual(model.exerciseRecords, []);
});

test('Training and Recovery clear counts come from the completed Roadmap prefix', () => {
  const roadmap = makeRoadmap();
  const completedCount = 6;
  const model = deriveProgressScreenModel(makeSource({ roadmap, progress: { currentDayIndex: completedCount } }));
  const completedDays = roadmap.days.slice(0, completedCount);
  assert.equal(model.stageProgress.trainingQuestClearCount, completedDays.filter((day) => day.type === 'training').length);
  assert.equal(model.stageProgress.recoveryQuestClearCount, completedDays.filter((day) => day.type === 'recovery').length);
});

test('completed and total Quest counts use StageProgress and daily Roadmap nodes', () => {
  const model = deriveProgressScreenModel(makeSource({ progress: { currentDayIndex: 4 } }));
  assert.equal(model.stageProgress.completedQuestCount, 4);
  assert.equal(model.stageProgress.totalQuestCount, 14);
});

test('Boss remaining is total Quest count minus completed Quest count', () => {
  const model = deriveProgressScreenModel(makeSource({ progress: { currentDayIndex: 4 } }));
  assert.equal(model.stageProgress.bossQuestsRemaining, 10);
});

test('Main START is the Task 4E Exercise Baseline', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: mainState({
        baseline: { weightKg: 40, reps: 3, source: 'onboarding', capturedDayIndex: 0 },
      }),
    },
  }));
  assert.deepEqual(model.mainStrength.start, { weightKg: 40, reps: 3 });
  assert.equal(model.mainStrength.startEstimated, false);
});

test('estimated profile is labeled as provisional START and not as latest actual', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: mainState({
        baseline: { weightKg: 35, reps: 5, source: 'estimated_profile', capturedDayIndex: 0 },
      }),
    },
  }));
  assert.equal(model.mainStrength.startEstimated, true);
  assert.equal(model.mainStrength.latest, null);
});

test('Main latest is actual record from the latest cleared Training Quest', () => {
  const roadmap = makeRoadmap();
  const dayIndex = firstTrainingDayIndex(roadmap);
  const model = deriveProgressScreenModel(makeSource({
    roadmap,
    progress: { currentDayIndex: dayIndex + 1 },
    workoutResultsByDay: {
      [dayIndex]: { main: makeResult('barbell_bench_press', [
        { setNumber: 1, weightKg: 40, reps: 5 },
        { setNumber: 3, weightKg: 42.5, reps: 7 },
      ]) },
    },
  }));
  assert.deepEqual(model.mainStrength.latest, { weightKg: 42.5, reps: 7 });
});

test('Main latest never substitutes nextSuggestion for actual performance', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: mainState({ nextSuggestion: activeSuggestion({ weightKg: 80 }) }),
    },
  }));
  assert.equal(model.mainStrength.latest, null);
});

test('Main TARGET uses the confirmed Final Goal instead of the Stage Target', () => {
  const model = deriveProgressScreenModel(makeSource({ mainStrengthGoalE1rmKg: 60 }));
  assert.equal(model.mainStrength.targetE1rmKg, 60);
  assert.notEqual(model.mainStrength.targetE1rmKg, makeRoadmap().stageTargetE1rmKg);
});

test('Main NEXT uses the stored ExerciseProgressState suggestion', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: mainState({ nextSuggestion: activeSuggestion({ weightKg: 42.5, targetReps: 8 }) }),
    },
  }));
  assert.equal(model.mainStrength.nextSuggestion, '42.5kg × 8回');
});

test('exercise records use sessionsCompleted and exclude Main and baseline-only exercises', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: mainState({ sessionsCompleted: 5 }),
      lat_pulldown: exerciseState('lat_pulldown', { sessionsCompleted: 4 }),
      leg_extension: exerciseState('leg_extension', {
        sessionsCompleted: 0,
        baseline: { weightKg: 10, reps: 8, source: 'self_report', capturedDayIndex: 0 },
      }),
    },
  }));
  assert.deepEqual(model.exerciseRecords.map(({ exerciseId, sessionsCompleted }) => [exerciseId, sessionsCompleted]), [
    ['lat_pulldown', 4],
  ]);
});

test('exercise initial record uses ExerciseProgressState baseline', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      lat_pulldown: exerciseState('lat_pulldown', {
        baseline: { weightKg: 25, reps: 8, source: 'workout_result', capturedDayIndex: 0 },
      }),
    },
  }));
  assert.deepEqual(model.exerciseRecords[0].initialRecord, { weightKg: 25, reps: 8 });
});

test('exercise latest record is a cleared actual result and uses the highest setNumber', () => {
  const roadmap = makeRoadmap();
  const dayIndex = firstTrainingDayIndex(roadmap);
  const model = deriveProgressScreenModel(makeSource({
    roadmap,
    progress: { currentDayIndex: dayIndex + 1 },
    exerciseProgressById: { lat_pulldown: exerciseState('lat_pulldown') },
    workoutResultsByDay: {
      [dayIndex]: { row: makeResult('lat_pulldown', [
        { setNumber: 1, weightKg: 30, reps: 8 },
        { setNumber: 3, weightKg: 25, reps: 10 },
      ], { plannedExerciseId: 'barbell_bent_over_row' }) },
    },
  }));
  assert.deepEqual(model.exerciseRecords[0].latestRecord, { weightKg: 25, reps: 10 });
});

test('exercise nextSuggestion is rendered independently from latest actual', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      lat_pulldown: exerciseState('lat_pulldown', {
        nextSuggestion: activeSuggestion({ weightKg: 25, targetReps: 11 }),
      }),
    },
  }));
  assert.equal(model.exerciseRecords[0].latestRecord, null);
  assert.equal(model.exerciseRecords[0].nextSuggestion, '25kg × 11回');
});

test('result attribution uses performedExerciseId rather than plannedExerciseId', () => {
  const roadmap = makeRoadmap();
  const dayIndex = firstTrainingDayIndex(roadmap);
  const model = deriveProgressScreenModel(makeSource({
    roadmap,
    progress: { currentDayIndex: dayIndex + 1 },
    exerciseProgressById: {
      lat_pulldown: exerciseState('lat_pulldown'),
      barbell_bent_over_row: exerciseState('barbell_bent_over_row', { sessionsCompleted: 0 }),
    },
    workoutResultsByDay: {
      [dayIndex]: { row: makeResult('lat_pulldown', [{ setNumber: 1, weightKg: 25, reps: 8 }], {
        plannedExerciseId: 'barbell_bent_over_row',
      }) },
    },
  }));
  assert.deepEqual(model.exerciseRecords.map((record) => record.exerciseId), ['lat_pulldown']);
  assert.deepEqual(model.exerciseRecords[0].latestRecord, { weightKg: 25, reps: 8 });
});

test('an uncleared current Quest result is not a latest record', () => {
  const model = deriveProgressScreenModel(makeSource({
    progress: { currentDayIndex: 0 },
    exerciseProgressById: { lat_pulldown: exerciseState('lat_pulldown') },
    workoutResultsByDay: {
      0: { row: makeResult('lat_pulldown', [{ setNumber: 1, weightKg: 30, reps: 8 }]) },
    },
  }));
  assert.equal(model.exerciseRecords[0].latestRecord, null);
});

test('Bodyweight latest actual is reps-only', () => {
  const roadmap = makeRoadmap();
  const dayIndex = firstTrainingDayIndex(roadmap);
  const model = deriveProgressScreenModel(makeSource({
    roadmap,
    progress: { currentDayIndex: dayIndex + 1 },
    exerciseProgressById: { pull_up: exerciseState('pull_up') },
    workoutResultsByDay: {
      [dayIndex]: { pullup: makeResult('pull_up', [
        { setNumber: 1, reps: 6 }, { setNumber: 3, reps: 8 },
      ]) },
    },
  }));
  assert.deepEqual(model.exerciseRecords[0].latestRecord, { reps: 8 });
});

test('Bodyweight NEXT suggestion shows only the stored target reps', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: { pull_up: exerciseState('pull_up', { nextSuggestion: activeSuggestion({ targetReps: 9 }) }) },
  }));
  assert.equal(model.exerciseRecords[0].nextSuggestion, '9回');
});

test('Bodyweight never displays a kg baseline, actual, or suggestion', () => {
  const roadmap = makeRoadmap();
  const dayIndex = firstTrainingDayIndex(roadmap);
  const model = deriveProgressScreenModel(makeSource({
    roadmap,
    progress: { currentDayIndex: dayIndex + 1 },
    exerciseProgressById: { push_up: exerciseState('push_up', {
      baseline: { weightKg: 12, reps: 8, source: 'workout_result', capturedDayIndex: 0 },
      nextSuggestion: activeSuggestion({ weightKg: 20, targetReps: 9 }),
    }) },
    workoutResultsByDay: {
      [dayIndex]: { pushup: makeResult('push_up', [{ setNumber: 1, reps: 8 }]) },
    },
  }));
  const record = model.exerciseRecords[0];
  assert.equal(record.initialRecord, null);
  assert.deepEqual(record.latestRecord, { reps: 8 });
  assert.equal(record.nextSuggestion, '9回');
  assert.equal(Object.hasOwn(record.latestRecord, 'weightKg'), false);
});

test('weight_up_ready is presented as the load-increase timing, without a generated weight', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: { leg_press: exerciseState('leg_press', {
      nextSuggestion: {
        weightKg: 100,
        targetReps: 8,
        repRange: { min: 5, max: 8 },
        status: 'weight_up_ready',
        ruleVersion: 'exercise-progression-v1',
      },
    }) },
  }));
  assert.equal(model.exerciseRecords[0].nextSuggestion, '重量UPのタイミング');
});

test('missing suggestion uses the localized unset label', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: { dumbbell_lateral_raise: exerciseState('dumbbell_lateral_raise') },
  }));
  assert.equal(model.exerciseRecords[0].nextSuggestion, '目安未設定');
});

test('empty Exercise Records is represented by an empty list for the screen copy', () => {
  assert.equal(deriveProgressScreenModel(makeSource()).exerciseRecords.length, 0);
});

test('Character and Progress Main Strength START, LATEST, and TARGET share identical sources', () => {
  const roadmap = makeRoadmap();
  const dayIndex = firstTrainingDayIndex(roadmap);
  const source = makeSource({
    roadmap,
    progress: { currentDayIndex: dayIndex + 1 },
    exerciseProgressById: { barbell_bench_press: mainState({
      baseline: { weightKg: 40, reps: 3, source: 'onboarding', capturedDayIndex: 0 },
      nextSuggestion: activeSuggestion({ weightKg: 42.5, targetReps: 7 }),
    }) },
    workoutResultsByDay: {
      [dayIndex]: { main: makeResult('barbell_bench_press', [{ setNumber: 3, weightKg: 42.5, reps: 7 }]) },
    },
  });
  const character = deriveCharacterScreenModel(source);
  const progress = deriveProgressScreenModel(source);
  assert.deepEqual(progress.mainStrength.start, character.mainStrength.start);
  assert.deepEqual(progress.mainStrength.latest, character.mainStrength.current);
  assert.equal(progress.mainStrength.targetE1rmKg, character.mainStrength.targetE1rmKg);
});

test('Exercise category labels reuse the shared D-035 EXP category mapping', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: { lat_pulldown: exerciseState('lat_pulldown') },
  }));
  assert.equal(getExerciseExpCategory('lat_pulldown'), 'back');
  assert.equal(model.exerciseRecords[0].categoryJapanese, '背中');
  assert.equal(model.exerciseRecords[0].categoryEnglish, 'BACK');
});

test('PROGRESS Bottom Navigation tab is active and accessible', () => {
  const items = getBottomNavigationItems('progress');
  assert.deepEqual(items.filter((item) => item.active).map((item) => item.label), ['PROGRESS']);
  assert.equal(items.find((item) => item.screen === 'progress').ariaCurrent, 'page');
});

test('MAP and CHARACTER remain available from the shared Bottom Navigation', () => {
  const items = getBottomNavigationItems('progress');
  assert.ok(items.some((item) => item.screen === 'map' && item.label === 'MAP'));
  assert.ok(items.some((item) => item.screen === 'character' && item.label === 'CHARACTER'));
});

test('Mixed weighted, Bodyweight, unset, and Weight Up Ready records coexist', () => {
  const model = deriveProgressScreenModel(makeSource({
    exerciseProgressById: {
      lat_pulldown: exerciseState('lat_pulldown', { nextSuggestion: activeSuggestion({ weightKg: 25, targetReps: 11 }) }),
      push_up: exerciseState('push_up', { nextSuggestion: activeSuggestion({ targetReps: 9 }) }),
      dumbbell_lateral_raise: exerciseState('dumbbell_lateral_raise'),
      leg_press: exerciseState('leg_press', { nextSuggestion: {
        weightKg: 100,
        targetReps: 8,
        repRange: { min: 5, max: 8 },
        status: 'weight_up_ready',
        ruleVersion: 'exercise-progression-v1',
      } }),
    },
  }));
  assert.deepEqual(model.exerciseRecords.map(({ nextSuggestion }) => nextSuggestion), [
    '25kg × 11回', '9回', '目安未設定', '重量UPのタイミング',
  ]);
});
