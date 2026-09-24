import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrainingCandidates,
  addLocalDays,
  EQUIPMENT_IDS,
  generateStageRoadmap,
  getCanonicalStageTrainingDays,
} from '@fitness-rpg/shared';
import { createApp } from '../dist/app.js';
import {
  StageTrainingProgramGenerationError,
  generateStageTrainingProgram,
} from '../dist/openai/stageTrainingProgram.js';

function createRoadmap(frequency = 3) {
  return generateStageRoadmap({
    startDate: '2026-09-22',
    durationDays: 14,
    trainingFrequencyPerWeek: frequency,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
  });
}

function validPlan(roadmap, dayIndex) {
  if (roadmap === undefined || dayIndex === undefined) {
    return {
      exercises: [{
        exerciseId: 'barbell_bench_press',
        role: 'main',
        sets: 3,
        repRange: { min: 5, max: 8 },
      }],
    };
  }
  const day = roadmap.days[dayIndex];
  const candidates = buildTrainingCandidates({
    equipmentProfile: {
      id: 'endpoint-test-equipment',
      displayName: 'All catalog equipment',
      availableEquipmentIds: [...EQUIPMENT_IDS],
    },
    bossMainExerciseId: roadmap.mainExerciseId,
    bossMainExposure: day.bossMainExposure,
    targetMuscles: day.sessionFocus.targetMuscles,
    targetMovementPatterns: day.sessionFocus.targetMovementPatterns,
  });
  const primary = candidates.mainExercise ?? candidates.candidateExercises[0];
  assert.ok(primary);
  return {
    exercises: [{
      exerciseId: primary.exerciseId,
      role: 'main',
      sets: 3,
      repRange: { min: 5, max: 8 },
    }],
  };
}

function validProgram(roadmap) {
  return {
    sessions: getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => ({
      dayIndex,
      plan: validPlan(roadmap, dayIndex),
    })),
  };
}

function validRequest(roadmap = createRoadmap()) {
  return {
    equipmentIds: [...EQUIPMENT_IDS],
    mainExerciseId: 'barbell_bench_press',
    currentE1rmKg: 70,
    stageTargetE1rmKg: 75,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: roadmap.trainingFrequencyPerWeek,
    roadmap,
  };
}

function roadmapWithDelayOffsets(roadmap, offsets) {
  const days = roadmap.days.map((day, index) => ({
    ...day,
    date: addLocalDays(addLocalDays(roadmap.startDate, index), offsets[index]),
  }));
  return {
    ...roadmap,
    days,
    boss: {
      ...roadmap.boss,
      date: addLocalDays(roadmap.boss.date, offsets.at(-1)),
    },
  };
}

async function callEndpoint(app, body, raw = false) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/stage-training-program`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function createFakeStageGenerator() {
  const calls = [];
  let providerCalls = 0;
  const generator = (input) => generateStageTrainingProgram(input, {
    responses: {
      create: async () => {
        providerCalls += 1;
        return {
          status: 'completed',
          output_text: JSON.stringify(validProgram(input.roadmap)),
        };
      },
    },
  }).then((program) => {
    calls.push(input);
    return program;
  });
  return { generator, calls, getProviderCalls: () => providerCalls };
}

test('valid request returns only the validated Stage Program and calls generation once', async () => {
  const fake = createFakeStageGenerator();
  const roadmap = createRoadmap();
  const result = await callEndpoint(createApp(undefined, undefined, fake.generator), validRequest(roadmap));

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { program: validProgram(roadmap) });
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.getProviderCalls(), 1);
  assert.deepEqual(fake.calls[0].equipmentProfile.availableEquipmentIds, EQUIPMENT_IDS);
  assert.equal(Object.hasOwn(result.body, 'candidates'), false);
});

test('accepts canonical, single-delay-block, and repeated-delay schedules', async () => {
  const roadmap = createRoadmap();
  const patterns = [
    Array.from({ length: roadmap.durationDays }, () => 0),
    [0, 0, ...Array.from({ length: roadmap.durationDays - 2 }, () => 2)],
    [0, 0, 2, ...Array.from({ length: roadmap.durationDays - 3 }, () => 5)],
  ];
  for (const offsets of patterns) {
    const delayed = roadmapWithDelayOffsets(roadmap, offsets);
    const fake = createFakeStageGenerator();
    const result = await callEndpoint(createApp(undefined, undefined, fake.generator), validRequest(delayed));
    assert.equal(result.status, 200);
    assert.equal(fake.getProviderCalls(), 1);
  }
});

test('rejects negative and decreasing delay offsets, and a Boss delay that differs from the final slot', async () => {
  const roadmap = createRoadmap();
  const cases = [
    roadmapWithDelayOffsets(roadmap, [-1, ...Array.from({ length: roadmap.durationDays - 1 }, () => 0)]),
    roadmapWithDelayOffsets(roadmap, [0, 2, 1, ...Array.from({ length: roadmap.durationDays - 3 }, () => 1)]),
    { ...roadmap, boss: { ...roadmap.boss, date: addLocalDays(roadmap.boss.date, 1) } },
  ];
  for (const invalidRoadmap of cases) {
    const result = await callEndpoint(createApp(undefined, undefined, async () => {
      throw new Error('must not be called');
    }), validRequest(invalidRoadmap));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: { code: 'INVALID_REQUEST' } });
  }
});

test('rejects altered daily count, type, and D-032 session focus or Boss exposure', async () => {
  const roadmap = createRoadmap();
  const trainingIndex = roadmap.days.findIndex((day) => day.type === 'training');
  const recoveryIndex = roadmap.days.findIndex((day) => day.type === 'recovery');
  const changedTraining = roadmap.days[trainingIndex];
  const cases = [
    { ...roadmap, days: roadmap.days.slice(1) },
    { ...roadmap, days: roadmap.days.map((day, index) => index === trainingIndex ? { date: day.date, type: 'recovery' } : day) },
    { ...roadmap, days: roadmap.days.map((day, index) => index === trainingIndex
      ? { ...day, sessionFocus: { ...day.sessionFocus, targetMuscles: ['calves'] } }
      : day) },
    { ...roadmap, days: roadmap.days.map((day, index) => index === trainingIndex
      ? { ...day, bossMainExposure: !day.bossMainExposure }
      : day) },
    { ...roadmap, days: roadmap.days.map((day, index) => index === recoveryIndex
      ? { ...day, type: 'training', sessionFocus: changedTraining.sessionFocus, bossMainExposure: changedTraining.bossMainExposure }
      : day) },
  ];
  for (const invalidRoadmap of cases) {
    const result = await callEndpoint(createApp(undefined, undefined, async () => {
      throw new Error('must not be called');
    }), validRequest(invalidRoadmap));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: { code: 'INVALID_REQUEST' } });
  }
});

test('twelve Training Days still use one Stage generation operation', async () => {
  const fake = createFakeStageGenerator();
  const roadmap = createRoadmap(6);
  const result = await callEndpoint(createApp(undefined, undefined, fake.generator), validRequest(roadmap));

  assert.equal(result.status, 200);
  assert.equal(result.body.program.sessions.length, 12);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.getProviderCalls(), 1);
});

test('empty equipment is accepted at request validation but unavailable Main returns 422 with zero provider calls', async () => {
  const fake = createFakeStageGenerator();
  const result = await callEndpoint(
    createApp(undefined, undefined, fake.generator),
    { ...validRequest(), equipmentIds: [] },
  );

  assert.equal(result.status, 422);
  assert.deepEqual(result.body, { error: { code: 'MAIN_EXERCISE_UNAVAILABLE' } });
  assert.equal(fake.calls.length, 0);
  assert.equal(fake.getProviderCalls(), 0);
});

test('invalid equipment, duplicates, unknown fields, and malformed JSON stop before generation', async () => {
  let calls = 0;
  const generator = async () => {
    calls += 1;
    return validProgram(createRoadmap());
  };
  const body = validRequest();
  const invalidBodies = [
    { ...body, equipmentIds: ['unknown_equipment'] },
    { ...body, equipmentIds: ['barbell', 'barbell'] },
    { ...body, candidateExercises: [] },
    { ...body, roadmap: { ...body.roadmap, unexpected: true } },
    { ...body, roadmap: { ...body.roadmap, days: [] } },
    {
      ...body,
      roadmap: {
        ...body.roadmap,
        days: body.roadmap.days.map((day, index) => index === 1
          ? { ...day, date: body.roadmap.days[0].date }
          : day),
      },
    },
    { ...body, roadmap: { ...body.roadmap, days: body.roadmap.days.map((day, index) => index === 0 && day.type === 'training' ? { ...day, sessionFocus: { ...day.sessionFocus, unknown: true } } : day) } },
    { ...body, currentE1rmKg: 0 },
    { ...body, stageTargetE1rmKg: Number.NaN },
    { ...body, trainingExperienceMonths: 1.5 },
    { ...body, trainingFrequencyPerWeek: 8 },
  ];

  for (const invalidBody of invalidBodies) {
    const result = await callEndpoint(createApp(undefined, undefined, generator), invalidBody);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: { code: 'INVALID_REQUEST' } });
  }

  const malformedJson = await callEndpoint(createApp(undefined, undefined, generator), '{not json', true);
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(malformedJson.body, { error: { code: 'INVALID_REQUEST' } });
  assert.equal(calls, 0);
});

test('invalid Main, Stage Target, and frequency mismatches are rejected', async () => {
  const body = validRequest();
  const generator = async () => {
    throw new Error('must not be called');
  };
  const cases = [
    { ...body, mainExerciseId: 'push_up' },
    { ...body, stageTargetE1rmKg: 76 },
    { ...body, trainingFrequencyPerWeek: 4 },
  ];

  for (const invalidBody of cases) {
    const result = await callEndpoint(createApp(undefined, undefined, generator), invalidBody);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: { code: 'INVALID_REQUEST' } });
  }
});

test('Stage Adapter errors map to safe public HTTP codes without provider details', async () => {
  const body = validRequest();
  const cases = [
    ['OPENAI_API_ERROR', 502, 'PROVIDER_FAILURE'],
    ['STRUCTURED_OUTPUT_MISSING', 502, 'INVALID_STRUCTURED_OUTPUT'],
    ['DOMAIN_VALIDATION_FAILED', 502, 'INVALID_STRUCTURED_OUTPUT'],
    ['INVALID_INPUT', 400, 'INVALID_REQUEST'],
  ];

  for (const [code, status, publicCode] of cases) {
    const result = await callEndpoint(
      createApp(undefined, undefined, async () => {
        throw new StageTrainingProgramGenerationError(code, 'sensitive internal detail');
      }),
      body,
    );
    assert.equal(result.status, status);
    assert.deepEqual(result.body, { error: { code: publicCode } });
    assert.ok(!JSON.stringify(result.body).includes('sensitive'));
  }

  const unexpected = await callEndpoint(
    createApp(undefined, undefined, async () => {
      throw new Error('sensitive unexpected detail');
    }),
    body,
  );
  assert.equal(unexpected.status, 500);
  assert.deepEqual(unexpected.body, { error: { code: 'INTERNAL_ERROR' } });
  assert.ok(!JSON.stringify(unexpected.body).includes('sensitive'));
});

test('existing per-day Training Plan endpoint remains available', async () => {
  const result = await (async () => {
    const server = createApp(undefined, async () => validPlan()).listen(0, '127.0.0.1');
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const address = server.address();
      const response = await fetch(`http://127.0.0.1:${address.port}/api/training-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentIds: ['barbell', 'flat_bench'],
          trainingExperienceMonths: 8,
          mainExerciseId: 'barbell_bench_press',
          sessionFocus: { targetMuscles: ['chest'] },
        }),
      });
      return { status: response.status, body: await response.json() };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  })();

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { plan: validPlan() });
});
