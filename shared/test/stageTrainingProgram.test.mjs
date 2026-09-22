import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrainingCandidates,
  createInitialStageProgress,
  generateStageRoadmap,
  getCanonicalStageTrainingDays,
  validateStageTrainingDayContexts,
  validateStageTrainingProgram,
} from '../dist/index.js';

function createRoadmap() {
  return generateStageRoadmap({
    startDate: '2026-09-22',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
  });
}

function createSingleTrainingDayRoadmap() {
  const roadmap = createRoadmap();
  return {
    ...roadmap,
    days: roadmap.days.map((day, dayIndex) => dayIndex === 0
      ? day
      : { date: day.date, type: 'recovery' }),
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

function createCandidates(targetMuscles = ['chest']) {
  return buildTrainingCandidates({
    equipmentProfile: {
      id: 'stage-equipment',
      displayName: 'Barbell and bench',
      availableEquipmentIds: ['barbell', 'flat_bench'],
    },
    mainExerciseId: 'barbell_bench_press',
    targetMuscles,
  });
}

function validPlan() {
  return {
    exercises: [{
      exerciseId: 'barbell_bench_press',
      role: 'main',
      sets: 3,
      repRange: { min: 5, max: 8 },
    }],
  };
}

function contextFor(roadmap, overrides = {}) {
  const trainingDays = getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => ({
    dayIndex,
    candidates: createCandidates(),
  }));
  return {
    roadmap,
    trainingDays: overrides.trainingDays ?? trainingDays,
  };
}

function programFor(roadmap, dayIndexes = getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => dayIndex)) {
  return {
    sessions: dayIndexes.map((dayIndex) => ({ dayIndex, plan: validPlan() })),
  };
}

function errors(result) {
  assert.equal(result.valid, false);
  return result.errors.map((error) => error.code);
}

test('valid multi-day program succeeds and is normalized by canonical dayIndex', () => {
  const roadmap = createRoadmap();
  const context = contextFor(roadmap);
  const sessions = programFor(roadmap).sessions;
  const result = validateStageTrainingProgram({
    sessions: [...sessions].reverse(),
  }, context);

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.deepEqual(
      result.program.sessions.map(({ dayIndex }) => dayIndex),
      getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => dayIndex),
    );
    assert.notEqual(result.program.sessions[0].plan, null);
  }
});

test('one Training Day and all canonical Training Days are valid coverage', () => {
  const roadmap = createSingleTrainingDayRoadmap();
  const canonical = getCanonicalStageTrainingDays(roadmap);
  const oneDayContext = contextFor(roadmap);

  assert.equal(validateStageTrainingProgram(programFor(roadmap, [canonical[0].dayIndex]), oneDayContext).valid, true);
  assert.equal(validateStageTrainingProgram(programFor(roadmap), oneDayContext).valid, true);
});

test('missing, duplicate, recovery, boss, out-of-range, negative, non-integer, and extra sessions are rejected', () => {
  const roadmap = createRoadmap();
  const context = contextFor(roadmap);
  const canonical = getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => dayIndex);

  assert.ok(errors(validateStageTrainingProgram(programFor(roadmap, canonical.slice(1)), context)).includes('MISSING_TRAINING_DAY'));
  assert.ok(errors(validateStageTrainingProgram(programFor(roadmap, [canonical[0], canonical[0], ...canonical.slice(1)]), context)).includes('DUPLICATE_DAY_INDEX'));
  assert.ok(errors(validateStageTrainingProgram(programFor(roadmap, [1, ...canonical.slice(1)]), context)).includes('RECOVERY_DAY_NOT_ALLOWED'));
  assert.ok(errors(validateStageTrainingProgram(programFor(roadmap, [roadmap.days.length, ...canonical.slice(1)]), context)).includes('BOSS_DAY_NOT_ALLOWED'));
  assert.ok(errors(validateStageTrainingProgram(programFor(roadmap, [99, ...canonical.slice(1)]), context)).includes('OUT_OF_RANGE_DAY_INDEX'));
  assert.ok(errors(validateStageTrainingProgram(programFor(roadmap, [-1, ...canonical.slice(1)]), context)).includes('INVALID_DAY_INDEX'));
  assert.ok(errors(validateStageTrainingProgram(programFor(roadmap, [1.5, ...canonical.slice(1)]), context)).includes('INVALID_DAY_INDEX'));
  assert.ok(errors(validateStageTrainingProgram({ sessions: [...programFor(roadmap).sessions, { dayIndex: 1, plan: validPlan() }] }, context)).includes('RECOVERY_DAY_NOT_ALLOWED'));
});

test('candidate contexts require exact canonical Training Day coverage', () => {
  const roadmap = createRoadmap();
  const base = contextFor(roadmap).trainingDays;

  assert.ok(errors(validateStageTrainingDayContexts(roadmap, base.slice(1))).includes('MISSING_CANDIDATE_CONTEXT'));
  assert.ok(errors(validateStageTrainingDayContexts(roadmap, [base[0], base[0], ...base.slice(1)])).includes('DUPLICATE_CANDIDATE_CONTEXT'));
  assert.ok(errors(validateStageTrainingDayContexts(roadmap, [{ dayIndex: 1, candidates: createCandidates() }, ...base.slice(1)])).includes('NON_TRAINING_CANDIDATE_CONTEXT'));
  assert.ok(errors(validateStageTrainingDayContexts(roadmap, [{ dayIndex: roadmap.days.length, candidates: createCandidates() }, ...base.slice(1)])).includes('OUT_OF_RANGE_CANDIDATE_CONTEXT'));
  assert.ok(errors(validateStageTrainingDayContexts(roadmap, [{ dayIndex: -1, candidates: createCandidates() }, ...base.slice(1)])).includes('INVALID_CANDIDATE_CONTEXT'));
  assert.ok(errors(validateStageTrainingDayContexts(roadmap, [{ dayIndex: 1.5, candidates: createCandidates() }, ...base.slice(1)])).includes('INVALID_CANDIDATE_CONTEXT'));
});

test('a plan is validated with the candidate context for the same day', () => {
  const roadmap = createRoadmap();
  const context = contextFor(roadmap);
  const firstDay = context.trainingDays[0].dayIndex;
  const secondDay = context.trainingDays[1].dayIndex;
  const mismatchedCandidates = createCandidates(['back']);
  const candidatePlan = {
    exercises: [{
      exerciseId: 'push_up',
      role: 'accessory',
      sets: 3,
      repRange: { min: 8, max: 12 },
    }],
  };
  const result = validateStageTrainingProgram({
    sessions: [
      { dayIndex: firstDay, plan: validPlan() },
      { dayIndex: secondDay, plan: candidatePlan },
      ...programFor(roadmap, getCanonicalStageTrainingDays(roadmap).slice(2).map(({ dayIndex }) => dayIndex)).sessions,
    ],
  }, {
    roadmap,
    trainingDays: context.trainingDays.map((day) => day.dayIndex === secondDay
      ? { ...day, candidates: mismatchedCandidates }
      : day),
  });

  assert.ok(errors(result).includes('INVALID_PLAN_FOR_DAY'));
});

test('guardrail and candidate violations reject the whole program', () => {
  const roadmap = createRoadmap();
  const context = contextFor(roadmap);
  const invalidPlan = {
    exercises: [{
      exerciseId: 'barbell_bench_press',
      role: 'main',
      sets: 6,
      repRange: { min: 5, max: 8 },
    }],
  };
  const invalidCandidatePlan = {
    exercises: [{
      exerciseId: 'dumbbell_bench_press',
      role: 'accessory',
      sets: 3,
      repRange: { min: 8, max: 12 },
    }],
  };

  assert.ok(errors(validateStageTrainingProgram({
    sessions: [{ dayIndex: 0, plan: invalidPlan }, ...programFor(roadmap, [3, 5, 7, 10, 12]).sessions],
  }, context)).includes('INVALID_PLAN_FOR_DAY'));
  assert.ok(errors(validateStageTrainingProgram({
    sessions: [{ dayIndex: 0, plan: invalidCandidatePlan }, ...programFor(roadmap, [3, 5, 7, 10, 12]).sessions],
  }, context)).includes('INVALID_PLAN_FOR_DAY'));
});

test('missing Main Exercise and accessory rep ranges are rejected through existing plan validation', () => {
  const roadmap = createRoadmap();
  const context = contextFor(roadmap);
  const accessoryOnlyPlan = {
    exercises: [{
      exerciseId: 'push_up',
      role: 'accessory',
      sets: 3,
      repRange: { min: 8, max: 12 },
    }],
  };
  const tooHighAccessoryPlan = {
    exercises: [{
      exerciseId: 'barbell_bench_press',
      role: 'main',
      sets: 3,
      repRange: { min: 5, max: 8 },
    }, {
      exerciseId: 'push_up',
      role: 'accessory',
      sets: 3,
      repRange: { min: 5, max: 21 },
    }],
  };

  const missingMain = validateStageTrainingProgram({
    sessions: [{ dayIndex: 0, plan: accessoryOnlyPlan }, ...programFor(roadmap, [2, 4, 7, 9, 11]).sessions],
  }, context);
  assert.ok(missingMain.valid === false && missingMain.errors.some((error) => error.planErrorCode === 'MAIN_EXERCISE_MISSING'));

  const invalidAccessory = validateStageTrainingProgram({
    sessions: [{ dayIndex: 0, plan: tooHighAccessoryPlan }, ...programFor(roadmap, [2, 4, 7, 9, 11]).sessions],
  }, context);
  assert.ok(invalidAccessory.valid === false && invalidAccessory.errors.some((error) => error.planErrorCode === 'INVALID_REP_RANGE'));
});

test('a twelve-day program with one invalid session fails atomically', () => {
  const roadmap = createTwelveTrainingDayRoadmap();
  const context = contextFor(roadmap);
  const sessions = programFor(roadmap).sessions;
  sessions[5] = {
    dayIndex: sessions[5].dayIndex,
    plan: {
      exercises: [{
        exerciseId: 'barbell_bench_press',
        role: 'main',
        sets: 6,
        repRange: { min: 5, max: 8 },
      }],
    },
  };

  const result = validateStageTrainingProgram({ sessions }, context);
  assert.ok(errors(result).includes('INVALID_PLAN_FOR_DAY'));
  assert.equal(Object.hasOwn(result, 'program'), false);
});

test('invalid session means no partial ValidatedStageTrainingProgram is returned', () => {
  const roadmap = createRoadmap();
  const fullContext = contextFor(roadmap);
  const sessions = programFor(roadmap).sessions;
  sessions[1] = { dayIndex: 3, plan: { exercises: [] } };
  const result = validateStageTrainingProgram({
    sessions,
  }, fullContext);

  assert.equal(result.valid, false);
  assert.equal(Object.hasOwn(result, 'program'), false);
});

test('validation does not mutate the draft, roadmap, or candidate contexts', () => {
  const roadmap = createRoadmap();
  const context = contextFor(roadmap);
  const draft = programFor(roadmap);
  const draftSnapshot = structuredClone(draft);
  const roadmapSnapshot = structuredClone(roadmap);
  const contextSnapshot = structuredClone(context);

  validateStageTrainingProgram(draft, context);

  assert.deepEqual(draft, draftSnapshot);
  assert.deepEqual(roadmap, roadmapSnapshot);
  assert.deepEqual(context, contextSnapshot);
  assert.deepEqual(createInitialStageProgress(roadmap), { currentDayIndex: 0 });
});
