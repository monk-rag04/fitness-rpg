import type {
  TrainingCandidateResult,
  TrainingPlanDraft,
  TrainingSessionPlannerInput,
  ValidatedTrainingPlan,
} from '@fitness-rpg/shared';
import { validateTrainingPlanDraft, validateTrainingSessionPlannerInput } from '@fitness-rpg/shared';
import type OpenAI from 'openai';

import { createOpenAIClient, getOpenAIModel } from './client.js';
import { trainingPlanDraftFormat } from './trainingPlanSchema.js';

export type TrainingPlanGenerationErrorCode =
  | 'INVALID_INPUT'
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

export function buildTrainingPlanInput(input: TrainingSessionPlannerInput): string {
  return JSON.stringify({
    candidates: input.candidates,
    trainingExperienceMonths: input.context.trainingExperienceMonths,
    sessionFocus: input.context.sessionFocus,
  });
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
  input: TrainingSessionPlannerInput,
  client?: OpenAI,
): Promise<ValidatedTrainingPlan> {
  const validation = validateTrainingSessionPlannerInput(input);
  if (!validation.valid) {
    throw new TrainingPlanGenerationError(
      'INVALID_INPUT',
      `TrainingSessionPlannerInput failed validation: ${validation.errors.map((error) => error.code).join(', ')}`,
    );
  }

  let response: Awaited<ReturnType<OpenAI['responses']['create']>>;
  try {
    const selectedClient = client ?? createOpenAIClient();
    response = await selectedClient.responses.create({
      model: getOpenAIModel(),
      instructions: [
        'Generate a training plan only from the supplied exercise candidates.',
        'Prioritize the supplied sessionFocus when selecting exercises.',
        'Use trainingExperienceMonths as context for sets and repRange proposals.',
        'If mainExercise is present, include it exactly once with role main.',
        'Every other selected exercise must have role accessory.',
        'Use 1 to 5 sets per exercise, with at most 6 exercises and 20 working sets total.',
        'Use a main repRange within 1 to 10 and accessory repRanges within 5 to 20.',
        'Return sets and repRange. Do not return weight or other fields.',
      ].join(' '),
      input: buildTrainingPlanInput(validation.value),
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

  return validateGeneratedTrainingPlan(response.output_text, validation.value.candidates);
}
