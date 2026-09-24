import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { QuestClearRewardContent } = await import('../src/components/QuestClearFeedback.tsx');
const { QuestGoldButton } = await import('../src/components/QuestUi.tsx');

function findReactElement(node, predicate) {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findReactElement(child, predicate);
      if (match !== null) return match;
    }
    return null;
  }
  if (typeof node !== 'object' || !('type' in node)) return null;
  if (predicate(node)) return node;
  return findReactElement(node.props?.children, predicate);
}

const trainingSummary = {
  dayIndex: 3,
  questType: 'training',
  trainingExpGained: { legs: 0, arms: 5, shoulders: 0, back: 10, chest: 15 },
  recoveryExpGained: 0,
  mapProgressGained: 1,
};

test('Training reward overlay renders snapshot rows in fixed order and omits zero categories', () => {
  const beforeRender = structuredClone(trainingSummary);
  const markup = renderToStaticMarkup(createElement(QuestClearRewardContent, {
    rewardSummary: trainingSummary,
    onContinue: () => {},
  }));

  assert.match(markup, /TRAINING COMPLETE/);
  assert.match(markup, /CHARACTER GROWTH/);
  assert.match(markup, /今回の獲得EXP/);
  const chest = markup.indexOf('胸 EXP');
  const back = markup.indexOf('背中 EXP');
  const arms = markup.indexOf('腕 EXP');
  assert.ok(chest >= 0 && chest < back && back < arms);
  assert.match(markup, /胸 EXP<\/dt><dd>\+15/);
  assert.match(markup, /背中 EXP<\/dt><dd>\+10/);
  assert.match(markup, /腕 EXP<\/dt><dd>\+5/);
  assert.doesNotMatch(markup, /肩 EXP|脚 EXP|\+0/);
  assert.match(markup, /MAP PROGRESS/);
  assert.match(markup, />\+1<\/strong>/);
  assert.deepEqual(trainingSummary, beforeRender);
});

test('Recovery reward overlay renders only Recovery EXP and Map Progress from the snapshot', () => {
  const summary = {
    dayIndex: 2,
    questType: 'recovery',
    trainingExpGained: {},
    recoveryExpGained: 10,
    mapProgressGained: 1,
  };
  const markup = renderToStaticMarkup(createElement(QuestClearRewardContent, {
    rewardSummary: summary,
    onContinue: () => {},
  }));

  assert.match(markup, /RECOVERY COMPLETE/);
  assert.match(markup, /RECOVERY EXP<\/dt><dd>\+10/);
  assert.match(markup, /MAP PROGRESS/);
  assert.match(markup, />\+1<\/strong>/);
  assert.doesNotMatch(markup, /CHARACTER GROWTH|胸 EXP|背中 EXP|肩 EXP|腕 EXP|脚 EXP/);
});

test('return CTA delegates to the existing callback and does not run during render', () => {
  let continueCalls = 0;
  const tree = QuestClearRewardContent({
    rewardSummary: trainingSummary,
    onContinue: () => { continueCalls += 1; },
  });
  const button = findReactElement(tree, (element) => element.type === QuestGoldButton);

  assert.ok(button);
  assert.equal(button.props.type, 'button');
  assert.equal(button.props.children, 'MAPへ戻る');
  assert.equal(continueCalls, 0);
  button.props.onClick();
  assert.equal(continueCalls, 1);
});

test('missing reward summary has a safe no-reward fallback', () => {
  const markup = renderToStaticMarkup(createElement(QuestClearRewardContent, {
    rewardSummary: null,
    onContinue: () => {},
  }));

  assert.match(markup, /QUEST COMPLETE/);
  assert.match(markup, /報酬情報を表示できませんでした/);
  assert.match(markup, /MAPへ戻る/);
  assert.doesNotMatch(markup, /CHARACTER GROWTH|RECOVERY EXP|MAP PROGRESS|\+\d+/);
});
