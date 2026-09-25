import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { DEMO_TRAINING_PLAN } = await import('../src/demo/fixture.ts');
const { AdventureQuestProvider, DEMO_ADVENTURE_SESSION } = await import('../src/state/AdventureQuestContext.tsx');
const { EXERCISE_PROGRESSION_RULE_VERSION } = await import('@fitness-rpg/shared');
const { weightEntryHint } = await import('../src/presentation/trainingLabels.ts');
const {
  WorkoutResultForm,
  createWorkoutResultInput,
  toggleDifficultyFeedback,
} = await import('../src/features/quests/WorkoutResultForm.tsx');

const plan = DEMO_TRAINING_PLAN.exercises[0];
const feedbackLabels = ['きつすぎた', 'ちょうどいい', '余裕あり'];

function existingResult(difficultyFeedback) {
  return {
    plannedExerciseId: plan.exerciseId,
    performedExerciseId: 'dumbbell_bench_press',
    role: plan.role,
    plannedSets: plan.sets,
    plannedRepRange: plan.repRange,
    completedSets: [{ setNumber: 1, weightKg: 20, reps: 8 }],
    ...(difficultyFeedback === undefined ? {} : { difficultyFeedback }),
    performedAt: '2026-09-24T10:00:00.000Z',
  };
}

function renderForm(result, exerciseProgressById) {
  const session = exerciseProgressById === undefined
    ? undefined
    : { ...DEMO_ADVENTURE_SESSION, exerciseProgressById };
  return renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    session === undefined ? null : { session },
    createElement(WorkoutResultForm, {
      plan,
      exerciseName: 'テスト種目',
      existingResult: result,
    }),
  ));
}

test('feedback choices, optional hint, and unselected submit are rendered', () => {
  const markup = renderForm(undefined);
  for (const label of feedbackLabels) assert.ok(markup.includes(label));
  assert.match(markup, /今回の負荷は？/);
  assert.match(markup, /任意/);
  assert.match(markup, /未選択でも記録・QUEST CLEARできます。/);
  assert.equal((markup.match(/aria-pressed="false"/g) ?? []).length, 3);
  assert.match(markup, /class="quest-record-button" type="submit">記録する/);
});

test('initial and baseline suggestions are hints and never prefill actual Result inputs', () => {
  const emptyMarkup = renderForm(undefined);
  assert.match(emptyMarkup, /今回の目安/);
  assert.match(emptyMarkup, /重量：未設定　回数：8回/);
  assert.match(emptyMarkup, /初回は無理のない重量から始めてください。/);
  assert.match(emptyMarkup, /value=""/);

  const baselineProgress = {
    [plan.exerciseId]: {
      exerciseId: plan.exerciseId,
      baseline: { weightKg: 60, reps: 8, source: 'onboarding', capturedDayIndex: 0 },
      sessionsCompleted: 0,
    },
  };
  const baselineMarkup = renderForm(undefined, baselineProgress);
  assert.match(baselineMarkup, /60kg × 8回/);
  assert.doesNotMatch(baselineMarkup, /value="60"/);
  assert.doesNotMatch(baselineMarkup, /value="8"/);
});

test('progressed suggestion renders text without a preview selector or synthetic input defaults', () => {
  const progressed = {
    [plan.exerciseId]: {
      exerciseId: plan.exerciseId,
      sessionsCompleted: 1,
      nextSuggestion: {
        weightKg: 60,
        targetReps: 9,
        repRange: plan.repRange,
        status: 'active',
        ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
      },
    },
  };
  const markup = renderForm(undefined, progressed);
  assert.match(markup, /60kg × 9回/);
  assert.doesNotMatch(markup, /Adaptive —/);
  assert.doesNotMatch(markup, /value="60"/);
});

test('weight-up ready shows a user-configurable load step and the action is not a quest blocker', () => {
  const ready = {
    [plan.exerciseId]: {
      exerciseId: plan.exerciseId,
      sessionsCompleted: 2,
      nextSuggestion: {
        weightKg: 60,
        targetReps: plan.repRange.max,
        repRange: plan.repRange,
        status: 'weight_up_ready',
        ruleVersion: EXERCISE_PROGRESSION_RULE_VERSION,
      },
    },
  };
  const markup = renderForm(undefined, ready);
  assert.match(markup, /WEIGHT UP READY/);
  assert.match(markup, /重量UPのタイミングです/);
  assert.match(markup, /この器具の重量刻み/);
  assert.match(markup, /この刻みを使う/);
  assert.match(markup, /class="quest-record-button" type="submit">記録する/);
  assert.doesNotMatch(markup, /value="60"/);
});

test('bodyweight renders reps-only input, suggestion, and helper copy', () => {
  const pushUpPlan = {
    ...plan,
    exerciseId: 'push_up',
    repRange: { min: 8, max: 12 },
  };
  const markup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    null,
    createElement(WorkoutResultForm, {
      plan: pushUpPlan,
      exerciseName: 'プッシュアップ',
    }),
  ));
  assert.match(markup, /今回の目安/);
  assert.match(markup, />8回</);
  assert.match(markup, /自重種目は回数を記録します。/);
  assert.match(markup, /push_up-set-1-reps/);
  assert.doesNotMatch(markup, /push_up-set-1-weight/);
  assert.match(markup, /今回の負荷は？/);
});

test('weight convention helper is conservative and leaves ambiguous exercises unlabelled', () => {
  assert.equal(weightEntryHint('barbell_bench_press'), 'バーを含む総重量');
  assert.equal(weightEntryHint('dumbbell_curl'), 'ダンベル1個あたりの重量');
  assert.equal(weightEntryHint('cable_chest_fly'), 'その機械で設定した表示重量');
  assert.equal(weightEntryHint('standing_calf_raise'), undefined);
  assert.equal(weightEntryHint('goblet_squat'), undefined);
});

test('editing an existing result restores exactly its selected feedback', () => {
  for (const selected of ['too_hard', 'just_right', 'easy']) {
    const markup = renderForm(existingResult(selected));
    assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 1);
    assert.equal((markup.match(/aria-pressed="false"/g) ?? []).length, 2);
  }
  assert.equal((renderForm(existingResult(undefined)).match(/aria-pressed="true"/g) ?? []).length, 0);
});

test('feedback buttons select one option and the active choice can return to unselected', () => {
  assert.equal(toggleDifficultyFeedback(undefined, 'too_hard'), 'too_hard');
  assert.equal(toggleDifficultyFeedback('too_hard', 'just_right'), 'just_right');
  assert.equal(toggleDifficultyFeedback('easy', 'easy'), undefined);
});

test('saved result input keeps substitution identity and omits cleared feedback', () => {
  const result = createWorkoutResultInput(
    plan,
    [{ setNumber: 1, weightKg: 22, reps: 9 }],
    existingResult('just_right'),
    'easy',
    '2026-09-24T10:05:00.000Z',
  );
  assert.equal(result.plannedExerciseId, plan.exerciseId);
  assert.equal(result.performedExerciseId, 'dumbbell_bench_press');
  assert.equal(result.difficultyFeedback, 'easy');
  assert.deepEqual(result.completedSets, [{ setNumber: 1, weightKg: 22, reps: 9 }]);

  const cleared = createWorkoutResultInput(
    plan,
    [{ setNumber: 1, weightKg: 22, reps: 9 }],
    existingResult('just_right'),
    undefined,
    '2026-09-24T10:06:00.000Z',
  );
  assert.equal(Object.hasOwn(cleared, 'difficultyFeedback'), false);
});
