import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cacheStageTrainingProgram,
  cacheTrainingPlanForDay,
  createOnboardingAdventureSession,
  getTrainingPlanForDay,
} from '../src/state/adventureSession.ts';
import { DEMO_EQUIPMENT_PROFILE, DEMO_TRAINING_PLAN } from '../src/demo/fixture.ts';
import {
  createInitialStageProgress,
  generateStageRoadmap,
  getCanonicalStageTrainingDays,
} from '@fitness-rpg/shared';

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

function createProgram(roadmap, planForDay = () => copyPlan()) {
  return {
    sessions: getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => ({
      dayIndex,
      plan: planForDay(dayIndex),
    })),
  };
}

function createTwelveTrainingDayRoadmap() {
  const roadmap = createRoadmap();
  return {
    ...roadmap,
    days: roadmap.days.map((day, dayIndex) => dayIndex < 12
      ? { date: day.date, type: 'training', sessionFocus: { targetMuscles: ['chest'] } }
      : { date: day.date, type: 'recovery' }),
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

test('atomically caches a complete Stage Program and current Training Day derives its plan', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: { currentDayIndex: getDayIndex(roadmap, 'training') },
  });
  const program = createProgram(roadmap);
  const sessionSnapshot = structuredClone(session);
  const programSnapshot = structuredClone(program);
  const result = cacheStageTrainingProgram(session, program);

  assert.equal(result.status, 'cached');
  assert.deepEqual(Object.keys(result.planByDay).map(Number), [0, 2, 4, 7, 9, 11]);
  assert.equal(getTrainingPlanForDay(roadmap, result.planByDay, session.initialProgress.currentDayIndex), program.sessions[0].plan);
  assert.deepEqual(session, sessionSnapshot);
  assert.deepEqual(program, programSnapshot);
  assert.deepEqual(session.planByDay, {});
});

test('atomically caches all twelve Training Days without Recovery entries', () => {
  const roadmap = createTwelveTrainingDayRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const program = createProgram(roadmap);
  const result = cacheStageTrainingProgram(session, program);

  assert.equal(result.status, 'cached');
  assert.equal(Object.keys(result.planByDay).length, 12);
  for (const [dayIndex, day] of roadmap.days.entries()) {
    assert.equal(result.planByDay[dayIndex] !== undefined, day.type === 'training');
  }
});

test('rejects missing, mismatched, Recovery, Boss, duplicate, and partial programs atomically', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const program = createProgram(roadmap);
  const expectedEmptyCache = session.planByDay;
  const cases = [
    null,
    { ...program, sessions: program.sessions.slice(1) },
    { ...program, sessions: [...program.sessions, { dayIndex: 1, plan: copyPlan() }] },
    { ...program, sessions: [...program.sessions, { dayIndex: roadmap.days.length, plan: copyPlan() }] },
    { ...program, sessions: [program.sessions[0], program.sessions[0], ...program.sessions.slice(1)] },
  ];

  const missingRoadmap = cacheStageTrainingProgram(null, program);
  assert.equal(missingRoadmap.status, 'roadmap_missing');

  for (const invalidProgram of cases.slice(1)) {
    const result = cacheStageTrainingProgram(session, invalidProgram);
    assert.equal(result.status, 'invalid_stage_program');
    assert.equal(result.planByDay, expectedEmptyCache);
  }
});

test('a Stage Program never partially saves when one of twelve sessions is invalid', () => {
  const roadmap = createTwelveTrainingDayRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const program = createProgram(roadmap);
  const invalidProgram = {
    sessions: program.sessions.map((entry, index) => index === 11
      ? { ...entry, dayIndex: roadmap.days.length }
      : entry),
  };

  const result = cacheStageTrainingProgram(session, invalidProgram);
  assert.equal(result.status, 'invalid_stage_program');
  assert.equal(result.planByDay, session.planByDay);
  assert.deepEqual(result.planByDay, {});
});

test('a Stage Program is first-success-wins, including identical reapplication', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const firstProgram = createProgram(roadmap);
  const first = cacheStageTrainingProgram(session, firstProgram);
  const cachedSession = { ...session, planByDay: first.planByDay };
  const replacementProgram = createProgram(roadmap, () => DEMO_TRAINING_PLAN);

  const identical = cacheStageTrainingProgram(cachedSession, firstProgram);
  const replacement = cacheStageTrainingProgram(cachedSession, replacementProgram);
  assert.equal(identical.status, 'already_cached');
  assert.equal(replacement.status, 'already_cached');
  assert.equal(identical.planByDay, first.planByDay);
  assert.equal(replacement.planByDay, first.planByDay);
  assert.notEqual(replacement.planByDay[0], DEMO_TRAINING_PLAN);
});

test('an existing partial day cache is preserved rather than silently overwritten', () => {
  const roadmap = createRoadmap();
  const partialPlanByDay = { 0: DEMO_TRAINING_PLAN };
  const session = {
    ...createOnboardingAdventureSession({
      roadmap,
      initialProgress: createInitialStageProgress(roadmap),
    }),
    planByDay: partialPlanByDay,
  };
  const result = cacheStageTrainingProgram(session, createProgram(roadmap));

  assert.equal(result.status, 'already_cached');
  assert.equal(result.planByDay, partialPlanByDay);
  assert.deepEqual(partialPlanByDay, { 0: DEMO_TRAINING_PLAN });
});
