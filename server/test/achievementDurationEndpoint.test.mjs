import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../dist/app.js';
import { AchievementDurationGenerationError } from '../dist/openai/achievementDuration.js';

const validRequest = {
  exerciseId: 'barbell_bench_press',
  currentE1rmKg: 70,
  stageTargetE1rmKg: 75,
  trainingExperienceMonths: 8,
  trainingFrequencyPerWeek: 3,
};

async function callEndpoint(app, body, raw = false) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/achievement-duration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('valid request calls adapter once and returns only safe days', async () => {
  const inputs = [];
  const result = await callEndpoint(createApp(async (input) => {
    inputs.push(input);
    return { estimatedAchievementDays: 24, raw: 'secret raw response' };
  }), validRequest);
  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { error: { code: 'INVALID_STRUCTURED_OUTPUT' } });
  assert.deepEqual(inputs, [validRequest]);

  const success = await callEndpoint(createApp(async () => ({ estimatedAchievementDays: 24 })), validRequest);
  assert.equal(success.status, 200);
  assert.deepEqual(success.body, { estimatedAchievementDays: 24 });
});

test('invalid request is rejected before adapter call', async () => {
  let calls = 0;
  const result = await callEndpoint(createApp(async () => {
    calls++;
    return { estimatedAchievementDays: 20 };
  }), { ...validRequest, stageTargetE1rmKg: 70, secret: 'must not echo' });
  assert.equal(calls, 0);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: { code: 'INVALID_REQUEST' } });
  const malformed = await callEndpoint(createApp(async () => {
    calls++;
    return { estimatedAchievementDays: 20 };
  }), '{not json', true);
  assert.equal(calls, 0);
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { error: { code: 'INVALID_REQUEST' } });
});

test('provider failures are sanitized', async () => {
  const result = await callEndpoint(createApp(async () => {
    throw new AchievementDurationGenerationError('OPENAI_API_ERROR', 'secret raw provider detail');
  }), validRequest);
  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { error: { code: 'PROVIDER_FAILURE' } });
});

test('all provider failure kinds keep the public 502 contract', async () => {
  const diagnostics = [
    { kind: 'bad_request', status: 400 },
    { kind: 'authentication', status: 401 },
    { kind: 'permission_denied', status: 403 },
    { kind: 'not_found', status: 404 },
    { kind: 'rate_limit', status: 429, code: 'credit_balance_exhausted' },
    { kind: 'server_error', status: 500 },
    { kind: 'connection_error', causeCode: 'ECONNRESET' },
    { kind: 'timeout', causeCode: 'ETIMEDOUT' },
    { kind: 'unknown_provider_error' },
  ];

  for (const diagnostic of diagnostics) {
    const result = await callEndpoint(createApp(async () => {
      throw new AchievementDurationGenerationError(
        'OPENAI_API_ERROR',
        'secret raw provider detail',
        undefined,
        diagnostic,
      );
    }), validRequest);
    assert.equal(result.status, 502);
    assert.deepEqual(result.body, { error: { code: 'PROVIDER_FAILURE' } });
  }
});

test('invalid structured output is distinct and never echoes raw content', async () => {
  for (const code of ['STRUCTURED_OUTPUT_MISSING', 'DOMAIN_VALIDATION_FAILED']) {
    const result = await callEndpoint(createApp(async () => {
      throw new AchievementDurationGenerationError(code, 'secret raw output');
    }), validRequest);
    assert.equal(result.status, 502);
    assert.deepEqual(result.body, { error: { code: 'INVALID_STRUCTURED_OUTPUT' } });
  }
  const malformed = await callEndpoint(createApp(async () => ({ estimatedAchievementDays: -1 })), validRequest);
  assert.equal(malformed.status, 502);
  assert.deepEqual(malformed.body, { error: { code: 'INVALID_STRUCTURED_OUTPUT' } });
});

test('unexpected error is sanitized', async () => {
  const result = await callEndpoint(createApp(async () => { throw new Error('secret'); }), validRequest);
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: { code: 'INTERNAL_ERROR' } });
});
