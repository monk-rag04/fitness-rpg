import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTrainingCandidates } from '@fitness-rpg/shared';
import { MissingOpenAIKeyError, createOpenAIClient, isOpenAIConfigured } from '../dist/openai/client.js';
import { trainingPlanDraftFormat } from '../dist/openai/trainingPlanSchema.js';
import {
  TrainingPlanGenerationError,
  buildTrainingPlanInput,
  generateTrainingPlan,
  validateGeneratedTrainingPlan,
} from '../dist/openai/trainingPlan.js';

const candidates = buildTrainingCandidates({
  mainExerciseId: 'barbell_bench_press',
  targetMuscles: ['chest'],
  targetMovementPatterns: ['horizontal_push'],
  equipmentProfile: {
    id: 'test-profile',
    displayName: 'Barbell and bench',
    availableEquipmentIds: ['barbell', 'flat_bench'],
  },
});
const plannerInput = {
  candidates,
  context: {
    trainingExperienceMonths: 8,
    sessionFocus: {
      targetMuscles: ['chest'],
      targetMovementPatterns: ['horizontal_push'],
    },
  },
};
const validDraft = {
  exercises: [
    {
      exerciseId: 'barbell_bench_press',
      role: 'main',
      sets: 3,
      repRange: { min: 5, max: 8 },
    },
  ],
};

test('strict JSON Schema has only TrainingPlanDraft fields', () => {
  const root = trainingPlanDraftFormat.schema;
  const exercise = root.properties.exercises.items;
  const repRange = exercise.properties.repRange;
  assert.equal(trainingPlanDraftFormat.strict, true);
  assert.equal(root.additionalProperties, false);
  assert.deepEqual(root.required, ['exercises']);
  assert.equal(root.properties.exercises.maxItems, 6);
  assert.deepEqual(exercise.required, ['exerciseId', 'role', 'sets', 'repRange']);
  assert.equal(exercise.additionalProperties, false);
  assert.deepEqual(exercise.properties.role.enum, ['main', 'accessory']);
  assert.deepEqual(repRange.required, ['min', 'max']);
  assert.equal(repRange.additionalProperties, false);
  assert.equal(exercise.properties.sets.maximum, 5);
  assert.equal(repRange.properties.min.maximum, 20);
  assert.equal(repRange.properties.max.maximum, 20);
  assert.ok(!Object.hasOwn(exercise.properties, 'weight'));
});

test('request contains candidates and session context, not equipment profile', () => {
  assert.deepEqual(JSON.parse(buildTrainingPlanInput(plannerInput)), {
    candidates,
    trainingExperienceMonths: 8,
    sessionFocus: plannerInput.context.sessionFocus,
  });
  assert.ok(!buildTrainingPlanInput(plannerInput).includes('test-profile'));
});

test('generated JSON is validated by shared domain', () => {
  assert.deepEqual(validateGeneratedTrainingPlan(JSON.stringify(validDraft), candidates), validDraft);
  assert.throws(
    () => validateGeneratedTrainingPlan(JSON.stringify({ exercises: [{ ...validDraft.exercises[0], weight: 60 }] }), candidates),
    (error) => error instanceof TrainingPlanGenerationError && error.code === 'DOMAIN_VALIDATION_FAILED',
  );
  assert.throws(
    () => validateGeneratedTrainingPlan('not JSON', candidates),
    (error) => error instanceof TrainingPlanGenerationError && error.code === 'STRUCTURED_OUTPUT_MISSING',
  );
});

test('missing key is distinguishable without exposing a value', () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.equal(isOpenAIConfigured(), false);
    assert.throws(
      () => createOpenAIClient(),
      (error) => error instanceof MissingOpenAIKeyError && error.code === 'OPENAI_API_KEY_MISSING',
    );
  } finally {
    if (priorKey !== undefined) process.env.OPENAI_API_KEY = priorKey;
  }
});

test('missing OpenAI configuration is sanitized as a provider failure', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      generateTrainingPlan(plannerInput),
      (error) => error instanceof TrainingPlanGenerationError &&
        error.code === 'OPENAI_API_ERROR' &&
        !error.message.includes('OPENAI_API_KEY'),
    );
  } finally {
    if (priorKey !== undefined) process.env.OPENAI_API_KEY = priorKey;
  }
});

test('shared OpenAI client disables SDK automatic retries', () => {
  const priorKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'unit-test-key';
  try {
    const client = createOpenAIClient();
    assert.equal(client.maxRetries, 0);
  } finally {
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = priorKey;
  }
});

test('adapter sends strict schema and validates output without a network call', async () => {
  let request;
  const fakeClient = {
    responses: {
      create: async (input) => {
        request = input;
        return { status: 'completed', output_text: JSON.stringify(validDraft) };
      },
    },
  };
  const plan = await generateTrainingPlan(plannerInput, fakeClient);
  assert.deepEqual(plan, validDraft);
  assert.equal(request.text.format, trainingPlanDraftFormat);
  assert.deepEqual(JSON.parse(request.input), JSON.parse(buildTrainingPlanInput(plannerInput)));
  assert.match(request.instructions, /sessionFocus/);
  assert.match(request.instructions, /trainingExperienceMonths/);
});

test('invalid session input is rejected before the OpenAI client is called', async () => {
  let called = false;
  await assert.rejects(
    generateTrainingPlan(
      { ...plannerInput, context: { ...plannerInput.context, trainingExperienceMonths: -1 } },
      { responses: { create: async () => { called = true; } } },
    ),
    (error) => error.code === 'INVALID_INPUT',
  );
  assert.equal(called, false);
});

test('API failure and missing output have distinct sanitized codes', async () => {
  await assert.rejects(
    generateTrainingPlan(plannerInput, { responses: { create: async () => { throw new Error('sensitive request detail'); } } }),
    (error) => error.code === 'OPENAI_API_ERROR' && !error.message.includes('sensitive'),
  );
  await assert.rejects(
    generateTrainingPlan(plannerInput, { responses: { create: async () => ({ status: 'incomplete', output_text: '' }) } }),
    (error) => error.code === 'STRUCTURED_OUTPUT_MISSING',
  );
});
