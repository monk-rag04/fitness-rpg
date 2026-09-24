import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');

/**
 * Small DOM surface for this integration test. The repository intentionally
 * has no DOM test dependency; this is only enough for React's client root and
 * delegated click events.
 */
class TestNode {
  constructor(nodeType, nodeName, ownerDocument) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this.listeners = new Map();
  }

  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child, reference) {
    child.parentNode = this;
    const index = this.childNodes.indexOf(reference);
    if (index === -1) this.childNodes.push(child);
    else this.childNodes.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((item) => item !== listener));
  }

  dispatchEvent(event) {
    if (event.target === undefined) event.target = this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
    if (event.bubbles && !event.cancelBubble && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this.childNodes = value === '' ? [] : [new TestText(value, this.ownerDocument)];
  }
}

class TestText extends TestNode {
  constructor(value, ownerDocument) {
    super(3, '#text', ownerDocument);
    this.nodeValue = value;
  }

  get textContent() {
    return this.nodeValue;
  }
}

class TestElement extends TestNode {
  constructor(tagName, ownerDocument) {
    super(1, tagName.toUpperCase(), ownerDocument);
    this.tagName = tagName.toUpperCase();
    this.namespaceURI = 'http://www.w3.org/1999/xhtml';
    this.attributes = new Map();
    this.style = {};
    this.disabled = false;
    this.value = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'disabled') this.disabled = true;
  }
  setAttributeNS(_namespace, name, value) { this.setAttribute(name, value); }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'disabled') this.disabled = false;
  }
  removeAttributeNS(_namespace, name) { this.removeAttribute(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
}

class TestDocument extends TestNode {
  constructor() {
    super(9, '#document', null);
    this.ownerDocument = this;
    this.documentElement = new TestElement('html', this);
    this.body = new TestElement('body', this);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
    this.defaultView = null;
  }

  createElement(tagName) { return new TestElement(tagName, this); }
  createElementNS(_namespace, tagName) { return new TestElement(tagName, this); }
  createTextNode(value) { return new TestText(value, this); }
  getElementsByTagName() { return []; }
  hasFocus() { return true; }
}

function installTestDom() {
  const document = new TestDocument();
  const window = {
    document,
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    getSelection() { return null; },
    Node: TestNode,
    Element: TestElement,
    HTMLElement: TestElement,
    SVGElement: TestElement,
    HTMLIFrameElement: TestElement,
    Text: TestText,
  };
  document.defaultView = window;
  globalThis.window = window;
  globalThis.document = document;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'node-test' },
  });
  globalThis.Node = TestNode;
  globalThis.Element = TestElement;
  globalThis.HTMLElement = TestElement;
  globalThis.SVGElement = TestElement;
  globalThis.HTMLIFrameElement = TestElement;
  globalThis.Text = TestText;
  globalThis.Document = TestDocument;
  return document;
}

function findElements(node, predicate, result = []) {
  if (predicate(node)) result.push(node);
  for (const child of node.childNodes ?? []) findElements(child, predicate, result);
  return result;
}

function click(element) {
  element.dispatchEvent({
    type: 'click',
    bubbles: true,
    cancelBubble: false,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.cancelBubble = true; },
  });
}

const document = installTestDom();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { StrictMode, act, createElement, Fragment, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const { generateStageRoadmap, getCanonicalStageTrainingDays } = await import('@fitness-rpg/shared');
const { AdventureQuestProvider, createOnboardingAdventureSession, useAdventureQuest } = await import('../src/state/AdventureQuestContext.tsx');
const { CurrentQuest } = await import('../src/features/quests/CurrentQuest.tsx');
const { RescheduleQuestSheet } = await import('../src/features/quests/RescheduleQuestSheet.tsx');
const { DEMO_TRAINING_PLAN } = await import('../src/demo/fixture.ts');

function createRoadmap() {
  return generateStageRoadmap({
    startDate: '2026-09-23',
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

test('StrictMode renders Equipment Flow and survives effect cleanup before CTA submit', async () => {
  const roadmap = createRoadmap();
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: { currentDayIndex: 0 },
    stageTrainingProgramContext: {
      mainExerciseId: 'barbell_bench_press',
      currentE1rmKg: 70,
      trainingExperienceMonths: 8,
      trainingFrequencyPerWeek: 3,
    },
  });
  let resolveRequest;
  let requestCount = 0;
  let requestOptions;
  globalThis.fetch = (_url, options) => {
    requestCount += 1;
    requestOptions = options;
    return new Promise((resolve) => { resolveRequest = resolve; });
  };

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(
      StrictMode,
      null,
      createElement(AdventureQuestProvider, { session }, createElement(CurrentQuest)),
    ));
  });

  const gear = findElements(container, (element) =>
    element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent.includes('バーベル'))[0];
  assert.ok(gear, 'Equipment card should render under StrictMode');
  await act(async () => { click(gear); });

  const submit = findElements(container, (element) =>
    element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent.includes('クエスト'))[0];
  assert.ok(submit, 'Equipment CTA should render after selection');
  await act(async () => { click(submit); });

  assert.equal(requestCount, 1);
  assert.deepEqual(JSON.parse(requestOptions.body).equipmentIds, ['barbell']);
  assert.match(container.textContent, /STAGE PROGRAM GENERATING/);

  resolveRequest({
    status: 200,
    json: async () => ({ program: createProgram(roadmap) }),
  });
  await act(async () => { await Promise.resolve(); });
  assert.equal(requestCount, 1);

  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
});

test('Current Quest reschedule sheet validates dates and updates only the roadmap in session state', async () => {
  const roadmap = createRoadmap();
  const equipmentProfile = { id: 'test-equipment', displayName: 'Test Equipment', availableEquipmentIds: ['barbell'] };
  const stageTrainingProgramContext = {
    mainExerciseId: 'barbell_bench_press',
    currentE1rmKg: 70,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: 3,
  };
  const baseSession = createOnboardingAdventureSession({
    roadmap,
    initialProgress: { currentDayIndex: 2 },
    stageTrainingProgramContext,
  });
  const session = {
    ...baseSession,
    planByDay: { 2: DEMO_TRAINING_PLAN },
    equipmentProfile,
  };
  let latestContext;
  let seedResultStatus;
  let rescheduleStatus;
  function ContextProbe() {
    const context = useAdventureQuest();
    latestContext = context;
    const firstExercise = DEMO_TRAINING_PLAN.exercises[0];
    return createElement(Fragment, null,
      createElement('button', {
        type: 'button',
        onClick: () => {
          seedResultStatus = context.saveWorkoutResult({
            plannedExerciseId: firstExercise.exerciseId,
            performedExerciseId: firstExercise.exerciseId,
            role: firstExercise.role,
            plannedSets: firstExercise.sets,
            plannedRepRange: firstExercise.repRange,
            completedSets: [{ setNumber: 1, weightKg: 60, reps: 8 }],
            performedAt: '2026-09-24T12:00:00.000Z',
          }).valid;
        },
      }, 'Seed result'),
      createElement('button', {
        type: 'button',
        onClick: () => { rescheduleStatus = context.rescheduleCurrentQuest('2030-09-25', '2026-09-24'); },
      }, 'Reschedule through state'),
    );
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(AdventureQuestProvider, { session }, createElement(
      Fragment,
      null,
      createElement(CurrentQuest),
      createElement(ContextProbe),
    )));
  });

  let rescheduleButton = findElements(container, (element) =>
    element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === '日程を変更')[0];
  assert.ok(rescheduleButton, 'Training Quest should expose the secondary reschedule action');
  await act(async () => { click(findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'Seed result')[0]); });
  assert.equal(seedResultStatus, true);
  const before = latestContext;

  rescheduleButton = findElements(container, (element) =>
    element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === '日程を変更')[0];
  await act(async () => { click(rescheduleButton); });
  let dialog = findElements(container, (element) => element.nodeType === 1 && element.getAttribute('role') === 'dialog')[0];
  assert.ok(dialog);
  assert.match(dialog.textContent, /QUESTの日程を変更/);
  let confirm = findElements(dialog, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'この日付に変更')[0];
  assert.equal(confirm.disabled, true, 'same-date confirmation should be disabled');
  const cancel = findElements(dialog, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'キャンセル')[0];
  await act(async () => { click(cancel); });
  assert.equal(findElements(container, (element) => element.nodeType === 1 && element.getAttribute('role') === 'dialog').length, 0);

  await act(async () => { click(findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === '日程を変更')[0]); });
  dialog = findElements(container, (element) => element.nodeType === 1 && element.getAttribute('role') === 'dialog')[0];
  const dateInput = findElements(dialog, (element) => element.nodeType === 1 && element.tagName === 'INPUT')[0];
  assert.equal(dateInput.getAttribute('min'), roadmap.days[2].date);
  await act(async () => { click(findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'Reschedule through state')[0]); });
  assert.equal(rescheduleStatus, 'rescheduled');
  assert.equal(latestContext.roadmap.days[2].date, '2030-09-25');
  assert.equal(latestContext.roadmap.boss.date, '2030-10-07');
  assert.equal(latestContext.progress, before.progress);
  assert.equal(latestContext.progress.currentDayIndex, 2);
  assert.equal(latestContext.trainingPlan, before.trainingPlan);
  assert.equal(latestContext.equipmentProfile, before.equipmentProfile);
  assert.equal(latestContext.stageTrainingProgramContext, before.stageTrainingProgramContext);
  assert.deepEqual(latestContext.workoutResults, before.workoutResults);
  assert.doesNotMatch(container.textContent, /DATE_BEFORE|INVALID_DATE|CurrentQuestReschedule/);
  assert.equal(findElements(container, (element) => element.nodeType === 1 && element.getAttribute('role') === 'dialog').length, 1);
  const close = findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'キャンセル')[0];
  await act(async () => { click(close); });

  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
});

test('reschedule sheet enables only a future LocalDate and invokes its confirm action', async () => {
  let confirmCalls = 0;
  let cancelCalls = 0;
  function SheetHarness() {
    const [selectedDate, setSelectedDate] = useState('2026-09-25');
    return createElement(Fragment, null,
      createElement('button', { type: 'button', onClick: () => setSelectedDate('2030-09-25') }, 'Choose later date'),
      createElement(RescheduleQuestSheet, {
        currentDate: '2026-09-25',
        minimumDate: '2026-09-25',
        selectedDate,
        hasError: true,
        onDateChange: setSelectedDate,
        onConfirm: () => { confirmCalls += 1; },
        onCancel: () => { cancelCalls += 1; },
      }),
    );
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(SheetHarness)); });
  const current = findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'この日付に変更')[0];
  assert.equal(current.disabled, true);
  assert.match(container.textContent, /進行状況やトレーニング内容は変わりません/);
  assert.match(container.textContent, /選択した日付には変更できません/);
  assert.doesNotMatch(container.textContent, /INVALID_DATE|DATE_BEFORE|CurrentQuestReschedule/);
  await act(async () => { click(findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'Choose later date')[0]); });
  const future = findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'この日付に変更')[0];
  assert.equal(future.disabled, false);
  await act(async () => { click(future); });
  assert.equal(confirmCalls, 1);
  const cancel = findElements(container, (element) => element.nodeType === 1 && element.tagName === 'BUTTON' && element.textContent === 'キャンセル')[0];
  await act(async () => { click(cancel); });
  assert.equal(cancelCalls, 1);
  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
});
