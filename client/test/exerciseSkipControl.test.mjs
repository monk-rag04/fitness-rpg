import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { AdventureQuestProvider } = await import('../src/state/AdventureQuestContext.tsx');
const { DEMO_ADVENTURE_SESSION } = await import('../src/state/AdventureQuestContext.tsx');
const { ExerciseSkipControl, exerciseSkipReasonLabel } = await import('../src/features/quests/ExerciseSkipControl.tsx');

test('unskipped Exercise exposes a secondary skip action without showing internal reason IDs', () => {
  const markup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    null,
    createElement(ExerciseSkipControl, { exerciseId: 'dumbbell_curl' }),
  ));
  assert.match(markup, /この種目をスキップ/);
  assert.doesNotMatch(markup, /equipment_unavailable|time_constraint|condition/);
});

test('skip reason presentation is Japanese and a skipped Exercise offers undo', () => {
  assert.equal(exerciseSkipReasonLabel('equipment_unavailable'), '器具が空いていない');
  assert.equal(exerciseSkipReasonLabel('time_constraint'), '時間が足りない');
  assert.equal(exerciseSkipReasonLabel('condition'), 'コンディションの都合');
  assert.equal(exerciseSkipReasonLabel('other'), 'その他');
  const markup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: DEMO_ADVENTURE_SESSION },
    createElement(ExerciseSkipControl, {
      exerciseId: 'dumbbell_curl',
      skipped: { exerciseId: 'dumbbell_curl', reason: 'time_constraint', pledgeAccepted: true },
    }),
  ));
  assert.match(markup, /SKIPPED/);
  assert.match(markup, /時間が足りない/);
  assert.match(markup, /スキップを取り消す/);
  assert.doesNotMatch(markup, /weightKg|reps: 0/);
});
