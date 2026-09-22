import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  validateAchievementDurationEstimate,
  validateAchievementDurationEstimatorInput,
  type AchievementDurationEstimate,
  type AchievementDurationEstimatorInput,
} from '@fitness-rpg/shared';
import {
  AchievementDurationGenerationError,
  generateAchievementDurationEstimate,
  type AchievementDurationProviderFailureDiagnostic,
} from './openai/achievementDuration.js';
import { isOpenAIConfigured } from './openai/client.js';

type DurationEstimator = (
  input: AchievementDurationEstimatorInput,
) => Promise<AchievementDurationEstimate>;

/** Injection keeps HTTP contract tests network-free without adopting a provider abstraction. */
export function createApp(estimateDuration: DurationEstimator = generateAchievementDurationEstimate) {
  const app = express();
  app.use(express.json());

  function logDiagnostic(message: string): void {
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return;
    console.warn(`[achievement-duration] ${message}`);
  }

  function logRequestSucceeded(status: number): void {
    logDiagnostic(`request_succeeded status=${status}`);
  }

  function logRequestFailed(status: number, code: string, reason?: string): void {
    const suffix = reason === undefined ? '' : ` reason=${reason}`;
    logDiagnostic(`request_failed status=${status} code=${code}${suffix}`);
  }

  function logProviderFailure(diagnostic: AchievementDurationProviderFailureDiagnostic | undefined): void {
    if (diagnostic === undefined) {
      logDiagnostic('provider_failure kind=unknown_provider_error');
      return;
    }
    const status = diagnostic.status === undefined ? '' : ` status=${diagnostic.status}`;
    const code = diagnostic.code === undefined ? '' : ` code=${diagnostic.code}`;
    const causeCode = diagnostic.causeCode === undefined ? '' : ` causeCode=${diagnostic.causeCode}`;
    const sdkError = diagnostic.sdkErrorName === undefined ? '' : ` sdkError=${diagnostic.sdkErrorName}`;
    logDiagnostic(
      `provider_failure kind=${diagnostic.kind}${status}${code}${causeCode}${sdkError}`,
    );
  }

  function getRequestValidationReason(
    errors: readonly { readonly code: string }[],
  ): string {
    const codes = new Set(errors.map((error) => error.code));
    if (codes.has('INVALID_INPUT_SHAPE') || codes.has('INVALID_FIELD')) return 'invalid_shape';
    if (codes.has('INVALID_EXERCISE_ID')) return 'invalid_exercise';
    if (codes.has('INVALID_CURRENT_E1RM') || codes.has('INVALID_STAGE_TARGET_E1RM')) return 'invalid_e1rm';
    if (codes.has('INVALID_TRAINING_EXPERIENCE_MONTHS')) return 'invalid_experience';
    if (codes.has('INVALID_TRAINING_FREQUENCY_PER_WEEK')) return 'invalid_frequency';
    return 'invalid_request';
  }

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.post('/api/achievement-duration', async (request, response) => {
    const input = validateAchievementDurationEstimatorInput(request.body);
    if (!input.valid) {
      logRequestFailed(400, 'INVALID_REQUEST', getRequestValidationReason(input.errors));
      response.status(400).json({ error: { code: 'INVALID_REQUEST' } });
      return;
    }

    logDiagnostic(`adapter_start openaiConfigured=${isOpenAIConfigured()}`);
    try {
      const estimate = await estimateDuration(input.value);
      const validation = validateAchievementDurationEstimate(estimate);
      if (!validation.valid) {
        logRequestFailed(502, 'INVALID_STRUCTURED_OUTPUT');
        response.status(502).json({ error: { code: 'INVALID_STRUCTURED_OUTPUT' } });
        return;
      }
      logRequestSucceeded(200);
      response.json({ estimatedAchievementDays: validation.value.estimatedAchievementDays });
    } catch (error) {
      if (error instanceof AchievementDurationGenerationError) {
        if (error.code === 'INVALID_INPUT') {
          logRequestFailed(400, 'INVALID_REQUEST', 'adapter_invalid_input');
          response.status(400).json({ error: { code: 'INVALID_REQUEST' } });
          return;
        }
        const publicCode = error.code === 'OPENAI_API_ERROR'
          ? 'PROVIDER_FAILURE'
          : 'INVALID_STRUCTURED_OUTPUT';
        if (error.code === 'OPENAI_API_ERROR') {
          logProviderFailure(error.providerDiagnostic);
        }
        logRequestFailed(502, publicCode);
        response.status(502).json({
          error: {
            code: publicCode,
          },
        });
        return;
      }
      logRequestFailed(500, 'INTERNAL_ERROR');
      response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
    const responseStatus = status === 400 ? 400 : 500;
    const code = status === 400 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR';
    if (_request.path === '/api/achievement-duration') {
      logRequestFailed(responseStatus, code);
    }
    response.status(responseStatus).json({ error: { code } });
  });

  return app;
}

export const app = createApp();
