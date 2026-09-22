import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
  UnprocessableEntityError,
} from 'openai';

import { achievementDurationEstimateFormat } from '../dist/openai/achievementDurationSchema.js';
import {
  ACHIEVEMENT_DURATION_ESTIMATOR_PROMPT_VERSION,
  AchievementDurationGenerationError,
  buildAchievementDurationEstimatorInput,
  classifyOpenAIProviderError,
  generateAchievementDurationEstimate,
  validateGeneratedAchievementDurationEstimate,
} from '../dist/openai/achievementDuration.js';

const estimatorInput = {
  exerciseId: 'barbell_bench_press',
  currentE1rmKg: 70,
  stageTargetE1rmKg: 75,
  trainingExperienceMonths: 8,
  trainingFrequencyPerWeek: 3,
};

function fakeCause(code) {
  return Object.assign(new Error('secret low-level detail'), { code });
}

test('strict JSON Schema allows only estimatedAchievementDays', () => {
  const root = achievementDurationEstimateFormat.schema;
  assert.equal(achievementDurationEstimateFormat.strict, true);
  assert.deepEqual(root.required, ['estimatedAchievementDays']);
  assert.equal(root.additionalProperties, false);
  assert.deepEqual(root.properties, {
    estimatedAchievementDays: { type: 'integer', minimum: 1 },
  });
});

test('estimator request contains only the separate duration input', () => {
  assert.deepEqual(JSON.parse(buildAchievementDurationEstimatorInput(estimatorInput)), estimatorInput);
  assert.equal(ACHIEVEMENT_DURATION_ESTIMATOR_PROMPT_VERSION, 'achievement-duration-estimator-prompt-v1');
});

test('adapter sends a valid Responses payload without choosing a duration candidate', async () => {
  let request;
  const fakeClient = {
    responses: {
      create: async (input) => {
        request = input;
        return { status: 'completed', output_text: '{"estimatedAchievementDays":24}' };
      },
    },
  };

  assert.deepEqual(await generateAchievementDurationEstimate(estimatorInput, fakeClient), {
    estimatedAchievementDays: 24,
  });
  assert.equal(request.text.format, achievementDurationEstimateFormat);
  assert.deepEqual(JSON.parse(request.input), estimatorInput);
  assert.match(request.instructions, /current e1RM/i);
  assert.match(request.instructions, /stage target/i);
  assert.match(request.instructions, /Do not choose a roadmap duration/i);
  assert.doesNotMatch(request.instructions, /14|21|28|35|42/);
});

test('invalid shared input is rejected before an OpenAI call', async () => {
  let called = false;
  await assert.rejects(
    generateAchievementDurationEstimate(
      { ...estimatorInput, stageTargetE1rmKg: 70 },
      { responses: { create: async () => { called = true; } } },
    ),
    (error) => error instanceof AchievementDurationGenerationError && error.code === 'INVALID_INPUT',
  );
  assert.equal(called, false);
});

test('valid output is parsed and extra fields are rejected by shared validation', () => {
  assert.deepEqual(validateGeneratedAchievementDurationEstimate('{"estimatedAchievementDays":24}'), {
    estimatedAchievementDays: 24,
  });
  assert.throws(
    () => validateGeneratedAchievementDurationEstimate('{"estimatedAchievementDays":24,"reasoning":"no"}'),
    (error) => error instanceof AchievementDurationGenerationError && error.code === 'DOMAIN_VALIDATION_FAILED',
  );
});

test('JSON parse failures expose a safe internal diagnostic reason', async () => {
  await assert.rejects(
    generateAchievementDurationEstimate(estimatorInput, {
      responses: { create: async () => ({ status: 'completed', output_text: 'not JSON' }) },
    }),
    (error) => error instanceof AchievementDurationGenerationError &&
      error.code === 'STRUCTURED_OUTPUT_MISSING' &&
      error.diagnostic?.reason === 'json_parse_failed',
  );
});

test('response_not_completed is distinguished without exposing the response', async () => {
  await assert.rejects(
    generateAchievementDurationEstimate(estimatorInput, {
      responses: { create: async () => ({ status: 'incomplete', output_text: '{"estimatedAchievementDays":24}' }) },
    }),
    (error) => error instanceof AchievementDurationGenerationError &&
      error.code === 'STRUCTURED_OUTPUT_MISSING' &&
      error.diagnostic?.reason === 'response_not_completed' &&
      error.diagnostic.responseStatus === 'incomplete',
  );
});

test('output_text_missing is distinguished for empty, whitespace, and absent output', async () => {
  for (const output_text of [undefined, null, '', '   ']) {
    await assert.rejects(
      generateAchievementDurationEstimate(estimatorInput, {
        responses: { create: async () => ({ status: 'completed', output_text }) },
      }),
      (error) => error instanceof AchievementDurationGenerationError &&
        error.code === 'STRUCTURED_OUTPUT_MISSING' &&
        error.diagnostic?.reason === 'output_text_missing' &&
        error.diagnostic.responseStatus === 'completed',
    );
  }
});

test('domain validation failures expose a safe internal diagnostic reason', async () => {
  await assert.rejects(
    generateAchievementDurationEstimate(estimatorInput, {
      responses: { create: async () => ({ status: 'completed', output_text: '{"estimatedAchievementDays":0}' }) },
    }),
    (error) => error instanceof AchievementDurationGenerationError &&
      error.code === 'DOMAIN_VALIDATION_FAILED' &&
      error.diagnostic?.reason === 'domain_validation_failed',
  );
});

test('SDK failures are sanitized', async () => {
  await assert.rejects(
    generateAchievementDurationEstimate(estimatorInput, {
      responses: { create: async () => { throw new Error('secret-bearing request detail'); } },
    }),
    (error) => error instanceof AchievementDurationGenerationError &&
      error.code === 'OPENAI_API_ERROR' && !error.message.includes('secret-bearing'),
  );
});

test('OpenAI SDK failures are classified using safe metadata only', () => {
  const headers = new Headers({ 'x-request-id': 'request-id-is-not-logged' });
  const cases = [
    [new BadRequestError(400, { code: 'invalid_request_error', type: 'invalid_request_error' }, 'secret', headers), 'bad_request', 400],
    [new UnprocessableEntityError(422, { code: 'unprocessable_entity', type: 'invalid_request_error' }, 'secret', headers), 'bad_request', 422],
    [new AuthenticationError(401, { code: 'invalid_api_key', type: 'authentication_error' }, 'secret', headers), 'authentication', 401],
    [new PermissionDeniedError(403, { code: 'forbidden', type: 'permission_error' }, 'secret', headers), 'permission_denied', 403],
    [new NotFoundError(404, { code: 'not_found', type: 'not_found_error' }, 'secret', headers), 'not_found', 404],
    [new RateLimitError(429, { code: 'credit_balance_exhausted', type: 'rate_limit_error' }, 'secret', headers), 'rate_limit', 429],
    [new InternalServerError(503, { code: 'server_error', type: 'server_error' }, 'secret', headers), 'server_error', 503],
    [new APIConnectionError({ message: 'secret connection detail', cause: fakeCause('ECONNRESET') }), 'connection_error', undefined],
    [Object.assign(new APIConnectionTimeoutError({ message: 'secret timeout detail' }), { cause: fakeCause('ETIMEDOUT') }), 'timeout', undefined],
    [new Error('secret unknown provider detail'), 'unknown_provider_error', undefined],
  ];

  for (const [error, kind, status] of cases) {
    const diagnostic = classifyOpenAIProviderError(error);
    assert.equal(diagnostic.kind, kind);
    assert.equal(diagnostic.status, status);
    assert.equal('message' in diagnostic, false);
    assert.equal('headers' in diagnostic, false);
    assert.equal('requestID' in diagnostic, false);
  }

  const connection = classifyOpenAIProviderError(
    new APIConnectionError({ message: 'secret connection detail', cause: fakeCause('ECONNRESET') }),
  );
  assert.equal(connection.kind, 'connection_error');
  assert.equal(connection.causeCode, 'ECONNRESET');

  const depthTwoCause = Object.assign(new TypeError('secret wrapper detail'), {
    cause: fakeCause('UND_ERR_SOCKET'),
  });
  const depthTwoConnection = classifyOpenAIProviderError(
    new APIConnectionError({ message: 'secret connection detail', cause: depthTwoCause }),
  );
  assert.equal(depthTwoConnection.kind, 'connection_error');
  assert.equal(depthTwoConnection.causeCode, 'UND_ERR_SOCKET');

  const depthThreeCause = Object.assign(new TypeError('secret wrapper detail'), {
    cause: Object.assign(new Error('secret nested detail'), {
      cause: fakeCause('ETIMEDOUT'),
    }),
  });
  const depthThreeConnection = classifyOpenAIProviderError(
    new APIConnectionError({ message: 'secret connection detail', cause: depthThreeCause }),
  );
  assert.equal(depthThreeConnection.kind, 'connection_error');
  assert.equal(depthThreeConnection.causeCode, 'ETIMEDOUT');

  const noCodeCause = Object.assign(new TypeError('secret wrapper detail'), {
    cause: Object.assign(new Error('secret nested detail'), {
      cause: new Error('secret low-level detail'),
    }),
  });
  const noCodeConnection = classifyOpenAIProviderError(
    new APIConnectionError({ message: 'secret connection detail', cause: noCodeCause }),
  );
  assert.equal(noCodeConnection.kind, 'connection_error');
  assert.equal(noCodeConnection.causeCode, undefined);

  const unsafeCodeConnection = classifyOpenAIProviderError(
    new APIConnectionError({ message: 'secret connection detail', cause: fakeCause('invalid code!') }),
  );
  assert.equal(unsafeCodeConnection.kind, 'connection_error');
  assert.equal(unsafeCodeConnection.causeCode, undefined);

  const cyclicCause = new TypeError('secret cyclic detail');
  Object.assign(cyclicCause, { cause: cyclicCause });
  const cyclicConnection = classifyOpenAIProviderError(
    new APIConnectionError({ message: 'secret connection detail', cause: cyclicCause }),
  );
  assert.equal(cyclicConnection.kind, 'connection_error');
  assert.equal(cyclicConnection.causeCode, undefined);

  const timeout = classifyOpenAIProviderError(
    Object.assign(new APIConnectionTimeoutError({ message: 'secret timeout detail' }), {
      cause: fakeCause('ETIMEDOUT'),
    }),
  );
  assert.equal(timeout.kind, 'timeout');
  assert.equal(timeout.causeCode, 'ETIMEDOUT');

  const rateLimit = classifyOpenAIProviderError(
    new RateLimitError(429, { code: 'credit_balance_exhausted', type: 'rate_limit_error' }, 'secret', headers),
  );
  assert.equal(rateLimit.code, 'credit_balance_exhausted');

  const unsafeRateLimit = classifyOpenAIProviderError(
    new RateLimitError(429, { code: 'secret provider detail', type: 'rate_limit_error' }, 'secret', headers),
  );
  assert.equal(unsafeRateLimit.code, undefined);
});

test('provider failure diagnostic is attached without exposing provider content', async () => {
  await assert.rejects(
    generateAchievementDurationEstimate(estimatorInput, {
      responses: {
        create: async () => {
          throw new AuthenticationError(
            401,
            { code: 'invalid_api_key', type: 'authentication_error' },
            'secret provider detail',
            new Headers(),
          );
        },
      },
    }),
    (error) => error instanceof AchievementDurationGenerationError &&
      error.code === 'OPENAI_API_ERROR' &&
      error.providerDiagnostic?.kind === 'authentication' &&
      error.providerDiagnostic.status === 401 &&
      !error.message.includes('secret provider detail'),
  );
});
