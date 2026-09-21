import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTrainingCandidates } from '@fitness-rpg/shared';
import { MissingOpenAIKeyError, createOpenAIClient } from '../dist/openai/client.js';
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
  assert.deepEqual(exercise.required, ['exerciseId', 'role', 'sets', 'repRange']);
  assert.equal(exercise.additionalProperties, false);
  assert.deepEqual(exercise.properties.role.enum, ['main', 'accessory']);
  assert.deepEqual(repRange.required, ['min', 'max']);
  assert.equal(repRange.additionalProperties, false);
  assert.ok(!Object.hasOwn(exercise.properties, 'weight'));
});

test('request contains only candidate result, not equipment profile', () => {
  assert.deepEqual(JSON.parse(buildTrainingPlanInput(candidates)), candidates);
  assert.ok(!buildTrainingPlanInput(candidates).includes('test-profile'));
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
    assert.throws(
      () => createOpenAIClient(),
      (error) => error instanceof MissingOpenAIKeyError && error.code === 'OPENAI_API_KEY_MISSING',
    );
  } finally {
    if (priorKey !== undefined) process.env.OPENAI_API_KEY = priorKey;
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
  const plan = await generateTrainingPlan(candidates, fakeClient);
  assert.deepEqual(plan, validDraft);
  assert.equal(request.text.format, trainingPlanDraftFormat);
  assert.deepEqual(JSON.parse(request.input), candidates);
});

test('API failure and missing output have distinct sanitized codes', async () => {
  await assert.rejects(
    generateTrainingPlan(candidates, { responses: { create: async () => { throw new Error('sensitive request detail'); } } }),
    (error) => error.code === 'OPENAI_API_ERROR' && !error.message.includes('sensitive'),
  );
  await assert.rejects(
    generateTrainingPlan(candidates, { responses: { create: async () => ({ status: 'incomplete', output_text: '' }) } }),
    (error) => error.code === 'STRUCTURED_OUTPUT_MISSING',
  );
});
