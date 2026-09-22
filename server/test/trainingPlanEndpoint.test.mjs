import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../dist/app.js';
import { TrainingPlanGenerationError } from '../dist/openai/trainingPlan.js';

const validRequest = {
  equipmentIds: ['barbell', 'flat_bench'],
  trainingExperienceMonths: 8,
  mainExerciseId: 'barbell_bench_press',
  sessionFocus: {
    targetMuscles: ['chest'],
    targetMovementPatterns: ['horizontal_push'],
  },
};

const validPlan = {
  exercises: [
    {
      exerciseId: 'barbell_bench_press',
      role: 'main',
      sets: 3,
      repRange: { min: 5, max: 8 },
    },
  ],
};

async function callEndpoint(app, body, raw = false) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/training-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('valid request builds candidates on the server and returns only the validated plan', async () => {
  const inputs = [];
  const result = await callEndpoint(createApp(undefined, async (input) => {
    inputs.push(input);
    return validPlan;
  }), validRequest);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { plan: validPlan });
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].candidates.mainExercise.exerciseId, 'barbell_bench_press');
  assert.deepEqual(inputs[0].candidates.candidateExercises.map((candidate) => candidate.exerciseId), ['push_up']);
  assert.equal(inputs[0].context.trainingExperienceMonths, 8);
  assert.deepEqual(inputs[0].context.sessionFocus, validRequest.sessionFocus);
});

test('malformed request, candidate injection, and invalid request fields do not call the provider', async () => {
  let calls = 0;
  const generatePlan = async () => {
    calls += 1;
    return validPlan;
  };

  const invalidBodies = [
    { ...validRequest, candidateExercises: [{ exerciseId: 'fabricated' }] },
    { ...validRequest, equipmentIds: ['barbell', 'unknown_equipment'] },
    { ...validRequest, equipmentIds: ['barbell', 'barbell'] },
    { ...validRequest, trainingExperienceMonths: -1 },
    { ...validRequest, mainExerciseId: 'unknown_exercise' },
    { ...validRequest, sessionFocus: { targetMuscles: 'chest' } },
    { ...validRequest, sessionFocus: { targetMuscles: ['unknown_muscle'] } },
  ];

  for (const body of invalidBodies) {
    const result = await callEndpoint(createApp(undefined, generatePlan), body);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { error: { code: 'INVALID_REQUEST' } });
  }

  const malformedJson = await callEndpoint(createApp(undefined, generatePlan), '{not json', true);
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(malformedJson.body, { error: { code: 'INVALID_REQUEST' } });
  assert.equal(calls, 0);
});

test('empty equipment is structurally valid but an unavailable main exercise stops before the provider', async () => {
  let calls = 0;
  const result = await callEndpoint(createApp(undefined, async () => {
    calls += 1;
    return validPlan;
  }), { ...validRequest, equipmentIds: [] });

  assert.equal(result.status, 422);
  assert.deepEqual(result.body, { error: { code: 'MAIN_EXERCISE_UNAVAILABLE' } });
  assert.equal(calls, 0);
});

test('shared D-030 guardrails reject an invalid generated plan at the endpoint boundary', async () => {
  const result = await callEndpoint(createApp(undefined, async () => ({
    exercises: [{
      ...validPlan.exercises[0],
      sets: 6,
    }],
  })), validRequest);

  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { error: { code: 'INVALID_STRUCTURED_OUTPUT' } });
});

test('provider, structured-output, and unexpected failures use safe public codes', async () => {
  const providerFailure = await callEndpoint(createApp(undefined, async () => {
    throw new TrainingPlanGenerationError('OPENAI_API_ERROR', 'sensitive provider detail');
  }), validRequest);
  assert.equal(providerFailure.status, 502);
  assert.deepEqual(providerFailure.body, { error: { code: 'PROVIDER_FAILURE' } });
  assert.ok(!JSON.stringify(providerFailure.body).includes('sensitive'));

  const structuredFailure = await callEndpoint(createApp(undefined, async () => {
    throw new TrainingPlanGenerationError('DOMAIN_VALIDATION_FAILED', 'sensitive output detail');
  }), validRequest);
  assert.equal(structuredFailure.status, 502);
  assert.deepEqual(structuredFailure.body, { error: { code: 'INVALID_STRUCTURED_OUTPUT' } });

  const internalFailure = await callEndpoint(createApp(undefined, async () => {
    throw new Error('sensitive unexpected detail');
  }), validRequest);
  assert.equal(internalFailure.status, 500);
  assert.deepEqual(internalFailure.body, { error: { code: 'INTERNAL_ERROR' } });
});
