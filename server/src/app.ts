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
} from './openai/achievementDuration.js';

type DurationEstimator = (
  input: AchievementDurationEstimatorInput,
) => Promise<AchievementDurationEstimate>;

/** Injection keeps HTTP contract tests network-free without adopting a provider abstraction. */
export function createApp(estimateDuration: DurationEstimator = generateAchievementDurationEstimate) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.post('/api/achievement-duration', async (request, response) => {
    const input = validateAchievementDurationEstimatorInput(request.body);
    if (!input.valid) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST' } });
      return;
    }

    try {
      const estimate = await estimateDuration(input.value);
      const validation = validateAchievementDurationEstimate(estimate);
      if (!validation.valid) {
        response.status(502).json({ error: { code: 'INVALID_STRUCTURED_OUTPUT' } });
        return;
      }
      response.json({ estimatedAchievementDays: validation.value.estimatedAchievementDays });
    } catch (error) {
      if (error instanceof AchievementDurationGenerationError) {
        if (error.code === 'INVALID_INPUT') {
          response.status(400).json({ error: { code: 'INVALID_REQUEST' } });
          return;
        }
        response.status(502).json({
          error: {
            code: error.code === 'OPENAI_API_ERROR'
              ? 'PROVIDER_FAILURE'
              : 'INVALID_STRUCTURED_OUTPUT',
          },
        });
        return;
      }
      response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
    response.status(status === 400 ? 400 : 500).json({
      error: { code: status === 400 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR' },
    });
  });

  return app;
}

export const app = createApp();
