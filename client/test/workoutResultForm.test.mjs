import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { DEMO_TRAINING_PLAN } = await import('../src/demo/fixture.ts');
const { AdventureQuestProvider } = await import('../src/state/AdventureQuestContext.tsx');
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

function renderForm(result) {
  return renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    null,
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
