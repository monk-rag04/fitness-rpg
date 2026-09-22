import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
await import('tsx');

const { isOpenAIKeyConfigured, MISSING_OPENAI_KEY_MESSAGE } = await import('../src/devStartup.ts');

test('development startup treats a trimmed non-empty OpenAI key as configured', () => {
  assert.equal(isOpenAIKeyConfigured({ OPENAI_API_KEY: '  configured  ' }), true);
  assert.equal(isOpenAIKeyConfigured({ OPENAI_API_KEY: '' }), false);
  assert.equal(isOpenAIKeyConfigured({ OPENAI_API_KEY: '   ' }), false);
  assert.equal(isOpenAIKeyConfigured({}), false);
});

test('missing OpenAI configuration message never includes a key value', () => {
  assert.equal(
    MISSING_OPENAI_KEY_MESSAGE,
    'OPENAI_API_KEY is not configured.\n' +
      'Check server/.env and start with:\n' +
      'npm.cmd run dev:server',
  );
  assert.doesNotMatch(MISSING_OPENAI_KEY_MESSAGE, /sk-/i);
});
