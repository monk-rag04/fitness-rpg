import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EQUIPMENT_CATALOG } from '@fitness-rpg/shared';
import { equipmentLabel } from '../src/presentation/trainingLabels.ts';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');
const {
  EquipmentCheckView,
  EquipmentCheckContent,
  StageProgramGeneratingView,
  StageProgramErrorView,
  StageProgramEquipmentConstraintView,
  MainEquipmentMissingView,
} = await import('../src/features/equipment/EquipmentFlow.tsx');
const {
  INITIAL_EQUIPMENT_DRAFT,
  equipmentIdsForSubmission,
  selectedChoiceCount,
  submitEquipmentDraft,
  toggleEquipment,
  toggleNoEquipment,
} = await import('../src/features/equipment/equipmentDraft.ts');

function buttonsIn(node) {
  if (Array.isArray(node)) return node.flatMap(buttonsIn);
  if (node === null || typeof node !== 'object' || !('type' in node)) return [];
  if (typeof node.type === 'function') return buttonsIn(node.type(node.props));
  return [...(node.type === 'button' ? [node] : []), ...buttonsIn(node.props.children)];
}

function buttonText(node) {
  if (Array.isArray(node)) return node.map(buttonText).join('');
  if (node === null || node === undefined) return '';
  if (typeof node !== 'object') return String(node);
  return buttonText(node.props.children);
}

const baseProps = {
  mainExerciseId: 'barbell_bench_press',
  onDraftChange: () => {},
  onBack: () => {},
  onSubmit: () => {},
};

test('Equipment Check starts with zero basic equipment and a disabled CTA', () => {
  const markup = renderToStaticMarkup(createElement(EquipmentCheckView, baseProps));
  assert.match(markup, /基本器具/);
  assert.match(markup, /追加器具（任意）/);
  assert.match(markup, /0 \/ 2 選択済み/);
  assert.match(markup, /自重トレーニングは常に利用できます/);
  assert.match(markup, /メイン種目に必要/);
  assert.equal((markup.match(/aria-pressed="false"/g) ?? []).length, EQUIPMENT_CATALOG.length);
  assert.match(markup, /disabled=""/);
  assert.doesNotMatch(markup, /<button[^>]*>器具なし<\/button>/);
  for (const equipment of EQUIPMENT_CATALOG) {
    assert.ok(markup.includes(equipmentLabel(equipment.id)));
    assert.equal(markup.includes(equipment.displayName), false);
  }
  assert.equal(INITIAL_EQUIPMENT_DRAFT.kind, 'unselected');
  assert.equal(equipmentIdsForSubmission(INITIAL_EQUIPMENT_DRAFT), null);
});

test('Equipment cards toggle independently and preserve legacy no-equipment draft compatibility', () => {
  const first = toggleEquipment(INITIAL_EQUIPMENT_DRAFT, 'barbell');
  const second = toggleEquipment(first, 'dumbbell');
  assert.deepEqual(equipmentIdsForSubmission(first), ['barbell']);
  assert.deepEqual(equipmentIdsForSubmission(second), ['barbell', 'dumbbell']);
  assert.equal(selectedChoiceCount(second), 2);
  assert.notEqual(selectedChoiceCount(second), EQUIPMENT_CATALOG.length);
  assert.deepEqual(toggleEquipment(second, 'barbell'), { kind: 'equipment', equipmentIds: ['dumbbell'] });
  assert.equal(toggleEquipment(first, 'barbell').kind, 'unselected');

  const noEquipment = toggleNoEquipment(first);
  assert.equal(noEquipment.kind, 'no_equipment');
  assert.deepEqual(equipmentIdsForSubmission(noEquipment), []);
  assert.deepEqual(equipmentIdsForSubmission(toggleEquipment(noEquipment, 'dumbbell')), ['dumbbell']);
});

test('only two basic choices with Main requirements enable submit; optional choices are not required', () => {
  const one = toggleEquipment(INITIAL_EQUIPMENT_DRAFT, 'barbell');
  const oneMarkup = renderToStaticMarkup(createElement(EquipmentCheckContent, { ...baseProps, draft: one }));
  assert.match(oneMarkup, /1 \/ 2 選択済み/);
  assert.match(oneMarkup, /disabled=""/);

  const missingMain = toggleEquipment(one, 'dumbbell');
  const missingMarkup = renderToStaticMarkup(createElement(EquipmentCheckContent, { ...baseProps, draft: missingMain }));
  assert.match(missingMarkup, /2 \/ 2 選択済み/);
  assert.match(missingMarkup, /フラットベンチ/);
  assert.match(missingMarkup, /disabled=""/);

  const ready = toggleEquipment(one, 'flat_bench');
  const readyMarkup = renderToStaticMarkup(createElement(EquipmentCheckContent, { ...baseProps, draft: ready }));
  assert.match(readyMarkup, /2 \/ 2 選択済み/);
  assert.equal((readyMarkup.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.doesNotMatch(readyMarkup, /disabled=""/);
  assert.match(readyMarkup, /メイン種目に必要/);
});

test('Equipment Check buttons submit only the available selected IDs', () => {
  const drafts = [];
  const submissions = [];
  const props = {
    ...baseProps,
    onDraftChange: (draft) => drafts.push(draft),
    onSubmit: (ids) => submissions.push(ids),
  };
  let buttons = buttonsIn(EquipmentCheckContent({ ...props, draft: INITIAL_EQUIPMENT_DRAFT }));
  buttons.find((button) => buttonText(button).includes('バーベル')).props.onClick();
  assert.deepEqual(equipmentIdsForSubmission(drafts[0]), ['barbell']);
  buttons = buttonsIn(EquipmentCheckContent({ ...props, draft: drafts[0] }));
  buttons.find((button) => buttonText(button).includes('フラットベンチ')).props.onClick();
  assert.deepEqual(equipmentIdsForSubmission(drafts[1]), ['barbell', 'flat_bench']);
  buttons = buttonsIn(EquipmentCheckContent({ ...props, draft: drafts[1] }));
  buttons.find((button) => buttonText(button) === 'この装備でクエストを生成').props.onClick();
  assert.deepEqual(submissions, [['barbell', 'flat_bench']]);
  assert.equal(submitEquipmentDraft(INITIAL_EQUIPMENT_DRAFT, props.onSubmit), false);
});

test('Generating view has no automatic transition', () => {
  let backCalls = 0;
  const element = StageProgramGeneratingView({ onBack: () => { backCalls++; } });
  const markup = renderToStaticMarkup(element);
  assert.match(markup, /STAGE PROGRAM GENERATING/);
  assert.match(markup, /編成しています/);
  assert.equal(backCalls, 0);
});

test('Error view exposes explicit retry and Map callbacks without automatic retry', () => {
  let retryCalls = 0;
  let backCalls = 0;
  const element = StageProgramErrorView({ onRetry: () => { retryCalls++; }, onBack: () => { backCalls++; } });
  assert.match(renderToStaticMarkup(element), /PROGRAM GENERATION FAILED/);
  assert.deepEqual([retryCalls, backCalls], [0, 0]);
  const buttons = buttonsIn(element);
  buttons.find((button) => buttonText(button) === 'もう一度試す').props.onClick();
  buttons.find((button) => buttonText(button) === 'Adventure Mapへ戻る').props.onClick();
  assert.deepEqual([retryCalls, backCalls], [1, 1]);
});

test('Main Missing view displays the exercise and leaves choices to callbacks', () => {
  let reselectCalls = 0;
  let changeMainCalls = 0;
  const element = MainEquipmentMissingView({
    mainExerciseName: 'バーベルベンチプレス',
    onReselectEquipment: () => { reselectCalls++; },
    onChangeMainStrength: () => { changeMainCalls++; },
  });
  const markup = renderToStaticMarkup(element);
  assert.match(markup, /MAIN EQUIPMENT MISSING/);
  assert.match(markup, /<h2>バーベルベンチプレス<\/h2>/);
  assert.deepEqual([reselectCalls, changeMainCalls], [0, 0]);
  const buttons = buttonsIn(element);
  buttons.find((button) => buttonText(button) === '装備を選び直す').props.onClick();
  buttons.find((button) => buttonText(button) === 'Main Strengthを変更する').props.onClick();
  assert.deepEqual([reselectCalls, changeMainCalls], [1, 1]);
});

test('equipment candidate precondition explains the issue and offers equipment reselection', () => {
  let reselectCalls = 0;
  let backCalls = 0;
  const element = StageProgramEquipmentConstraintView({
    onReselectEquipment: () => { reselectCalls++; },
    onBack: () => { backCalls++; },
  });
  const markup = renderToStaticMarkup(element);
  assert.match(markup, /EQUIPMENT CHECK/);
  assert.match(markup, /器具を追加して/);
  assert.deepEqual([reselectCalls, backCalls], [0, 0]);
  const buttons = buttonsIn(element);
  buttons.find((button) => buttonText(button) === '器具を選び直す').props.onClick();
  buttons.find((button) => buttonText(button) === 'Adventure Mapへ戻る').props.onClick();
  assert.deepEqual([reselectCalls, backCalls], [1, 1]);
});
