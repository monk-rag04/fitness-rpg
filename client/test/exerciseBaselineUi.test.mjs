import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const {
  createInitialStageProgress,
  generateStageRoadmap,
  registerSelfReportedExerciseBaseline,
} = await import('@fitness-rpg/shared');
const { DEMO_TRAINING_PLAN } = await import('../src/demo/fixture.ts');
const { TrainingQuest } = await import('../src/features/quests/TrainingQuest.tsx');
const {
  ExerciseBaselineSetup,
  exerciseBaselineRegistrationErrorMessage,
} = await import('../src/features/quests/ExerciseBaselineSetup.tsx');
const { AdventureQuestProvider } = await import('../src/state/AdventureQuestContext.tsx');
const { createOnboardingAdventureSession } = await import('../src/state/adventureSession.ts');

function createSession(exerciseProgressById = {}) {
  const roadmap = generateStageRoadmap({
    startDate: '2026-09-24',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 75,
  });
  const base = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
    stageTrainingProgramContext: {
      mainExerciseId: 'barbell_bench_press',
      currentE1rmKg: 60,
      trainingExperienceMonths: 12,
      trainingFrequencyPerWeek: 3,
    },
    onboardingBaseline: { exerciseId: 'barbell_bench_press', weightKg: 50, reps: 5 },
  });
  return {
    ...base,
    exerciseProgressById: { ...base.exerciseProgressById, ...exerciseProgressById },
    planByDay: { 0: DEMO_TRAINING_PLAN },
  };
}

function renderTrainingQuest(session) {
  return renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session },
    createElement(TrainingQuest),
  ));
}

function renderSetup(props = {}) {
  return renderToStaticMarkup(createElement(ExerciseBaselineSetup, {
    mode: 'choose',
    selfReportSupported: true,
    onModeChange: () => {},
    registerBaseline: () => 'registered',
    onConfirmFirstTime: () => {},
    ...props,
  }));
}

test('Production Training Quest omits setup for Onboarding Main and shows it for unset accessories', () => {
  const markup = renderTrainingQuest(createSession());

  assert.match(markup, /バーベルベンチプレス/);
  assert.equal((markup.match(/aria-label="Baseline初回設定"/g) ?? []).length, 2);
  assert.match(markup, /経験あり/);
  assert.match(markup, /初めて/);
  assert.doesNotMatch(markup, /placeholder="例：/);
});

test('a baseline-set accessory hides only its first-time setup panel', () => {
  const registration = registerSelfReportedExerciseBaseline({}, {
    exerciseId: 'dumbbell_bench_press',
    weightKg: 12,
    reps: 8,
    capturedDayIndex: 0,
  });
  assert.equal(registration.valid, true);

  const markup = renderTrainingQuest(createSession(registration.exerciseProgressById));
  assert.equal((markup.match(/aria-label="Baseline初回設定"/g) ?? []).length, 1);
});

test('experienced mode renders blank weight/reps fields and the self-report CTA', () => {
  const markup = renderSetup({ mode: 'experienced' });

  assert.match(markup, /最近の無理なく再現できる記録を入力してください/);
  assert.match(markup, /aria-label="最近扱った重量 kg"/);
  assert.match(markup, /aria-label="その重量でできる回数 reps"/);
  assert.match(markup, /この記録を設定する/);
  assert.match(markup, /value=""/);
  assert.doesNotMatch(markup, /weightKg|exerciseId|INVALID_BASELINE/);
});

test('first-time mode keeps its baseline unset and offers only the proceed action', () => {
  let confirmed = 0;
  const markup = renderSetup({ onConfirmFirstTime: () => { confirmed += 1; }, mode: 'first_time' });

  assert.match(markup, /最初のトレーニング結果から、次回以降の目安を作ります/);
  assert.match(markup, /この設定で進む/);
  assert.doesNotMatch(markup, /最近扱った重量|type="number"/);
  assert.equal(confirmed, 0);
});

test('Catalog bodyweight IDs default to first-time without kg self-report controls', () => {
  const markup = renderSetup({ mode: 'first_time', selfReportSupported: false });

  assert.match(markup, /最初のトレーニング結果から目安を作ります/);
  assert.match(markup, /この設定で進む/);
  assert.doesNotMatch(markup, /経験あり|type="number"|kg/);
});

test('baseline validation errors are Japanese presentation copy, not internal field or error names', () => {
  for (const [code, expected] of [
    ['invalid_baseline_weight', '重量は0より大きい数値で入力してください。'],
    ['invalid_baseline_reps', '回数は1以上の整数で入力してください。'],
    ['baseline_already_set', 'この種目のBaselineはすでに設定されています。'],
  ]) {
    const message = exerciseBaselineRegistrationErrorMessage(code);
    assert.equal(message, expected);
    assert.doesNotMatch(message, /weightKg|reps|exerciseId|INVALID_|invalid_baseline/);
  }
});
