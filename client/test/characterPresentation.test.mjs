import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialCharacterGrowth, generateStageRoadmap } from '@fitness-rpg/shared';
import { getBottomNavigationItems } from '../src/components/bottomNavigationItems.ts';
import {
  deriveCharacterScreenModel,
} from '../src/features/character/characterPresentation.ts';

function makeRoadmap() {
  return generateStageRoadmap({
    startDate: '2026-09-25',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
  });
}

function makeSource(overrides = {}) {
  const growth = createInitialCharacterGrowth();
  const roadmap = makeRoadmap();
  return {
    roadmap,
    progress: { currentDayIndex: 0 },
    exerciseProgressById: {},
    workoutResultsByDay: {},
    characterGrowth: growth,
    mainStrengthGoalE1rmKg: 60,
    ...overrides,
  };
}

function makeResult(sets, overrides = {}) {
  return {
    plannedExerciseId: 'barbell_bench_press',
    performedExerciseId: 'barbell_bench_press',
    role: 'main',
    plannedSets: 3,
    plannedRepRange: { min: 5, max: 8 },
    completedSets: sets,
    performedAt: '2026-09-25T10:00:00.000Z',
    ...overrides,
  };
}

test('Body Growth uses the five existing CharacterGrowth categories unchanged', () => {
  const initial = createInitialCharacterGrowth();
  const model = deriveCharacterScreenModel(makeSource({
    characterGrowth: {
      ...initial,
      trainingExp: { chest: 120, back: 95, shoulders: 70, arms: 55, legs: 110 },
    },
  }));

  assert.deepEqual(model.trainingExp.map(({ id, exp }) => [id, exp]), [
    ['chest', 120], ['back', 95], ['shoulders', 70], ['arms', 55], ['legs', 110],
  ]);
});

test('Recovery displays the existing recoveryExp value', () => {
  const model = deriveCharacterScreenModel(makeSource({
    characterGrowth: { ...createInitialCharacterGrowth(), recoveryExp: 40 },
  }));
  assert.equal(model.recoveryExp, 40);
});

test('all six EXP cards remain present at zero', () => {
  const model = deriveCharacterScreenModel(makeSource());
  assert.equal(model.trainingExp.length, 5);
  assert.deepEqual(model.trainingExp.map((item) => item.exp), [0, 0, 0, 0, 0]);
  assert.equal(model.recoveryExp, 0);
});

test('START comes from the Main Exercise Baseline', () => {
  const model = deriveCharacterScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: {
        exerciseId: 'barbell_bench_press',
        sessionsCompleted: 0,
        baseline: { weightKg: 40, reps: 3, source: 'onboarding', capturedDayIndex: 0 },
      },
    },
  }));
  assert.deepEqual(model.mainStrength.start, { weightKg: 40, reps: 3 });
  assert.equal(model.mainStrength.startEstimated, false);
});

test('estimated profile marks START as provisional without creating CURRENT', () => {
  const model = deriveCharacterScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: {
        exerciseId: 'barbell_bench_press', sessionsCompleted: 0,
        baseline: { weightKg: 35, reps: 5, source: 'estimated_profile', capturedDayIndex: 0 },
      },
    },
  }));
  assert.deepEqual(model.mainStrength.start, { weightKg: 35, reps: 5 });
  assert.equal(model.mainStrength.startEstimated, true);
  assert.equal(model.mainStrength.current, null);
});

test('CURRENT comes from an actual result on a cleared Training Quest', () => {
  const model = deriveCharacterScreenModel(makeSource({
    progress: { currentDayIndex: 1 },
    workoutResultsByDay: { 0: { main: makeResult([{ setNumber: 1, weightKg: 42.5, reps: 7 }]) } },
  }));
  assert.deepEqual(model.mainStrength.current, { weightKg: 42.5, reps: 7 });
});

test('CURRENT shows no record when there is no actual Main Strength result', () => {
  const model = deriveCharacterScreenModel(makeSource());
  assert.equal(model.mainStrength.current, null);
});

test('nextSuggestion is never used as CURRENT', () => {
  const model = deriveCharacterScreenModel(makeSource({
    exerciseProgressById: {
      barbell_bench_press: {
        exerciseId: 'barbell_bench_press',
        sessionsCompleted: 0,
        nextSuggestion: {
          weightKg: 80,
          targetReps: 5,
          repRange: { min: 5, max: 8 },
          status: 'active',
          ruleVersion: 'exercise-progression-v1',
        },
      },
    },
  }));
  assert.equal(model.mainStrength.current, null);
});

test('TARGET uses the onboarding final goal, not the Stage target', () => {
  const model = deriveCharacterScreenModel(makeSource({
    roadmap: { ...makeRoadmap(), stageTargetE1rmKg: 45 },
    mainStrengthGoalE1rmKg: 60,
  }));
  assert.equal(model.mainStrength.targetE1rmKg, 60);
});

test('Stage completed and total Quest counts use StageProgress and Roadmap daily nodes', () => {
  const model = deriveCharacterScreenModel(makeSource({ progress: { currentDayIndex: 4 } }));
  assert.equal(model.stageProgress.completedQuestCount, 4);
  assert.equal(model.stageProgress.totalQuestCount, 14);
});

test('Stage Training and Recovery clear counts use the same completed Roadmap prefix', () => {
  const model = deriveCharacterScreenModel(makeSource({ progress: { currentDayIndex: 4 } }));
  const completedDays = makeRoadmap().days.slice(0, 4);
  assert.equal(model.stageProgress.trainingQuestClearCount, completedDays.filter((day) => day.type === 'training').length);
  assert.equal(model.stageProgress.recoveryQuestClearCount, completedDays.filter((day) => day.type === 'recovery').length);
  assert.equal(model.stageProgress.trainingQuestClearCount, 2);
  assert.equal(model.stageProgress.recoveryQuestClearCount, 2);
});

test('Boss remaining is total daily Quests minus completed Quests', () => {
  const model = deriveCharacterScreenModel(makeSource({ progress: { currentDayIndex: 4 } }));
  assert.equal(model.stageProgress.bossQuestsRemaining, 10);
});

test('zero Stage progress has a zero-percent bar and a nonnegative accessibility maximum', () => {
  const model = deriveCharacterScreenModel(makeSource());
  assert.equal(model.stageProgress.completedQuestCount, 0);
  assert.equal(model.stageProgress.percent, 0);
  assert.equal(model.stageProgress.bossQuestsRemaining, 14);
});

test('Bottom Navigation marks Character active with aria-current', () => {
  const items = getBottomNavigationItems('character');
  assert.deepEqual(items.filter((item) => item.active).map((item) => item.label), ['CHARACTER']);
  assert.equal(items.find((item) => item.screen === 'character').ariaCurrent, 'page');
});

test('Bottom Navigation exposes the MAP navigation destination', () => {
  assert.ok(getBottomNavigationItems('character').some((item) => item.screen === 'map' && item.label === 'MAP'));
});

test('Bottom Navigation exposes the PROGRESS navigation destination', () => {
  assert.ok(getBottomNavigationItems('character').some((item) => item.screen === 'progress' && item.label === 'PROGRESS'));
});

test('a missing Session derives a safe empty Character state', () => {
  const model = deriveCharacterScreenModel(null);
  assert.equal(model.mainStrength.exerciseName, null);
  assert.equal(model.mainStrength.start, null);
  assert.equal(model.mainStrength.current, null);
  assert.equal(model.mainStrength.targetE1rmKg, null);
  assert.deepEqual(model.trainingExp.map((item) => item.exp), [0, 0, 0, 0, 0]);
  assert.equal(model.recoveryExp, 0);
  assert.deepEqual(model.stageProgress, {
    completedQuestCount: 0,
    totalQuestCount: 0,
    trainingQuestClearCount: 0,
    recoveryQuestClearCount: 0,
    bossQuestsRemaining: 0,
    percent: 0,
  });
});

test('the representative Current set is the latest setNumber, not a best-record calculation', () => {
  const model = deriveCharacterScreenModel(makeSource({
    progress: { currentDayIndex: 1 },
    workoutResultsByDay: {
      0: { main: makeResult([
        { setNumber: 1, weightKg: 50, reps: 8 },
        { setNumber: 3, weightKg: 42.5, reps: 7 },
      ]) },
    },
  }));
  assert.deepEqual(model.mainStrength.current, { weightKg: 42.5, reps: 7 });
});

test('CURRENT ignores actual results on the not-yet-cleared current Quest', () => {
  const model = deriveCharacterScreenModel(makeSource({
    progress: { currentDayIndex: 1 },
    workoutResultsByDay: {
      0: { main: makeResult([{ setNumber: 1, weightKg: 40, reps: 5 }]) },
      1: { main: makeResult([{ setNumber: 1, weightKg: 50, reps: 8 }]) },
    },
  }));
  assert.deepEqual(model.mainStrength.current, { weightKg: 40, reps: 5 });
});

test('Main Strength exercise label comes from the canonical Exercise ID presentation mapping', () => {
  const model = deriveCharacterScreenModel(makeSource());
  assert.equal(model.mainStrength.exerciseName, 'バーベルベンチプレス');
});
