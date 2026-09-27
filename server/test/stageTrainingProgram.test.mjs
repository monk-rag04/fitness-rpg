import assert from 'node:assert/strict';
import test from 'node:test';
import { APIError } from 'openai';

import {
  buildTrainingCandidates,
  generateStageRoadmap,
  getCanonicalStageTrainingDays,
} from '@fitness-rpg/shared';
import {
  MAX_STAGE_TRAINING_PROGRAM_SESSIONS,
  createStageTrainingProgramDraftFormat,
  stageTrainingProgramDraftFormat,
} from '../dist/openai/stageTrainingProgramSchema.js';
import {
  StageTrainingProgramGenerationError,
  generateStageTrainingProgram,
} from '../dist/openai/stageTrainingProgram.js';

const equipmentProfile = {
  id: 'stage-program-test-equipment',
  displayName: 'Barbell, Dumbbell, and Bench',
  availableEquipmentIds: ['barbell', 'dumbbell', 'flat_bench'],
};

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
  return createRoadmap(6);
}

function generationInput(roadmap = createRoadmap(), overrides = {}) {
  return {
    roadmap,
    equipmentProfile,
    mainExerciseId: 'barbell_bench_press',
    currentE1rmKg: 70,
    stageTargetE1rmKg: 75,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: roadmap.trainingFrequencyPerWeek,
    ...overrides,
  };
}

function candidatesForDay(roadmap, dayIndex) {
  const day = roadmap.days[dayIndex];
  return buildTrainingCandidates({
    equipmentProfile,
    bossMainExerciseId: roadmap.mainExerciseId,
    bossMainExposure: day.bossMainExposure,
    targetMuscles: day.sessionFocus.targetMuscles,
    targetMovementPatterns: day.sessionFocus.targetMovementPatterns,
  });
}

function validPlan(roadmap, dayIndex) {
  const candidates = candidatesForDay(roadmap, dayIndex);
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

function fakeClient(output, calls) {
  return {
    responses: {
      create: async (request) => {
        calls.push(request);
        return { status: 'completed', output_text: JSON.stringify(output) };
      },
    },
  };
}

async function expectStructuredFailure(input, output) {
  await assert.rejects(
    generateStageTrainingProgram(input, fakeClient(output, [])),
    (error) => error instanceof StageTrainingProgramGenerationError &&
      error.code === 'DOMAIN_VALIDATION_FAILED',
  );
}

test('strict Stage schema has bounded sessions, Catalog IDs, and no extra fields', () => {
  const root = stageTrainingProgramDraftFormat.schema;
  const session = root.properties.sessions.items;
  const exercise = session.properties.plan.properties.exercises.items;

  assert.equal(stageTrainingProgramDraftFormat.strict, true);
  assert.equal(root.additionalProperties, false);
  assert.equal(root.properties.sessions.maxItems, MAX_STAGE_TRAINING_PROGRAM_SESSIONS);
  assert.equal(MAX_STAGE_TRAINING_PROGRAM_SESSIONS, 42);
  assert.deepEqual(session.required, ['dayIndex', 'plan']);
  assert.equal(session.additionalProperties, false);
  assert.equal(exercise.additionalProperties, false);
  assert.deepEqual(exercise.properties.role.enum, ['main', 'accessory']);
  assert.equal(exercise.properties.sets.minimum, 1);
  assert.equal(exercise.properties.sets.maximum, 5);
  assert.ok(exercise.properties.exerciseId.enum.includes('barbell_bench_press'));
  assert.ok(!Object.hasOwn(exercise.properties, 'weight'));
});

test('a valid multi-day Stage Program uses one provider operation and returns the validated program', async () => {
  const roadmap = createRoadmap();
  const calls = [];
  const program = validProgram(roadmap);
  const result = await generateStageTrainingProgram(
    generationInput(roadmap),
    fakeClient(program, calls),
  );

  assert.deepEqual(result, program);
  assert.equal(calls.length, 1);
  const prompt = JSON.parse(calls[0].input);
  const allowedIds = [...new Set(prompt.trainingDays.flatMap((day) => day.allowedExerciseIds))];
  assert.deepEqual(calls[0].text.format, createStageTrainingProgramDraftFormat(
    allowedIds,
    prompt.trainingDays.map((day) => day.dayIndex),
  ));
  assert.ok(calls[0].text.format.schema.properties.sessions.items.properties.plan.properties.exercises.items.properties.exerciseId.enum.every((id) => allowedIds.includes(id)));
  assert.match(calls[0].instructions, /coherent Training Program/);
  assert.match(calls[0].instructions, /allowedExerciseIds/);
  assert.match(calls[0].instructions, /Do not prescribe weight/);
});

test('minimal Bench and Deadlift equipment produce valid Stage candidate spaces with bodyweight fallback', async () => {
  for (const [mainExerciseId, availableEquipmentIds] of [
    ['barbell_bench_press', ['barbell', 'flat_bench']],
    ['barbell_deadlift', ['barbell', 'dumbbell']],
  ]) {
    const roadmap = generateStageRoadmap({
      startDate: '2026-09-22', durationDays: 14, trainingFrequencyPerWeek: 3,
      mainExerciseId, stageTargetE1rmKg: 75,
    });
    const minimalProfile = { id: 'minimal-test', displayName: 'Minimal', availableEquipmentIds };
    const sessions = getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => {
      const day = roadmap.days[dayIndex];
      const candidates = buildTrainingCandidates({
        equipmentProfile: minimalProfile,
        bossMainExerciseId: mainExerciseId,
        bossMainExposure: day.bossMainExposure,
        targetMuscles: day.sessionFocus.targetMuscles,
        targetMovementPatterns: day.sessionFocus.targetMovementPatterns,
      });
      const primary = candidates.mainExercise ?? candidates.candidateExercises[0];
      assert.ok(primary, `${mainExerciseId} day ${dayIndex} has a primary candidate`);
      if (day.bossMainExposure) assert.equal(primary.exerciseId, mainExerciseId);
      else assert.notEqual(primary.exerciseId, mainExerciseId);
      return { dayIndex, plan: { exercises: [{
        exerciseId: primary.exerciseId, role: 'main', sets: 3, repRange: { min: 5, max: 8 },
      }] } };
    });
    const calls = [];
    const program = { sessions };
    assert.deepEqual(await generateStageTrainingProgram(
      generationInput(roadmap, { equipmentProfile: minimalProfile, mainExerciseId }),
      fakeClient(program, calls),
    ), program);
    assert.equal(calls.length, 1);
    assert.match(calls[0].instructions, /no-equipment bodyweight/);
  }
});

test('rich Gym keeps weighted candidates in addition to bodyweight fallbacks', () => {
  const roadmap = createRoadmap();
  const day = getCanonicalStageTrainingDays(roadmap).find(({ bossMainExposure }) => !bossMainExposure);
  assert.ok(day);
  const base = {
    bossMainExerciseId: roadmap.mainExerciseId,
    bossMainExposure: false,
    targetMuscles: day.sessionFocus.targetMuscles,
    targetMovementPatterns: day.sessionFocus.targetMovementPatterns,
  };
  const minimal = buildTrainingCandidates({ ...base, equipmentProfile: {
    id: 'minimal', displayName: 'Minimal', availableEquipmentIds: ['barbell', 'flat_bench'],
  } });
  const rich = buildTrainingCandidates({ ...base, equipmentProfile: {
    id: 'rich', displayName: 'Rich', availableEquipmentIds: [
      'barbell', 'dumbbell', 'flat_bench', 'adjustable_bench', 'squat_rack',
      'power_rack', 'cable_machine', 'pullup_bar', 'smith_machine',
      'chest_press_machine', 'shoulder_press_machine', 'lat_pulldown_machine',
      'seated_row_machine', 'leg_press_machine', 'leg_extension_machine', 'leg_curl_machine',
    ],
  } });
  assert.ok(rich.candidateExercises.length > minimal.candidateExercises.length);
  assert.ok(rich.candidateExercises.some(({ exerciseId }) => exerciseId.includes('barbell') || exerciseId.includes('dumbbell')));
});

test('twelve Training Days still use exactly one provider operation', async () => {
  const roadmap = createTwelveTrainingDayRoadmap();
  const calls = [];
  const result = await generateStageTrainingProgram(
    generationInput(roadmap),
    fakeClient(validProgram(roadmap), calls),
  );

  assert.equal(result.sessions.length, 12);
  assert.equal(calls.length, 1);
});

test('prompt contains only canonical Training Days with each Day focus and candidates', async () => {
  const base = createRoadmap();
  const roadmap = {
    ...base,
    days: base.days.map((day, index) => day.type === 'training' && index === 2
      ? { ...day, sessionFocus: { targetMuscles: ['back'] } }
      : day),
  };
  const calls = [];
  await generateStageTrainingProgram(generationInput(roadmap), fakeClient(validProgram(roadmap), calls));

  const prompt = JSON.parse(calls[0].input);
  const canonical = getCanonicalStageTrainingDays(roadmap);
  assert.deepEqual(prompt.trainingDays.map((day) => day.dayIndex), canonical.map((day) => day.dayIndex));
  assert.equal(prompt.trainingDays.some((day) => day.dayIndex === 1), false);
  const backDay = prompt.trainingDays.find((day) => day.dayIndex === 2);
  assert.deepEqual(backDay.sessionFocus, { targetMuscles: ['back'] });
  assert.ok(backDay.allowedExerciseIds.includes('one_arm_dumbbell_row'));
  assert.equal(backDay.allowedExerciseIds.includes('push_up'), false);
});

test('missing, duplicate, extra, and Recovery provider sessions fail whole-Stage validation', async () => {
  const roadmap = createRoadmap();
  const input = generationInput(roadmap);
  const program = validProgram(roadmap);

  await expectStructuredFailure(input, { sessions: program.sessions.slice(1) });
  await expectStructuredFailure(input, { sessions: [program.sessions[0], program.sessions[0], ...program.sessions.slice(1)] });
  await expectStructuredFailure(input, { sessions: [...program.sessions, { dayIndex: 99, plan: validPlan(roadmap, 0) }] });
  await expectStructuredFailure(input, { sessions: [{ dayIndex: 1, plan: validPlan(roadmap, 0) }, ...program.sessions.slice(1)] });
});

test('candidate membership is checked independently for every Training Day', async () => {
  const base = createRoadmap();
  const roadmap = {
    ...base,
    days: base.days.map((day, index) => day.type === 'training' && index === 2
      ? { ...day, sessionFocus: { targetMuscles: ['back'] } }
      : day),
  };
  const program = validProgram(roadmap);
  const secondTrainingDay = getCanonicalStageTrainingDays(roadmap)[1].dayIndex;
  program.sessions.find((session) => session.dayIndex === secondTrainingDay).plan = {
    exercises: [
      validPlan(roadmap, secondTrainingDay).exercises[0],
      {
        exerciseId: 'push_up',
        role: 'accessory',
        sets: 3,
        repRange: { min: 8, max: 12 },
      },
    ],
  };

  await expectStructuredFailure(generationInput(roadmap), program);
});

test('Main requirements and D-030 guardrails are enforced by the Shared validator', async () => {
  const roadmap = createRoadmap();
  const program = validProgram(roadmap);
  const dayIndex = program.sessions[0].dayIndex;

  const missingMain = structuredClone(program);
  missingMain.sessions[0] = {
    dayIndex,
    plan: {
      exercises: [{
        exerciseId: 'push_up',
        role: 'accessory',
        sets: 3,
        repRange: { min: 8, max: 12 },
      }],
    },
  };
  await expectStructuredFailure(generationInput(roadmap), missingMain);

  const mainRoleInvalid = structuredClone(program);
  mainRoleInvalid.sessions[0].plan.exercises[0] = {
    ...mainRoleInvalid.sessions[0].plan.exercises[0],
    role: 'accessory',
  };
  await expectStructuredFailure(generationInput(roadmap), mainRoleInvalid);

  const repInvalid = structuredClone(program);
  repInvalid.sessions[0].plan.exercises[0] = {
    ...repInvalid.sessions[0].plan.exercises[0],
    repRange: { min: 11, max: 12 },
  };
  await expectStructuredFailure(generationInput(roadmap), repInvalid);

  const totalSetsInvalid = structuredClone(program);
  totalSetsInvalid.sessions[0].plan = {
    exercises: [
      totalSetsInvalid.sessions[0].plan.exercises[0],
      { exerciseId: 'push_up', role: 'accessory', sets: 5, repRange: { min: 8, max: 12 } },
      { exerciseId: 'dumbbell_bench_press', role: 'accessory', sets: 5, repRange: { min: 8, max: 12 } },
      { exerciseId: 'incline_dumbbell_press', role: 'accessory', sets: 5, repRange: { min: 8, max: 12 } },
      { exerciseId: 'chest_press_machine', role: 'accessory', sets: 5, repRange: { min: 8, max: 12 } },
    ],
  };
  await expectStructuredFailure(generationInput(roadmap), totalSetsInvalid);
});

test('malformed provider output and provider exceptions are sanitized', async () => {
  const roadmap = createRoadmap();
  const input = generationInput(roadmap);
  await assert.rejects(
    generateStageTrainingProgram(input, {
      responses: { create: async () => ({ status: 'completed', output_text: 'not JSON' }) },
    }),
    (error) => error instanceof StageTrainingProgramGenerationError &&
      error.code === 'STRUCTURED_OUTPUT_MISSING',
  );
  await assert.rejects(
    generateStageTrainingProgram(input, {
      responses: { create: async () => { throw new Error('sensitive provider detail'); } },
    }),
    (error) => error instanceof StageTrainingProgramGenerationError &&
      error.code === 'OPENAI_API_ERROR' &&
      !error.message.includes('sensitive'),
  );
});

test('an unavailable Main Exercise stops before the provider and invalid output returns no partial program', async () => {
  const roadmap = createRoadmap();
  let calls = 0;
  await assert.rejects(
    generateStageTrainingProgram(
      generationInput(roadmap, {
        equipmentProfile: { ...equipmentProfile, availableEquipmentIds: [] },
      }),
      { responses: { create: async () => { calls += 1; return { status: 'completed', output_text: '{}' }; } } },
    ),
    (error) => error instanceof StageTrainingProgramGenerationError &&
      error.code === 'MAIN_EXERCISE_UNAVAILABLE',
  );
  assert.equal(calls, 0);

  const program = validProgram(roadmap);
  program.sessions[1] = {
    ...program.sessions[1],
    plan: {
      exercises: [{
        exerciseId: 'barbell_bench_press',
        role: 'main',
        sets: 6,
        repRange: { min: 5, max: 8 },
      }],
    },
  };
  await expectStructuredFailure(generationInput(roadmap), program);
});

test('input is not mutated and invalid server context never calls the provider', async () => {
  const roadmap = createRoadmap();
  const input = generationInput(roadmap);
  const snapshot = structuredClone(input);
  const calls = [];
  await generateStageTrainingProgram(input, fakeClient(validProgram(roadmap), calls));
  assert.deepEqual(input, snapshot);

  await assert.rejects(
    generateStageTrainingProgram(
      generationInput(roadmap, { trainingFrequencyPerWeek: 8 }),
      { responses: { create: async () => { calls.push('invalid'); } } },
    ),
    (error) => error instanceof StageTrainingProgramGenerationError && error.code === 'INVALID_INPUT',
  );
  assert.equal(calls.includes('invalid'), false);
});

test('preflight rejects a Training Day with no allowed candidates before a Provider call', async () => {
  const base = createRoadmap();
  const targetDay = getCanonicalStageTrainingDays(base).find((day) => !day.bossMainExposure);
  assert.ok(targetDay);
  const roadmap = {
    ...base,
    days: base.days.map((day, index) => index === targetDay.dayIndex
      ? { ...day, sessionFocus: { targetMuscles: [], targetMovementPatterns: [] } }
      : day),
  };
  let calls = 0;
  await assert.rejects(
    generateStageTrainingProgram(generationInput(roadmap), {
      responses: { create: async () => { calls += 1; return { status: 'completed', output_text: '{}' }; } },
    }),
    (error) => error instanceof StageTrainingProgramGenerationError &&
      error.code === 'NO_VALID_CANDIDATES' &&
      error.details.category === 'NO_VALID_CANDIDATES' &&
      error.details.reasons[0].dayIndex === targetDay.dayIndex,
  );
  assert.equal(calls, 0);
});

test('a Domain validation failure gets one complete repair attempt with bounded reason context', async () => {
  const roadmap = createRoadmap();
  const calls = [];
  const invalid = structuredClone(validProgram(roadmap));
  invalid.sessions[0].plan.exercises[0].sets = 0;
  const valid = validProgram(roadmap);
  let responseIndex = 0;
  const client = {
    responses: {
      create: async (request) => {
        calls.push(request);
        const output = responseIndex++ === 0 ? invalid : valid;
        return { status: 'completed', output_text: JSON.stringify(output) };
      },
    },
  };

  assert.deepEqual(await generateStageTrainingProgram(generationInput(roadmap), client), valid);
  assert.equal(calls.length, 2);
  const repairedInput = JSON.parse(calls[1].input);
  assert.equal(repairedInput.previousDraftRejected[0].reasonCode, 'INVALID_SET_COUNT');
  assert.equal(repairedInput.previousDraftRejected[0].dayIndex, valid.sessions[0].dayIndex);
  assert.equal(repairedInput.previousDraftRejected[0].exerciseId, valid.sessions[0].plan.exercises[0].exerciseId);
  assert.match(calls[1].instructions, /Regenerate the complete Stage Program/);
  assert.match(calls[1].instructions, /requiredMainExerciseId values unchanged/);
  assert.equal(JSON.stringify(calls[1]).includes('stack'), false);
  assert.equal(JSON.stringify(calls[1]).includes('api_key'), false);
});

test('two invalid Stage drafts stop after two Provider attempts and return no partial Program', async () => {
  const roadmap = createRoadmap();
  const invalid = structuredClone(validProgram(roadmap));
  invalid.sessions.pop();
  const calls = [];
  await assert.rejects(
    generateStageTrainingProgram(generationInput(roadmap), fakeClient(invalid, calls)),
    (error) => error instanceof StageTrainingProgramGenerationError &&
      error.code === 'DOMAIN_VALIDATION_FAILED' &&
      error.details.category === 'STAGE_COVERAGE' &&
      error.details.attempt === 2,
  );
  assert.equal(calls.length, 2);
});

test('malformed Structured Output receives one repair attempt', async () => {
  const roadmap = createRoadmap();
  const calls = [];
  const program = validProgram(roadmap);
  const client = {
    responses: {
      create: async (request) => {
        calls.push(request);
        return calls.length === 1
          ? { status: 'completed', output_text: '{invalid json' }
          : { status: 'completed', output_text: JSON.stringify(program) };
      },
    },
  };
  assert.deepEqual(await generateStageTrainingProgram(generationInput(roadmap), client), program);
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].input).previousDraftRejected[0].reasonCode, 'STRUCTURED_OUTPUT_INVALID');
});

test('transient Provider failures retry once while non-retryable failures do not retry', async () => {
  const roadmap = createRoadmap();
  const program = validProgram(roadmap);
  const transientCalls = [];
  const transientClient = {
    responses: {
      create: async (request) => {
        transientCalls.push(request);
        if (transientCalls.length === 1) throw new APIError(503, { message: 'sensitive provider body' }, 'temporary', new Headers());
        return { status: 'completed', output_text: JSON.stringify(program) };
      },
    },
  };
  assert.deepEqual(await generateStageTrainingProgram(generationInput(roadmap), transientClient), program);
  assert.equal(transientCalls.length, 2);
  assert.equal(JSON.parse(transientCalls[1].input).previousDraftRejected, undefined);

  const nonRetryCalls = [];
  const nonRetryClient = {
    responses: {
      create: async () => {
        nonRetryCalls.push(true);
        throw new APIError(401, { message: 'sensitive auth body' }, 'invalid key', new Headers());
      },
    },
  };
  await assert.rejects(
    generateStageTrainingProgram(generationInput(roadmap), nonRetryClient),
    (error) => error instanceof StageTrainingProgramGenerationError &&
      error.code === 'OPENAI_API_ERROR' &&
      error.details.category === 'NON_RETRYABLE_PROVIDER' &&
      !error.message.includes('sensitive'),
  );
  assert.equal(nonRetryCalls.length, 1);
});
