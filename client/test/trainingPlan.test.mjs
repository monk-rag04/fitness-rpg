import assert from 'node:assert/strict';
import test from 'node:test';

import { requestTrainingPlan } from '../src/application/trainingPlan.ts';

const input = {
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

test('sends one minimal POST request and returns a defensively validated plan', async () => {
  let calls = 0;
  const result = await requestTrainingPlan({
    ...input,
    equipmentProfile: { id: 'must-not-send', displayName: 'Must not send' },
    candidateExercises: [{ exerciseId: 'must-not-send' }],
  }, {
    request: async (url, init) => {
      calls += 1;
      assert.equal(url, '/api/training-plan');
      assert.equal(init.method, 'POST');
      assert.deepEqual(init.headers, { 'Content-Type': 'application/json' });
      assert.deepEqual(JSON.parse(init.body), input);
      return Response.json({ plan: validPlan });
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, { status: 'training_plan_ready', plan: validPlan });
});

test('malformed 200 responses are not treated as usable training plans', async () => {
  for (const body of [
    {},
    { plan: { exercises: [{ ...validPlan.exercises[0], sets: 6 }] } },
    { plan: validPlan, provider: 'must-not-accept' },
  ]) {
    const result = await requestTrainingPlan(input, {
      request: async () => Response.json(body),
    });
    assert.deepEqual(result, {
      status: 'training_plan_request_failed',
      code: 'invalid_response',
    });
  }
});

for (const [status, serverCode, clientCode] of [
  [400, 'INVALID_REQUEST', 'invalid_request'],
  [422, 'MAIN_EXERCISE_UNAVAILABLE', 'main_exercise_unavailable'],
  [502, 'PROVIDER_FAILURE', 'provider_failure'],
  [502, 'INVALID_STRUCTURED_OUTPUT', 'invalid_structured_output'],
  [500, 'INTERNAL_ERROR', 'internal_error'],
]) {
  test(`maps ${status} ${serverCode} to ${clientCode}`, async () => {
    const result = await requestTrainingPlan(input, {
      request: async () => Response.json({
        error: { code: serverCode, raw: 'must-not-leak' },
      }, { status }),
    });
    assert.deepEqual(result, {
      status: 'training_plan_request_failed',
      code: clientCode,
    });
    assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  });
}

test('maps malformed and unknown server failures to safe error codes', async () => {
  const unknown = await requestTrainingPlan(input, {
    request: async () => Response.json({
      error: { code: 'UNEXPECTED_SERVER_CODE', message: 'sensitive server detail' },
    }, { status: 503 }),
  });
  assert.deepEqual(unknown, {
    status: 'training_plan_request_failed',
    code: 'internal_error',
  });
  assert.ok(!JSON.stringify(unknown).includes('sensitive'));

  const malformed = await requestTrainingPlan(input, {
    request: async () => new Response('not JSON', { status: 502 }),
  });
  assert.deepEqual(malformed, {
    status: 'training_plan_request_failed',
    code: 'invalid_response',
  });
});

test('maps fetch failures to network_error without automatic retry', async () => {
  let calls = 0;
  const result = await requestTrainingPlan(input, {
    request: async () => {
      calls += 1;
      throw new Error('sensitive network detail');
    },
  });
  assert.deepEqual(result, {
    status: 'training_plan_request_failed',
    code: 'network_error',
  });
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(result).includes('sensitive'));
});
