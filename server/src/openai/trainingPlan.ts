import type { TrainingCandidateResult, TrainingPlanDraft, ValidatedTrainingPlan } from '@fitness-rpg/shared';
import { validateTrainingPlanDraft } from '@fitness-rpg/shared';
import type OpenAI from 'openai';

import { createOpenAIClient, getOpenAIModel } from './client.js';
import { trainingPlanDraftFormat } from './trainingPlanSchema.js';

export type TrainingPlanGenerationErrorCode =
  | 'OPENAI_API_ERROR'
  | 'STRUCTURED_OUTPUT_MISSING'
  | 'DOMAIN_VALIDATION_FAILED';

export class TrainingPlanGenerationError extends Error {
  public constructor(
    public readonly code: TrainingPlanGenerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TrainingPlanGenerationError';
  }
}

export function buildTrainingPlanInput(candidates: TrainingCandidateResult): string {
  return JSON.stringify(candidates);
}

export function validateGeneratedTrainingPlan(
  outputText: string,
  candidates: TrainingCandidateResult,
): TrainingPlanDraft & ValidatedTrainingPlan {
  let draft: unknown;
  try {
    draft = JSON.parse(outputText);
  } catch {
    throw new TrainingPlanGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'No parseable structured TrainingPlanDraft was returned.',
    );
  }

  const validation = validateTrainingPlanDraft(draft, candidates);
  if (!validation.valid) {
    throw new TrainingPlanGenerationError(
      'DOMAIN_VALIDATION_FAILED',
      `TrainingPlanDraft failed domain validation: ${validation.errors.map((error) => error.code).join(', ')}`,
    );
  }

  return validation.plan;
}

export async function generateTrainingPlan(
  candidates: TrainingCandidateResult,
  client: OpenAI = createOpenAIClient(),
): Promise<ValidatedTrainingPlan> {
  let response: Awaited<ReturnType<typeof client.responses.create>>;
  try {
    response = await client.responses.create({
      model: getOpenAIModel(),
      instructions: [
        'Generate a training plan only from the supplied exercise candidates.',
        'If mainExercise is present, include it exactly once with role main.',
        'Every other selected exercise must have role accessory.',
        'Return sets and repRange. Do not return weight or other fields.',
      ].join(' '),
      input: buildTrainingPlanInput(candidates),
      text: { format: trainingPlanDraftFormat },
    });
  } catch {
    // SDK errors may contain request details. Do not expose them or the key.
    throw new TrainingPlanGenerationError('OPENAI_API_ERROR', 'OpenAI request failed.');
  }

  if (response.status !== 'completed' || !response.output_text?.trim()) {
    throw new TrainingPlanGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'The OpenAI response did not contain a completed structured output.',
    );
  }

  return validateGeneratedTrainingPlan(response.output_text, candidates);
}
