import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function isOpenAIKeyConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
  return typeof environment.OPENAI_API_KEY === 'string' && environment.OPENAI_API_KEY.trim().length > 0;
}

export const MISSING_OPENAI_KEY_MESSAGE =
  'OPENAI_API_KEY is not configured.\n' +
  'Check server/.env and start with:\n' +
  'npm.cmd run dev:server';

export function startDevelopmentServer(environment: NodeJS.ProcessEnv = process.env): void {
  if (!isOpenAIKeyConfigured(environment)) {
    console.error(MISSING_OPENAI_KEY_MESSAGE);
    process.exitCode = 1;
    return;
  }

  void import('./index.js');
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  if (entrypoint === undefined) return false;
  return import.meta.url === pathToFileURL(resolve(entrypoint)).href;
}

if (isMainModule()) {
  startDevelopmentServer();
}
