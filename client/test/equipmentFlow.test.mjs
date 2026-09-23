import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EQUIPMENT_CATALOG } from '@fitness-rpg/shared';
import { equipmentLabel } from '../src/presentation/trainingLabels.ts';

// Use the existing client JSX transform when loading presentational TSX in Node.
process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');
const {
  EquipmentCheckView,
  EquipmentCheckContent,
  StageProgramGeneratingView,
  StageProgramErrorView,
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
  return [
    ...(node.type === 'button' ? [node] : []),
    ...buttonsIn(node.props.children),
  ];
}

function buttonText(node) {
  if (Array.isArray(node)) return node.map(buttonText).join('');
  if (node === null || node === undefined) return '';
  if (typeof node !== 'object') return String(node);
  return buttonText(node.props.children);
}

test('Equipment Check starts at 0 SELECTED with all Catalog choices and no-equipment unselected', () => {
  const markup = renderToStaticMarkup(createElement(EquipmentCheckView, {
    onBack: () => {},
    onSubmit: () => {},
  }));
  assert.match(markup, /0件 選択中/);
  assert.equal((markup.match(/aria-pressed="false"/g) ?? []).length, EQUIPMENT_CATALOG.length + 1);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /器具なし/);
  for (const equipment of EQUIPMENT_CATALOG) {
    assert.ok(markup.includes(equipmentLabel(equipment.id)));
    assert.equal(markup.includes(equipment.displayName), false);
  }
  assert.equal(INITIAL_EQUIPMENT_DRAFT.kind, 'unselected');
  assert.equal(equipmentIdsForSubmission(INITIAL_EQUIPMENT_DRAFT), null);
});

test('Equipment cards toggle independently, allow multiple selection, and never select Full Gym', () => {
  const first = toggleEquipment(INITIAL_EQUIPMENT_DRAFT, 'barbell');
  const second = toggleEquipment(first, 'dumbbell');
  assert.deepEqual(equipmentIdsForSubmission(first), ['barbell']);
  assert.deepEqual(equipmentIdsForSubmission(second), ['barbell', 'dumbbell']);
  assert.equal(selectedChoiceCount(second), 2);
  assert.notEqual(selectedChoiceCount(second), EQUIPMENT_CATALOG.length);
  assert.deepEqual(toggleEquipment(second, 'barbell'), {
    kind: 'equipment', equipmentIds: ['dumbbell'],
  });
  assert.equal(toggleEquipment(first, 'barbell').kind, 'unselected');
});

test('explicit no-equipment clears gear and a later gear selection clears no-equipment', () => {
  const selected = toggleEquipment(INITIAL_EQUIPMENT_DRAFT, 'barbell');
  const noEquipment = toggleNoEquipment(selected);
  assert.equal(noEquipment.kind, 'no_equipment');
  assert.deepEqual(equipmentIdsForSubmission(noEquipment), []);
  assert.equal(selectedChoiceCount(noEquipment), 1);
  assert.deepEqual(equipmentIdsForSubmission(toggleEquipment(noEquipment, 'dumbbell')), ['dumbbell']);
  assert.equal(toggleNoEquipment(noEquipment).kind, 'unselected');
  assert.equal(equipmentIdsForSubmission(toggleNoEquipment(noEquipment)), null);
});

test('submit passes only an explicit UI draft to its callback', () => {
  const submissions = [];
  const onSubmit = (ids) => submissions.push(ids);
  assert.equal(submitEquipmentDraft(INITIAL_EQUIPMENT_DRAFT, onSubmit), false);
  assert.deepEqual(submissions, []);
  assert.equal(submitEquipmentDraft(toggleEquipment(INITIAL_EQUIPMENT_DRAFT, 'barbell'), onSubmit), true);
  assert.equal(submitEquipmentDraft(toggleNoEquipment(INITIAL_EQUIPMENT_DRAFT), onSubmit), true);
  assert.deepEqual(submissions, [['barbell'], []]);
});

test('selected Equipment and explicit no-equipment enable the CTA and show pressed state', () => {
  const baseProps = { onDraftChange: () => {}, onBack: () => {}, onSubmit: () => {} };
  const selectedMarkup = renderToStaticMarkup(createElement(EquipmentCheckContent, {
    ...baseProps,
    draft: toggleEquipment(INITIAL_EQUIPMENT_DRAFT, 'barbell'),
  }));
  assert.match(selectedMarkup, /1件 選択中/);
  assert.equal((selectedMarkup.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.doesNotMatch(selectedMarkup, /disabled=""/);

  const noEquipmentMarkup = renderToStaticMarkup(createElement(EquipmentCheckContent, {
    ...baseProps,
    draft: toggleNoEquipment(INITIAL_EQUIPMENT_DRAFT),
  }));
  assert.match(noEquipmentMarkup, /1件 選択中/);
  assert.equal((noEquipmentMarkup.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.doesNotMatch(noEquipmentMarkup, /disabled=""/);
});

test('Equipment Check buttons pass draft changes and submit only selected IDs', () => {
  const drafts = [];
  const submissions = [];
  const baseProps = {
    onDraftChange: (draft) => drafts.push(draft),
    onBack: () => {},
    onSubmit: (ids) => submissions.push(ids),
  };
  const initialButtons = buttonsIn(EquipmentCheckContent({
    ...baseProps,
    draft: INITIAL_EQUIPMENT_DRAFT,
  }));
  initialButtons.find((button) => buttonText(button).includes('バーベル')).props.onClick();
  assert.deepEqual(equipmentIdsForSubmission(drafts[0]), ['barbell']);

  const selectedButtons = buttonsIn(EquipmentCheckContent({ ...baseProps, draft: drafts[0] }));
  selectedButtons.find((button) => buttonText(button) === 'この装備でクエストを生成').props.onClick();
  assert.deepEqual(submissions, [['barbell']]);

  selectedButtons.find((button) => buttonText(button).includes('器具なし')).props.onClick();
  assert.equal(drafts[1].kind, 'no_equipment');
  const noEquipmentButtons = buttonsIn(EquipmentCheckContent({ ...baseProps, draft: drafts[1] }));
  noEquipmentButtons.find((button) => buttonText(button) === 'この装備でクエストを生成').props.onClick();
  assert.deepEqual(submissions, [['barbell'], []]);
});

test('Generating view shows the Stage-wide status without an automatic transition', () => {
  let backCalls = 0;
  const element = StageProgramGeneratingView({ onBack: () => { backCalls++; } });
  const markup = renderToStaticMarkup(element);
  assert.match(markup, /STAGE PROGRAM GENERATING/);
  assert.match(markup, /このStageのトレーニングプログラムを編成しています/);
  assert.match(markup, /STAGE PROGRAM/);
  assert.doesNotMatch(markup, /今日のQuest生成/);
  assert.equal(backCalls, 0);
});

test('Error view exposes explicit retry and Map callbacks without automatic retry', () => {
  let retryCalls = 0;
  let backCalls = 0;
  const element = StageProgramErrorView({
    onRetry: () => { retryCalls++; },
    onBack: () => { backCalls++; },
  });
  const markup = renderToStaticMarkup(element);
  assert.match(markup, /PROGRAM GENERATION FAILED/);
  assert.match(markup, /選択した器具は保持されています/);
  assert.deepEqual([retryCalls, backCalls], [0, 0]);
  const buttons = buttonsIn(element);
  buttons.find((button) => buttonText(button) === 'もう一度試す').props.onClick();
  buttons.find((button) => buttonText(button) === 'Adventure Mapへ戻る').props.onClick();
  assert.deepEqual([retryCalls, backCalls], [1, 1]);
});

test('Main Missing view displays its Exercise and leaves both choices to callbacks', () => {
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
