import OpenAI from 'openai';

export const DEFAULT_DEVELOPMENT_MODEL = 'gpt-5.6-luna';

export class MissingOpenAIKeyError extends Error {
  public readonly code = 'OPENAI_API_KEY_MISSING';

  public constructor() {
    super('OPENAI_API_KEY is not set in the backend environment.');
    this.name = 'MissingOpenAIKeyError';
  }
}

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new MissingOpenAIKeyError();
  }

  return new OpenAI({ apiKey });
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_DEVELOPMENT_MODEL;
}
