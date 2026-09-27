import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrainingCandidates,
  generateStageRoadmap,
  getCanonicalStageTrainingDays,
  validateStageTrainingProgram,
} from '@fitness-rpg/shared';
import {
  requestStageTrainingProgram,
} from '../src/application/stageTrainingProgram.ts';
import { requestTrainingPlan } from '../src/application/trainingPlan.ts';

function createRoadmap(frequency = 3) {
  return generateStageRoadmap({
    startDate: '2026-09-22',
    durationDays: 14,
    trainingFrequencyPerWeek: frequency,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
  });
}

function createTwelveTrainingDayRoadmap() {
  const roadmap = createRoadmap();
  return {
    ...roadmap,
    days: roadmap.days.map((day, dayIndex) => dayIndex < 12
      ? {
        date: day.date,
        type: 'training',
        sessionFocus: { targetMuscles: ['chest'] },
        bossMainExposure: dayIndex % 2 === 0,
      }
      : { date: day.date, type: 'recovery' }),
  };
}

function createDaySpecificRoadmap() {
  const roadmap = createRoadmap();
  return {
    ...roadmap,
    days: roadmap.days.map((day, dayIndex) => {
      if (dayIndex === 2) {
        return {
          date: day.date,
          type: 'training',
          sessionFocus: { targetMuscles: ['back'] },
          bossMainExposure: day.bossMainExposure,
        };
      }
      return day;
    }),
  };
}

function createInput(roadmap = createRoadmap()) {
  return {
    equipmentIds: ['barbell', 'flat_bench'],
    mainExerciseId: 'barbell_bench_press',
    currentE1rmKg: 70,
    stageTargetE1rmKg: 75,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: roadmap.trainingFrequencyPerWeek,
    roadmap,
  };
}

function validPlan(roadmap = createRoadmap(), dayIndex = 0) {
  const day = roadmap.days[dayIndex];
  const candidates = buildTrainingCandidates({
    equipmentProfile: {
      id: 'client-stage-response-validation',
      displayName: 'Client response validation',
      availableEquipmentIds: ['barbell', 'flat_bench'],
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

function invalidResponse() {
  return {
    status: 'stage_training_program_request_failed',
    code: 'invalid_response',
  };
}

test('sends one minimal Stage Program POST and returns a validated multi-day result', async () => {
  const input = createInput();
  const expectedBody = structuredClone(input);
  const expectedProgram = validProgram(input.roadmap);
  let calls = 0;

  const result = await requestStageTrainingProgram({
    ...input,
    candidateExercises: [{ exerciseId: 'must-not-send' }],
    plan: { exercises: [] },
    role: 'main',
    sets: 3,
    reps: 8,
  }, {
    request: async (url, init) => {
      calls += 1;
      assert.equal(url, '/api/stage-training-program');
      assert.equal(init.method, 'POST');
      assert.deepEqual(init.headers, { 'Content-Type': 'application/json' });
      const body = JSON.parse(init.body);
      assert.deepEqual(body, expectedBody);
      assert.equal(Object.hasOwn(body, 'candidateExercises'), false);
      assert.equal(Object.hasOwn(body, 'plan'), false);
      assert.equal(Object.hasOwn(body, 'role'), false);
      assert.equal(Object.hasOwn(body, 'sets'), false);
      assert.equal(Object.hasOwn(body, 'reps'), false);
      return Response.json({ program: expectedProgram });
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, {
    status: 'stage_training_program_ready',
    program: expectedProgram,
  });
});

test('validates all twelve canonical Training Days through the Shared validator', async () => {
  const input = createInput(createTwelveTrainingDayRoadmap());
  const program = validProgram(input.roadmap);
  assert.equal(program.sessions.length, 12);

  const result = await requestStageTrainingProgram(input, {
    request: async () => Response.json({ program }),
  });

  assert.deepEqual(result, {
    status: 'stage_training_program_ready',
    program,
  });
});

test('rejects malformed, partial, duplicate, extra, Recovery, and invalid program responses', async () => {
  const input = createInput();
  const program = validProgram(input.roadmap);
  const canonicalDays = getCanonicalStageTrainingDays(input.roadmap);
  const firstDay = canonicalDays[0].dayIndex;
  const backDay = canonicalDays[1].dayIndex;
  const daySpecificInput = createInput(createDaySpecificRoadmap());
  const daySpecificProgram = validProgram(daySpecificInput.roadmap);

  const candidateMismatch = structuredClone(daySpecificProgram);
  candidateMismatch.sessions.find((session) => session.dayIndex === backDay).plan = {
    exercises: [
      validPlan().exercises[0],
      {
        exerciseId: 'push_up',
        role: 'accessory',
        sets: 3,
        repRange: { min: 8, max: 12 },
      },
    ],
  };

  const invalidBodies = [
    {},
    { program, unexpected: true },
    { program: {} },
    { program: { sessions: program.sessions.slice(1) } },
    { program: { sessions: [program.sessions[0], program.sessions[0], ...program.sessions.slice(1)] } },
    { program: { sessions: [...program.sessions, { dayIndex: 1, plan: validPlan() }] } },
    { program: { sessions: program.sessions.map((session) => session.dayIndex === firstDay
      ? { ...session, dayIndex: 1 }
      : session) } },
    { program: { sessions: program.sessions.map((session) => session.dayIndex === firstDay
      ? { ...session, plan: { exercises: [{ ...validPlan().exercises[0], exerciseId: 'dumbbell_bench_press' }] } }
      : session) } },
    { program: { sessions: program.sessions.map((session) => session.dayIndex === firstDay
      ? { ...session, plan: { exercises: [] } }
      : session) } },
    { program: { sessions: program.sessions.map((session) => session.dayIndex === firstDay
      ? { ...session, plan: { exercises: [{ ...validPlan().exercises[0], sets: 6 }] } }
      : session) } },
    { program: { sessions: program.sessions.map((session) => session.dayIndex === firstDay
      ? { ...session, plan: { exercises: [{
        ...validPlan().exercises[0],
        repRange: { min: 0, max: 8 },
      }] } }
      : session) } },
  ];

  for (const body of invalidBodies) {
    const result = await requestStageTrainingProgram(input, {
      request: async () => Response.json(body),
    });
    assert.deepEqual(result, invalidResponse());
  }

  const candidateResult = await requestStageTrainingProgram(daySpecificInput, {
    request: async () => Response.json({ program: candidateMismatch }),
  });
  assert.deepEqual(candidateResult, invalidResponse());

  const directValidation = validateStageTrainingProgram(program, {
    roadmap: input.roadmap,
    trainingDays: [],
  });
  assert.equal(directValidation.valid, false);
});

test('rejects malformed JSON without returning a partial program', async () => {
  const result = await requestStageTrainingProgram(createInput(), {
    request: async () => new Response('{not JSON', { status: 200 }),
  });
  assert.deepEqual(result, invalidResponse());
  assert.equal(Object.hasOwn(result, 'program'), false);
});

for (const [status, serverCode, clientCode] of [
  [400, 'INVALID_REQUEST', 'invalid_request'],
  [422, 'MAIN_EXERCISE_UNAVAILABLE', 'main_exercise_unavailable'],
  [422, 'NO_VALID_CANDIDATES', 'no_valid_candidates'],
  [502, 'PROVIDER_FAILURE', 'provider_failure'],
  [502, 'INVALID_STRUCTURED_OUTPUT', 'invalid_structured_output'],
  [500, 'INTERNAL_ERROR', 'internal_error'],
]) {
  test(`maps ${status} ${serverCode} to ${clientCode}`, async () => {
    const result = await requestStageTrainingProgram(createInput(), {
      request: async () => Response.json({
        error: { code: serverCode, raw: 'must-not-leak' },
      }, { status }),
    });
    assert.deepEqual(result, {
      status: 'stage_training_program_request_failed',
      code: clientCode,
    });
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });
}

test('maps unknown server failures to a safe code and does not retry network failures', async () => {
  const unknown = await requestStageTrainingProgram(createInput(), {
    request: async () => Response.json({
      error: { code: 'UNEXPECTED_SERVER_CODE', message: 'sensitive server detail' },
    }, { status: 503 }),
  });
  assert.deepEqual(unknown, {
    status: 'stage_training_program_request_failed',
    code: 'internal_error',
  });
  assert.ok(!JSON.stringify(unknown).includes('sensitive'));

  let calls = 0;
  const network = await requestStageTrainingProgram(createInput(), {
    request: async () => {
      calls += 1;
      throw new Error('sensitive network detail');
    },
  });
  assert.deepEqual(network, {
    status: 'stage_training_program_request_failed',
    code: 'network_error',
  });
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(network).includes('sensitive'));
});

test('does not mutate input and leaves the existing per-day helper unchanged', async () => {
  const input = createInput();
  const snapshot = structuredClone(input);
  await requestStageTrainingProgram(input, {
    request: async () => Response.json({ program: validProgram(input.roadmap) }),
  });
  assert.deepEqual(input, snapshot);

  const perDay = await requestTrainingPlan({
    equipmentIds: ['barbell', 'flat_bench'],
    trainingExperienceMonths: 8,
    mainExerciseId: 'barbell_bench_press',
    sessionFocus: { targetMuscles: ['chest'] },
  }, {
    request: async () => Response.json({ plan: validPlan() }),
  });
  assert.deepEqual(perDay, { status: 'training_plan_ready', plan: validPlan() });
});
