import {
  buildTrainingCandidates,
  validateTrainingPlanDraft,
  type EquipmentId,
  type ExerciseId,
  type TrainingSessionPlannerContext,
  type ValidatedTrainingPlan,
} from '@fitness-rpg/shared';

export interface TrainingPlanApplicationInput {
  readonly equipmentIds: readonly EquipmentId[];
  readonly trainingExperienceMonths: number;
  readonly mainExerciseId: ExerciseId;
  readonly sessionFocus: TrainingSessionPlannerContext['sessionFocus'];
}

export type TrainingPlanRequestFailureCode =
  | 'invalid_request'
  | 'main_exercise_unavailable'
  | 'provider_failure'
  | 'invalid_structured_output'
  | 'internal_error'
  | 'invalid_response'
  | 'network_error';

export type TrainingPlanApplicationResult =
  | { readonly status: 'training_plan_ready'; readonly plan: ValidatedTrainingPlan }
  | { readonly status: 'training_plan_request_failed'; readonly code: TrainingPlanRequestFailureCode };

const TRAINING_PLAN_RESPONSE_PROFILE_ID = 'client-training-plan-response-validation';
const TRAINING_PLAN_RESPONSE_PROFILE_NAME = 'Client response validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlanResponse(value: unknown): value is { readonly plan: unknown } {
  return isRecord(value) &&
    Object.keys(value).length === 1 &&
    Object.hasOwn(value, 'plan');
}

function mapServerError(body: unknown): TrainingPlanRequestFailureCode {
  const code = isRecord(body) && isRecord(body.error) ? body.error.code : undefined;
  if (code === 'INVALID_REQUEST') return 'invalid_request';
  if (code === 'MAIN_EXERCISE_UNAVAILABLE') return 'main_exercise_unavailable';
  if (code === 'PROVIDER_FAILURE') return 'provider_failure';
  if (code === 'INVALID_STRUCTURED_OUTPUT') return 'invalid_structured_output';
  if (code === 'INTERNAL_ERROR') return 'internal_error';
  return 'internal_error';
}

/**
 * Defensive Client-side validation of a 200 response. The Server remains the
 * authority that builds candidates and validates the OpenAI output; this only
 * prevents a malformed response from entering Client state.
 */
function validatePlanResponse(
  body: unknown,
  input: TrainingPlanApplicationInput,
): ValidatedTrainingPlan | undefined {
  if (!isPlanResponse(body)) return undefined;

  try {
    const candidates = buildTrainingCandidates({
      equipmentProfile: {
        id: TRAINING_PLAN_RESPONSE_PROFILE_ID,
        displayName: TRAINING_PLAN_RESPONSE_PROFILE_NAME,
        availableEquipmentIds: input.equipmentIds,
      },
      mainExerciseId: input.mainExerciseId,
      targetMuscles: input.sessionFocus.targetMuscles,
      ...(input.sessionFocus.targetMovementPatterns === undefined
        ? {}
        : { targetMovementPatterns: input.sessionFocus.targetMovementPatterns }),
    });
    const validation = validateTrainingPlanDraft(body.plan, candidates);
    return validation.valid ? validation.plan : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One Client-to-Server request only. Caching, duplicate suppression, retry,
 * and Adventure Session state are intentionally outside this boundary.
 */
export async function requestTrainingPlan(
  input: TrainingPlanApplicationInput,
  options: { readonly request?: typeof fetch } = {},
): Promise<TrainingPlanApplicationResult> {
  const requestBody = {
    equipmentIds: input.equipmentIds,
    trainingExperienceMonths: input.trainingExperienceMonths,
    mainExerciseId: input.mainExerciseId,
    sessionFocus: input.sessionFocus,
  };

  let response: Response;
  try {
    response = await (options.request ?? fetch)('/api/training-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return { status: 'training_plan_request_failed', code: 'network_error' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'training_plan_request_failed', code: 'invalid_response' };
  }

  if (response.status !== 200) {
    return { status: 'training_plan_request_failed', code: mapServerError(body) };
  }

  const plan = validatePlanResponse(body, input);
  return plan === undefined
    ? { status: 'training_plan_request_failed', code: 'invalid_response' }
    : { status: 'training_plan_ready', plan };
}
