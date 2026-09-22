import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  EQUIPMENT_IDS,
  TrainingCandidateError,
  buildTrainingCandidates,
  getExerciseById,
  validateTrainingPlanDraft,
  validateAchievementDurationEstimate,
  validateAchievementDurationEstimatorInput,
  validateTrainingSessionPlannerInput,
  type AchievementDurationEstimate,
  type AchievementDurationEstimatorInput,
  type EquipmentId,
  type ExerciseId,
  type GymEquipmentProfile,
  type MovementPattern,
  type MuscleGroup,
  type TrainingCandidateResult,
  type TrainingSessionPlannerInput,
  type ValidatedTrainingPlan,
} from '@fitness-rpg/shared';
import {
  AchievementDurationGenerationError,
  generateAchievementDurationEstimate,
  type AchievementDurationProviderFailureDiagnostic,
} from './openai/achievementDuration.js';
import { isOpenAIConfigured } from './openai/client.js';
import {
  TrainingPlanGenerationError,
  generateTrainingPlan,
} from './openai/trainingPlan.js';

type DurationEstimator = (
  input: AchievementDurationEstimatorInput,
) => Promise<AchievementDurationEstimate>;

type TrainingPlanGenerator = (
  input: TrainingSessionPlannerInput,
) => Promise<ValidatedTrainingPlan>;

interface TrainingPlanRequest {
  readonly equipmentIds: readonly EquipmentId[];
  readonly trainingExperienceMonths: number;
  readonly mainExerciseId: ExerciseId;
  readonly sessionFocus: {
    readonly targetMuscles: readonly MuscleGroup[];
    readonly targetMovementPatterns?: readonly MovementPattern[];
  };
}

type TrainingPlanRequestValidationResult =
  | { readonly valid: true; readonly value: TrainingPlanRequest }
  | { readonly valid: false };

const TRAINING_PLAN_REQUEST_FIELDS = [
  'equipmentIds',
  'trainingExperienceMonths',
  'mainExerciseId',
  'sessionFocus',
] as const;

const TRAINING_PLAN_SESSION_FOCUS_FIELDS = [
  'targetMuscles',
  'targetMovementPatterns',
] as const;

const SERVER_EQUIPMENT_PROFILE_ID = 'on-demand-training-plan-equipment';
const SERVER_EQUIPMENT_PROFILE_DISPLAY_NAME = 'Selected equipment';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(value).every((field) => fields.includes(field));
}

function isKnownEquipmentId(value: unknown): value is EquipmentId {
  return typeof value === 'string' && EQUIPMENT_IDS.includes(value as EquipmentId);
}

function validateTrainingPlanRequest(body: unknown): TrainingPlanRequestValidationResult {
  if (!isRecord(body) || !hasOnlyFields(body, TRAINING_PLAN_REQUEST_FIELDS)) {
    return { valid: false };
  }

  if (!Array.isArray(body.equipmentIds) || !body.equipmentIds.every(isKnownEquipmentId)) {
    return { valid: false };
  }
  const equipmentIds = body.equipmentIds as EquipmentId[];
  if (new Set(equipmentIds).size !== equipmentIds.length) {
    return { valid: false };
  }

  if (
    typeof body.trainingExperienceMonths !== 'number' ||
    !Number.isFinite(body.trainingExperienceMonths) ||
    !Number.isInteger(body.trainingExperienceMonths) ||
    body.trainingExperienceMonths < 0
  ) {
    return { valid: false };
  }

  if (typeof body.mainExerciseId !== 'string') {
    return { valid: false };
  }
  const mainExercise = getExerciseById(body.mainExerciseId);
  if (mainExercise === undefined) {
    return { valid: false };
  }

  if (!isRecord(body.sessionFocus) ||
      !hasOnlyFields(body.sessionFocus, TRAINING_PLAN_SESSION_FOCUS_FIELDS) ||
      !Array.isArray(body.sessionFocus.targetMuscles) ||
      !body.sessionFocus.targetMuscles.every((value) => typeof value === 'string')) {
    return { valid: false };
  }

  const targetMovementPatterns = body.sessionFocus.targetMovementPatterns;
  if (targetMovementPatterns !== undefined &&
      (!Array.isArray(targetMovementPatterns) ||
       !targetMovementPatterns.every((value) => typeof value === 'string'))) {
    return { valid: false };
  }

  return {
    valid: true,
    value: {
      equipmentIds: [...equipmentIds],
      trainingExperienceMonths: body.trainingExperienceMonths,
      mainExerciseId: mainExercise.id,
      sessionFocus: {
        targetMuscles: [...body.sessionFocus.targetMuscles] as MuscleGroup[],
        ...(targetMovementPatterns === undefined
          ? {}
          : { targetMovementPatterns: [...targetMovementPatterns] as MovementPattern[] }),
      },
    },
  };
}

function createServerEquipmentProfile(
  equipmentIds: readonly EquipmentId[],
): GymEquipmentProfile {
  return {
    id: SERVER_EQUIPMENT_PROFILE_ID,
    displayName: SERVER_EQUIPMENT_PROFILE_DISPLAY_NAME,
    availableEquipmentIds: [...equipmentIds],
  };
}

/** Injection keeps HTTP contract tests network-free without adopting a provider abstraction. */
export function createApp(
  estimateDuration: DurationEstimator = generateAchievementDurationEstimate,
  generatePlan: TrainingPlanGenerator = generateTrainingPlan,
) {
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

  app.post('/api/training-plan', async (request, response) => {
    const requestValidation = validateTrainingPlanRequest(request.body);
    if (!requestValidation.valid) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST' } });
      return;
    }

    const equipmentProfile = createServerEquipmentProfile(requestValidation.value.equipmentIds);
    let candidates: TrainingCandidateResult;
    try {
      candidates = buildTrainingCandidates({
        equipmentProfile,
        mainExerciseId: requestValidation.value.mainExerciseId,
        targetMuscles: requestValidation.value.sessionFocus.targetMuscles,
        ...(requestValidation.value.sessionFocus.targetMovementPatterns === undefined
          ? {}
          : { targetMovementPatterns: requestValidation.value.sessionFocus.targetMovementPatterns }),
      });
    } catch (error) {
      if (error instanceof TrainingCandidateError) {
        const status = error.code === 'MAIN_EXERCISE_UNAVAILABLE' ? 422 : 400;
        response.status(status).json({ error: { code: error.code } });
        return;
      }
      response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
      return;
    }

    const plannerInput = validateTrainingSessionPlannerInput({
      candidates,
      context: {
        trainingExperienceMonths: requestValidation.value.trainingExperienceMonths,
        sessionFocus: requestValidation.value.sessionFocus,
      },
    });
    if (!plannerInput.valid) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST' } });
      return;
    }

    try {
      const generatedPlan = await generatePlan(plannerInput.value);
      const planValidation = validateTrainingPlanDraft(generatedPlan, candidates);
      if (!planValidation.valid) {
        response.status(502).json({ error: { code: 'INVALID_STRUCTURED_OUTPUT' } });
        return;
      }
      response.json({ plan: planValidation.plan });
    } catch (error) {
      if (error instanceof TrainingPlanGenerationError) {
        if (error.code === 'INVALID_INPUT') {
          response.status(400).json({ error: { code: 'INVALID_REQUEST' } });
          return;
        }
        const publicCode = error.code === 'OPENAI_API_ERROR'
          ? 'PROVIDER_FAILURE'
          : 'INVALID_STRUCTURED_OUTPUT';
        response.status(502).json({ error: { code: publicCode } });
        return;
      }
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
