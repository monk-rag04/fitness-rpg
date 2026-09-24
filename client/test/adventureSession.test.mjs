import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeAdventureQuest,
  cacheStageTrainingProgram,
  cacheTrainingPlanForDay,
  createAdventureQuestDomainState,
  createOnboardingAdventureSession,
  getTrainingPlanForDay,
  saveWorkoutResultForCurrentDay,
  setStageEquipmentProfile,
} from '../src/state/adventureSession.ts';
import { DEMO_EQUIPMENT_PROFILE, DEMO_STAGE_ROADMAP, DEMO_TRAINING_PLAN } from '../src/demo/fixture.ts';
import {
  createInitialStageProgress,
  EQUIPMENT_IDS,
  generateStageRoadmap,
  getCanonicalStageTrainingDays,
  rescheduleCurrentQuest,
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

function createRewardTestDomain(roadmap = DEMO_STAGE_ROADMAP, progress = createInitialStageProgress(roadmap)) {
  return createAdventureQuestDomainState({
    source: 'demo',
    roadmap,
    initialProgress: progress,
    planByDay: { 0: DEMO_TRAINING_PLAN },
    equipmentProfile: DEMO_EQUIPMENT_PROFILE,
  });
}

function saveCompleteDemoResults(domain, dayIndex = domain.progress.currentDayIndex) {
  const plan = domain.planByDay[dayIndex];
  return plan.exercises.reduce((nextDomain, exercise) => saveWorkoutResultForCurrentDay(nextDomain, {
    plannedExerciseId: exercise.exerciseId,
    performedExerciseId: exercise.exerciseId,
    role: exercise.role,
    plannedSets: exercise.sets,
    plannedRepRange: exercise.repRange,
    completedSets: Array.from({ length: exercise.sets }, (_, index) => ({
      setNumber: index + 1,
      weightKg: 30,
      reps: exercise.repRange.min,
    })),
    performedAt: '2026-09-24T10:00:00.000Z',
  }), domain);
}

test('new Adventure domain state initializes Character Growth at zero', () => {
  const state = createRewardTestDomain();
  assert.deepEqual(state.characterGrowth, {
    trainingExp: { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0 },
    recoveryExp: 0,
  });
});

test('saving or replacing a Workout Result never awards EXP before Quest Clear', () => {
  const initial = createRewardTestDomain();
  const recorded = saveCompleteDemoResults(initial);
  assert.deepEqual(recorded.characterGrowth, initial.characterGrowth);
  assert.notEqual(recorded.workoutResultsByDay, initial.workoutResultsByDay);
  const edited = saveCompleteDemoResults(recorded);
  assert.deepEqual(edited.characterGrowth, initial.characterGrowth);
});

test('Training Quest completion applies progress, growth, and summary in one transition', () => {
  const initial = createRewardTestDomain();
  const recorded = saveCompleteDemoResults(initial);
  const snapshots = {
    roadmap: recorded.roadmap,
    planByDay: recorded.planByDay,
    results: recorded.workoutResultsByDay,
    equipment: recorded.equipmentProfile,
    context: recorded.stageTrainingProgramContext,
  };

  const completed = completeAdventureQuest(recorded, 0);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.domain.progress.currentDayIndex, 1);
  assert.deepEqual(completed.domain.characterGrowth.trainingExp, {
    chest: 40,
    back: 0,
    shoulders: 0,
    arms: 0,
    legs: 0,
  });
  assert.equal(completed.domain.characterGrowth.recoveryExp, 0);
  assert.deepEqual(completed.rewardSummary, {
    dayIndex: 0,
    questType: 'training',
    trainingExpGained: { chest: 40 },
    recoveryExpGained: 0,
    mapProgressGained: 1,
  });
  assert.equal(completed.domain.roadmap, snapshots.roadmap);
  assert.equal(completed.domain.planByDay, snapshots.planByDay);
  assert.equal(completed.domain.workoutResultsByDay, snapshots.results);
  assert.equal(completed.domain.equipmentProfile, snapshots.equipment);
  assert.equal(completed.domain.stageTrainingProgramContext, snapshots.context);
});

test('replaying the same Training completion cannot award growth or progress twice', () => {
  const recorded = saveCompleteDemoResults(createRewardTestDomain());
  const completed = completeAdventureQuest(recorded, 0);
  const replayed = completeAdventureQuest(completed.domain, 0);

  assert.equal(replayed.status, 'already_completed');
  assert.equal(replayed.domain, completed.domain);
  assert.deepEqual(replayed.domain.characterGrowth, completed.domain.characterGrowth);
  assert.deepEqual(replayed.domain.progress, { currentDayIndex: 1 });
});

test('Recovery Quest completion grants only Recovery EXP and is idempotent', () => {
  const recoveryIndex = DEMO_STAGE_ROADMAP.days.findIndex((day) => day.type === 'recovery');
  const initial = createRewardTestDomain(
    DEMO_STAGE_ROADMAP,
    { currentDayIndex: recoveryIndex },
  );
  const completed = completeAdventureQuest(initial, recoveryIndex);
  const replayed = completeAdventureQuest(completed.domain, recoveryIndex);

  assert.equal(completed.status, 'completed');
  assert.equal(completed.domain.progress.currentDayIndex, recoveryIndex + 1);
  assert.equal(completed.domain.characterGrowth.recoveryExp, 10);
  assert.deepEqual(completed.domain.characterGrowth.trainingExp, initial.characterGrowth.trainingExp);
  assert.deepEqual(completed.rewardSummary, {
    dayIndex: recoveryIndex,
    questType: 'recovery',
    trainingExpGained: {},
    recoveryExpGained: 10,
    mapProgressGained: 1,
  });
  assert.equal(replayed.status, 'already_completed');
  assert.equal(replayed.domain, completed.domain);
});

test('rescheduling preserves day-index reward identity and the cached plan/result', () => {
  const initial = saveCompleteDemoResults(createRewardTestDomain());
  const shiftedRoadmap = rescheduleCurrentQuest(initial.roadmap, 0, '2026-09-24', '2026-09-22');
  const rescheduled = { ...initial, roadmap: shiftedRoadmap };
  const completed = completeAdventureQuest(rescheduled, 0);

  assert.equal(completed.status, 'completed');
  assert.equal(completed.rewardSummary.dayIndex, 0);
  assert.equal(completed.domain.progress.currentDayIndex, 1);
  assert.equal(completed.domain.planByDay, initial.planByDay);
  assert.equal(completed.domain.workoutResultsByDay, initial.workoutResultsByDay);
});

test('an invalid completion leaves progress and growth untouched', () => {
  const initial = createRewardTestDomain();
  const failed = completeAdventureQuest(initial, 0);
  assert.equal(failed.status, 'not_ready_to_clear');
  assert.equal(failed.domain, initial);
  assert.equal(failed.domain.progress, initial.progress);
  assert.equal(failed.domain.characterGrowth, initial.characterGrowth);
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

test('registers a normalized Stage Equipment Profile without mutating the onboarding session or input', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const equipmentIds = ['dumbbell', 'barbell'];
  const equipmentIdsSnapshot = [...equipmentIds];
  const sessionSnapshot = structuredClone(session);
  const result = setStageEquipmentProfile(session, equipmentIds);

  assert.equal(result.status, 'set');
  assert.deepEqual(result.equipmentProfile, {
    id: 'stage-equipment-profile',
    displayName: 'Stage Equipment',
    availableEquipmentIds: ['barbell', 'dumbbell'],
  });
  assert.notEqual(result.target, session);
  assert.deepEqual(result.target.equipmentProfile, result.equipmentProfile);
  assert.deepEqual(equipmentIds, equipmentIdsSnapshot);
  assert.deepEqual(session, sessionSnapshot);
  assert.equal(session.equipmentProfile, undefined);
});

test('empty equipment is an explicit configured no-equipment Profile, distinct from undefined', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const result = setStageEquipmentProfile(session, []);

  assert.equal(session.equipmentProfile, undefined);
  assert.equal(result.status, 'set');
  assert.notEqual(result.equipmentProfile, undefined);
  assert.deepEqual(result.equipmentProfile.availableEquipmentIds, []);
});

test('rejects unknown or duplicate Equipment IDs without changing existing State', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const initial = setStageEquipmentProfile(session, ['barbell']);
  const configuredSession = { ...session, equipmentProfile: initial.equipmentProfile };
  const planByDaySnapshot = structuredClone(configuredSession.planByDay);

  for (const invalidIds of [
    ['unknown_equipment'],
    ['barbell', 'barbell'],
    'barbell',
  ]) {
    const result = setStageEquipmentProfile(configuredSession, invalidIds);
    assert.equal(result.status, 'invalid_equipment_ids');
    assert.equal(result.target, configuredSession);
    assert.equal(result.equipmentProfile, initial.equipmentProfile);
    assert.deepEqual(configuredSession.planByDay, planByDaySnapshot);
  }
});

test('does not create a Full Gym default and permits pre-program Equipment changes', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const first = setStageEquipmentProfile(session, ['barbell']);
  const configuredSession = { ...session, equipmentProfile: first.equipmentProfile };
  const changed = setStageEquipmentProfile(configuredSession, ['flat_bench', 'barbell']);

  assert.equal(first.status, 'set');
  assert.deepEqual(first.equipmentProfile.availableEquipmentIds, ['barbell']);
  assert.notDeepEqual(first.equipmentProfile.availableEquipmentIds, EQUIPMENT_IDS);
  assert.equal(changed.status, 'set');
  assert.deepEqual(changed.equipmentProfile.availableEquipmentIds, ['barbell', 'flat_bench']);
  assert.deepEqual(configuredSession.planByDay, {});
});

test('reapplying the same normalized Profile is idempotent before Program caching', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const first = setStageEquipmentProfile(session, ['barbell', 'dumbbell']);
  const configuredSession = { ...session, equipmentProfile: first.equipmentProfile };
  const identical = setStageEquipmentProfile(configuredSession, ['dumbbell', 'barbell']);

  assert.equal(identical.status, 'already_set');
  assert.equal(identical.target, configuredSession);
  assert.equal(identical.equipmentProfile, first.equipmentProfile);
});

test('locks Equipment and preserves Profile and Program after a Stage Program is cached', () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  const profile = setStageEquipmentProfile(session, ['barbell', 'flat_bench']);
  const withProfile = { ...session, equipmentProfile: profile.equipmentProfile };
  const programCache = cacheStageTrainingProgram(withProfile, createProgram(roadmap));
  const cachedSession = {
    ...withProfile,
    planByDay: programCache.planByDay,
  };
  const planByDaySnapshot = structuredClone(cachedSession.planByDay);
  const locked = setStageEquipmentProfile(cachedSession, ['dumbbell']);

  assert.equal(programCache.status, 'cached');
  assert.equal(locked.status, 'equipment_locked');
  assert.equal(locked.equipmentProfile, profile.equipmentProfile);
  assert.deepEqual(cachedSession.planByDay, planByDaySnapshot);
  assert.equal(Object.keys(locked.equipmentProfile.availableEquipmentIds).length, 2);
});

test('Demo Equipment remains isolated and cannot become a Production fallback', () => {
  const roadmap = createRoadmap();
  const demoLikeSession = {
    source: 'demo',
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
    planByDay: { 0: DEMO_TRAINING_PLAN },
    equipmentProfile: DEMO_EQUIPMENT_PROFILE,
  };
  const result = setStageEquipmentProfile(demoLikeSession, ['dumbbell']);

  assert.equal(result.status, 'equipment_locked');
  assert.equal(result.equipmentProfile, DEMO_EQUIPMENT_PROFILE);
  assert.deepEqual(DEMO_EQUIPMENT_PROFILE.availableEquipmentIds, [
    'barbell', 'dumbbell', 'flat_bench', 'cable_machine',
  ]);
});
