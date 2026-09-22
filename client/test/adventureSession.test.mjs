import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cacheTrainingPlanForDay,
  createOnboardingAdventureSession,
  getTrainingPlanForDay,
} from '../src/state/adventureSession.ts';
import { DEMO_EQUIPMENT_PROFILE, DEMO_TRAINING_PLAN } from '../src/demo/fixture.ts';
import { createInitialStageProgress, generateStageRoadmap } from '@fitness-rpg/shared';

function createRoadmap() {
  return generateStageRoadmap({
    startDate: '2026-09-22',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
  });
}

function getDayIndex(roadmap, type, occurrence = 0) {
  return roadmap.days
    .map((day, dayIndex) => ({ day, dayIndex }))
    .filter(({ day }) => day.type === type)[occurrence]
    .dayIndex;
}

function copyPlan() {
  return {
    exercises: DEMO_TRAINING_PLAN.exercises.map((exercise) => ({
      ...exercise,
      repRange: { ...exercise.repRange },
    })),
  };
}

test('onboarding session begins with an empty day-based Plan cache and no Demo fallback', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const firstTrainingDay = getDayIndex(roadmap, 'training');

  assert.deepEqual(session.planByDay, {});
  assert.equal(getTrainingPlanForDay(roadmap, session.planByDay, firstTrainingDay), null);
  assert.equal(session.equipmentProfile, undefined);
});

test('a validated plan is cached and read only for its Training Day', () => {
  const roadmap = createRoadmap();
  const trainingDay = getDayIndex(roadmap, 'training');
  const otherTrainingDay = getDayIndex(roadmap, 'training', 1);
  const cached = cacheTrainingPlanForDay(roadmap, {}, trainingDay, DEMO_TRAINING_PLAN);

  assert.equal(cached.status, 'cached');
  assert.equal(getTrainingPlanForDay(roadmap, cached.planByDay, trainingDay), DEMO_TRAINING_PLAN);
  assert.equal(getTrainingPlanForDay(roadmap, cached.planByDay, otherTrainingDay), null);
});

test('different Training Days retain independent cached plans and current-day lookup follows progress', () => {
  const roadmap = createRoadmap();
  const firstTrainingDay = getDayIndex(roadmap, 'training');
  const secondTrainingDay = getDayIndex(roadmap, 'training', 1);
  const first = cacheTrainingPlanForDay(roadmap, {}, firstTrainingDay, DEMO_TRAINING_PLAN);
  const secondPlan = copyPlan();
  const second = cacheTrainingPlanForDay(roadmap, first.planByDay, secondTrainingDay, secondPlan);
  const progress = { currentDayIndex: secondTrainingDay };

  assert.equal(second.status, 'cached');
  assert.equal(getTrainingPlanForDay(roadmap, second.planByDay, firstTrainingDay), DEMO_TRAINING_PLAN);
  assert.equal(getTrainingPlanForDay(roadmap, second.planByDay, progress.currentDayIndex), secondPlan);
});

test('Recovery, Boss, and invalid day indexes cannot store or expose a Training Plan', () => {
  const roadmap = createRoadmap();
  const recoveryDay = getDayIndex(roadmap, 'recovery');
  const cachedOnRecovery = cacheTrainingPlanForDay(roadmap, {}, recoveryDay, DEMO_TRAINING_PLAN);
  const cachedOnBoss = cacheTrainingPlanForDay(roadmap, {}, roadmap.days.length, DEMO_TRAINING_PLAN);
  const cachedOutOfRange = cacheTrainingPlanForDay(roadmap, {}, -1, DEMO_TRAINING_PLAN);

  assert.equal(cachedOnRecovery.status, 'not_training_day');
  assert.equal(cachedOnBoss.status, 'invalid_day_index');
  assert.equal(cachedOutOfRange.status, 'invalid_day_index');
  assert.equal(getTrainingPlanForDay(roadmap, { [recoveryDay]: DEMO_TRAINING_PLAN }, recoveryDay), null);
});

test('the first successful plan wins and cache writes do not alter the Stage-shared Equipment Profile', () => {
  const roadmap = createRoadmap();
  const trainingDay = getDayIndex(roadmap, 'training');
  const first = cacheTrainingPlanForDay(roadmap, {}, trainingDay, DEMO_TRAINING_PLAN);
  const replacement = copyPlan();
  const duplicate = cacheTrainingPlanForDay(roadmap, first.planByDay, trainingDay, replacement);

  assert.equal(duplicate.status, 'already_cached');
  assert.equal(duplicate.planByDay[trainingDay], DEMO_TRAINING_PLAN);
  assert.equal(DEMO_EQUIPMENT_PROFILE.availableEquipmentIds.includes('barbell'), true);
});
