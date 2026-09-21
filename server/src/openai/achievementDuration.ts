import type {
  AchievementDurationEstimate,
  AchievementDurationEstimatorInput,
} from '@fitness-rpg/shared';
import {
  validateAchievementDurationEstimate,
  validateAchievementDurationEstimatorInput,
} from '@fitness-rpg/shared';
import type OpenAI from 'openai';

import { createOpenAIClient, getOpenAIModel } from './client.js';
import { achievementDurationEstimateFormat } from './achievementDurationSchema.js';

export const ACHIEVEMENT_DURATION_ESTIMATOR_PROMPT_VERSION = 'achievement-duration-estimator-prompt-v1';

export type AchievementDurationGenerationErrorCode =
  | 'INVALID_INPUT'
  | 'OPENAI_API_ERROR'
  | 'STRUCTURED_OUTPUT_MISSING'
  | 'DOMAIN_VALIDATION_FAILED';

export class AchievementDurationGenerationError extends Error {
  public readonly name = 'AchievementDurationGenerationError';

  public constructor(
    public readonly code: AchievementDurationGenerationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function buildAchievementDurationEstimatorInput(
  input: AchievementDurationEstimatorInput,
): string {
  return JSON.stringify(input);
}

export function validateGeneratedAchievementDurationEstimate(
  outputText: string,
): AchievementDurationEstimate {
  let output: unknown;
  try {
    output = JSON.parse(outputText);
  } catch {
    throw new AchievementDurationGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'No parseable structured achievement duration estimate was returned.',
    );
  }

  const validation = validateAchievementDurationEstimate(output);
  if (!validation.valid) {
    throw new AchievementDurationGenerationError(
      'DOMAIN_VALIDATION_FAILED',
      `Achievement duration estimate failed domain validation: ${validation.errors.map((error) => error.code).join(', ')}`,
    );
  }
  return validation.value;
}

/**
 * AI estimates only days to a deterministic stage target. It never selects a
 * roadmap duration, changes the target, or schedules training/recovery days.
 */
export async function generateAchievementDurationEstimate(
  input: AchievementDurationEstimatorInput,
  client?: OpenAI,
): Promise<AchievementDurationEstimate> {
  const validation = validateAchievementDurationEstimatorInput(input);
  if (!validation.valid) {
    throw new AchievementDurationGenerationError(
      'INVALID_INPUT',
      `AchievementDurationEstimatorInput failed validation: ${validation.errors.map((error) => error.code).join(', ')}`,
    );
  }

  const selectedClient = client ?? createOpenAIClient();
  let response: Awaited<ReturnType<typeof selectedClient.responses.create>>;
  try {
    response = await selectedClient.responses.create({
      model: getOpenAIModel(),
      instructions: [
        'Estimate the number of calendar days needed to progress from the supplied current e1RM to the supplied next stage target.',
        'Use exercise, trainingExperienceMonths, and trainingFrequencyPerWeek only as estimation context.',
        'Return only estimatedAchievementDays.',
        'Do not change the exercise or stage target.',
        'Do not choose a roadmap duration, boss date, training days, recovery days, quest outcome, EXP, or boss outcome.',
      ].join(' '),
      input: buildAchievementDurationEstimatorInput(validation.value),
      text: { format: achievementDurationEstimateFormat },
    });
  } catch {
    // SDK errors can include request details. Do not surface them or a key.
    throw new AchievementDurationGenerationError('OPENAI_API_ERROR', 'OpenAI request failed.');
  }

  if (response.status !== 'completed' || !response.output_text?.trim()) {
    throw new AchievementDurationGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'The OpenAI response did not contain a completed structured output.',
    );
  }

  return validateGeneratedAchievementDurationEstimate(response.output_text);
}
