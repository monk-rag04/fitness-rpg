import assert from 'node:assert/strict';
import test from 'node:test';

import { achievementDurationEstimateFormat } from '../dist/openai/achievementDurationSchema.js';
import {
  ACHIEVEMENT_DURATION_ESTIMATOR_PROMPT_VERSION,
  AchievementDurationGenerationError,
  buildAchievementDurationEstimatorInput,
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

test('malformed and missing structured output are distinguishable', async () => {
  assert.throws(
    () => validateGeneratedAchievementDurationEstimate('not JSON'),
    (error) => error instanceof AchievementDurationGenerationError && error.code === 'STRUCTURED_OUTPUT_MISSING',
  );
  await assert.rejects(
    generateAchievementDurationEstimate(estimatorInput, {
      responses: { create: async () => ({ status: 'incomplete', output_text: '' }) },
    }),
    (error) => error instanceof AchievementDurationGenerationError && error.code === 'STRUCTURED_OUTPUT_MISSING',
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
