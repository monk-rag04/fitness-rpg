import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  generateStageRoadmap,
  getCanonicalStageTrainingDays,
} from '@fitness-rpg/shared';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');

const {
  createStageProgramGenerationController,
  createStageTrainingProgramInput,
} = await import('../src/features/equipment/stageProgramGeneration.ts');
const { equipmentDraftFromEquipmentIds } = await import('../src/features/equipment/equipmentDraft.ts');
const {
  AdventureQuestProvider,
  createOnboardingAdventureSession,
} = await import('../src/state/AdventureQuestContext.tsx');
const { setStageEquipmentProfile, cacheTrainingPlanForDay } = await import('../src/state/adventureSession.ts');
const { CurrentQuest } = await import('../src/features/quests/CurrentQuest.tsx');
const { DEMO_TRAINING_PLAN } = await import('../src/demo/fixture.ts');

function createRoadmap() {
  return generateStageRoadmap({
    startDate: '2026-09-22',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
  });
}

function createProgram(roadmap) {
  return {
    sessions: getCanonicalStageTrainingDays(roadmap).map(({ dayIndex }) => ({
      dayIndex,
      plan: DEMO_TRAINING_PLAN,
    })),
  };
}

function createSession(roadmap = createRoadmap()) {
  return createOnboardingAdventureSession({
    roadmap,
    initialProgress: { currentDayIndex: 0 },
    stageTrainingProgramContext: {
      mainExerciseId: 'barbell_bench_press',
      currentE1rmKg: 70,
      trainingExperienceMonths: 8,
      trainingFrequencyPerWeek: roadmap.trainingFrequencyPerWeek,
    },
  });
}

function createInput(roadmap, equipmentIds) {
  return createStageTrainingProgramInput({
    mainExerciseId: 'barbell_bench_press',
    currentE1rmKg: 70,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: roadmap.trainingFrequencyPerWeek,
  }, roadmap, equipmentIds);
}

function createHarness({ request, cacheStatus = 'cached', profileStatus = 'set' } = {}) {
  const roadmap = createRoadmap();
  const calls = [];
  const profileWrites = [];
  const cacheWrites = [];
  const states = [];
  let readyCalls = 0;
  const controller = createStageProgramGenerationController({
    getRequestInput: (equipmentIds) => createInput(roadmap, equipmentIds),
    setStageEquipmentProfile: (equipmentIds) => {
      profileWrites.push(equipmentIds);
      return profileStatus;
    },
    requestStageTrainingProgram: async (input) => {
      calls.push(input);
      return request === undefined
        ? { status: 'stage_training_program_ready', program: createProgram(roadmap) }
        : request(input);
    },
    cacheStageTrainingProgram: (program) => {
      cacheWrites.push(program);
      return cacheStatus;
    },
    onStateChange: (state) => states.push(state),
    onProgramReady: () => { readyCalls += 1; },
  });
  return { roadmap, controller, calls, profileWrites, cacheWrites, states, get readyCalls() { return readyCalls; } };
}

test('pending Production Training Quest renders Equipment Check at 0 SELECTED', () => {
  const session = createSession();
  const markup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session },
    createElement(CurrentQuest),
  ));

  assert.match(markup, /EQUIPMENT CHECK/);
  assert.match(markup, /0件 選択中/);
  assert.match(markup, /disabled=""/);
  assert.doesNotMatch(markup, /Training Planを準備中/);
});

test('a saved Equipment Profile pre-fills Equipment Check, including explicit no-equipment', () => {
  const session = createSession();
  const selected = setStageEquipmentProfile(session, ['flat_bench', 'barbell']);
  const selectedMarkup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: selected.target },
    createElement(CurrentQuest),
  ));
  assert.match(selectedMarkup, /2件 選択中/);
  assert.equal((selectedMarkup.match(/aria-pressed="true"/g) ?? []).length, 2);

  const noEquipment = setStageEquipmentProfile(session, []);
  const noEquipmentMarkup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: noEquipment.target },
    createElement(CurrentQuest),
  ));
  assert.match(noEquipmentMarkup, /1件 選択中/);
  assert.match(noEquipmentMarkup, /器具なし/);
  assert.equal((noEquipmentMarkup.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.deepEqual(equipmentDraftFromEquipmentIds(undefined), { kind: 'unselected' });
  assert.deepEqual(equipmentDraftFromEquipmentIds([]), { kind: 'no_equipment' });
});

test('a saved current-day Plan bypasses Equipment Check and Recovery remains unchanged', () => {
  const session = createSession();
  const cached = cacheTrainingPlanForDay(session.roadmap, {}, 0, DEMO_TRAINING_PLAN);
  const plannedSession = { ...session, planByDay: cached.planByDay };
  const plannedMarkup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: plannedSession },
    createElement(CurrentQuest),
  ));
  assert.match(plannedMarkup, /今日のトレーニングを完了せよ/);
  assert.doesNotMatch(plannedMarkup, /EQUIPMENT CHECK/);

  const recoverySession = { ...session, initialProgress: { currentDayIndex: 1 } };
  const recoveryMarkup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: recoverySession },
    createElement(CurrentQuest),
  ));
  assert.match(recoveryMarkup, /正しく身体を休ませよ/);
  assert.doesNotMatch(recoveryMarkup, /EQUIPMENT CHECK/);
});

test('one explicit selection writes the chosen Equipment IDs and requests one Stage Program', async () => {
  const harness = createHarness();
  await harness.controller.submit(['barbell', 'flat_bench']);

  assert.deepEqual(harness.profileWrites, [['barbell', 'flat_bench']]);
  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.calls[0].equipmentIds, ['barbell', 'flat_bench']);
  assert.equal(harness.calls[0].stageTargetE1rmKg, 75);
  assert.equal(harness.cacheWrites.length, 1);
  assert.deepEqual(harness.states, ['generating']);
  assert.equal(harness.readyCalls, 1);
});

test('explicit no-equipment is sent as an empty Profile, not an unselected draft', async () => {
  const harness = createHarness();
  await harness.controller.submit([]);
  assert.deepEqual(harness.profileWrites, [[]]);
  assert.deepEqual(harness.calls[0].equipmentIds, []);
  assert.equal(harness.readyCalls, 1);
});

test('main unavailable preserves the empty cache path and a later selection uses new Equipment', async () => {
  let call = 0;
  const harness = createHarness({
    request: async () => {
      call += 1;
      return call === 1
        ? { status: 'stage_training_program_request_failed', code: 'main_exercise_unavailable' }
        : { status: 'stage_training_program_ready', program: createProgram(harness.roadmap) };
    },
  });

  await harness.controller.submit(['dumbbell']);
  assert.deepEqual(harness.states, ['generating', 'main_equipment_missing']);
  assert.equal(harness.cacheWrites.length, 0);

  await harness.controller.submit(['barbell', 'flat_bench']);
  assert.deepEqual(harness.calls.map((input) => input.equipmentIds), [
    ['dumbbell'],
    ['barbell', 'flat_bench'],
  ]);
  assert.equal(harness.cacheWrites.length, 1);
});

test('generic failures do not retry automatically and an explicit retry is a second request', async () => {
  const harness = createHarness({
    request: async () => ({ status: 'stage_training_program_request_failed', code: 'provider_failure' }),
  });
  await harness.controller.submit(['barbell', 'flat_bench']);
  assert.deepEqual(harness.states, ['generating', 'error']);
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.cacheWrites.length, 0);

  await harness.controller.submit(['barbell', 'flat_bench']);
  assert.equal(harness.calls.length, 2);
  assert.deepEqual(harness.states, ['generating', 'error', 'generating', 'error']);
});

test('a cancelled late success cannot cache and a new attempt remains authoritative', async () => {
  let resolveFirst;
  let requestCount = 0;
  const harness = createHarness({
    request: () => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve({ status: 'stage_training_program_ready', program: createProgram(harness.roadmap) });
    },
  });

  const first = harness.controller.submit(['barbell']);
  assert.equal(harness.controller.isInFlight, true);
  harness.controller.cancelActiveAttempt();
  resolveFirst({ status: 'stage_training_program_ready', program: createProgram(harness.roadmap) });
  await first;
  assert.equal(harness.cacheWrites.length, 0);

  await harness.controller.submit(['barbell', 'flat_bench']);
  assert.equal(requestCount, 2);
  assert.equal(harness.cacheWrites.length, 1);
  assert.equal(harness.readyCalls, 1);
});

test('double submit keeps one concurrent request', async () => {
  let resolveRequest;
  const harness = createHarness({
    request: () => new Promise((resolve) => { resolveRequest = resolve; }),
  });
  const first = harness.controller.submit(['barbell', 'flat_bench']);
  const second = harness.controller.submit(['barbell', 'flat_bench']);
  assert.equal(harness.calls.length, 1);

  resolveRequest({ status: 'stage_training_program_ready', program: createProgram(harness.roadmap) });
  await Promise.all([first, second]);
  assert.equal(harness.cacheWrites.length, 1);
  assert.equal(harness.readyCalls, 1);
});

test('StrictMode effect cleanup cancels the attempt without permanently disposing the controller', async () => {
  let resolveFirst;
  let requestCount = 0;
  const harness = createHarness({
    request: () => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve({ status: 'stage_training_program_ready', program: createProgram(harness.roadmap) });
    },
  });

  // React StrictMode runs an effect cleanup before the second setup in
  // development. The component cleanup uses this non-terminal operation.
  const first = harness.controller.submit(['barbell', 'flat_bench']);
  assert.equal(harness.controller.isInFlight, true);
  harness.controller.cancelActiveAttempt();
  resolveFirst({ status: 'stage_training_program_ready', program: createProgram(harness.roadmap) });
  await first;

  assert.equal(harness.cacheWrites.length, 0);
  await harness.controller.submit(['barbell', 'flat_bench']);

  assert.equal(harness.profileWrites.length, 2);
  assert.equal(harness.calls.length, 2);
  assert.equal(harness.cacheWrites.length, 1);
  assert.equal(harness.readyCalls, 1);
});

test('missing session context and cache failure never request or expose a partial Program', async () => {
  const noContextStates = [];
  let profileWrites = 0;
  let requests = 0;
  const noContext = createStageProgramGenerationController({
    getRequestInput: () => null,
    setStageEquipmentProfile: () => { profileWrites += 1; return 'set'; },
    requestStageTrainingProgram: async () => { requests += 1; return { status: 'stage_training_program_request_failed', code: 'internal_error' }; },
    cacheStageTrainingProgram: () => 'cached',
    onStateChange: (state) => noContextStates.push(state),
    onProgramReady: () => {},
  });
  await noContext.submit(['barbell']);
  assert.equal(profileWrites, 0);
  assert.equal(requests, 0);
  assert.deepEqual(noContextStates, ['error']);

  const cacheFailure = createHarness({ cacheStatus: 'invalid_stage_program' });
  await cacheFailure.controller.submit(['barbell', 'flat_bench']);
  assert.deepEqual(cacheFailure.states, ['generating', 'error']);
  assert.equal(cacheFailure.readyCalls, 0);
});

test('Current Training and Recovery quests show the reschedule action while Boss does not', () => {
  const roadmap = createRoadmap();
  const markupAt = (currentDayIndex) => {
    const node = roadmap.days[currentDayIndex];
    const baseSession = createOnboardingAdventureSession({
      roadmap,
      initialProgress: { currentDayIndex },
    });
    const session = {
      ...baseSession,
      planByDay: node?.type === 'training' ? { [currentDayIndex]: DEMO_TRAINING_PLAN } : {},
    };
    return renderToStaticMarkup(createElement(
      AdventureQuestProvider,
      { session },
      createElement(CurrentQuest),
    ));
  };

  const trainingIndex = roadmap.days.findIndex((day) => day.type === 'training');
  const recoveryIndex = roadmap.days.findIndex((day) => day.type === 'recovery');
  assert.match(markupAt(trainingIndex), /日程を変更/);
  assert.match(markupAt(recoveryIndex), /日程を変更/);
  assert.doesNotMatch(markupAt(roadmap.days.length), /日程を変更/);
});
