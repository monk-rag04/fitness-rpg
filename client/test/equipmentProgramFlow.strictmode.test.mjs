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
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  setAttributeNS(_namespace, name, value) { this.setAttribute(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
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

const { StrictMode, act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { generateStageRoadmap, getCanonicalStageTrainingDays } = await import('@fitness-rpg/shared');
const { AdventureQuestProvider, createOnboardingAdventureSession } = await import('../src/state/AdventureQuestContext.tsx');
const { CurrentQuest } = await import('../src/features/quests/CurrentQuest.tsx');
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
