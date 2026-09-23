import {
  buildTrainingCandidates,
  getCanonicalStageTrainingDays,
  validateStageTrainingProgram,
  type EquipmentId,
  type ExerciseId,
  type StageRoadmap,
  type StageTrainingProgramValidationContext,
  type ValidatedStageTrainingProgram,
} from '@fitness-rpg/shared';

export interface StageTrainingProgramApplicationInput {
  readonly equipmentIds: readonly EquipmentId[];
  readonly mainExerciseId: ExerciseId;
  readonly currentE1rmKg: number;
  readonly stageTargetE1rmKg: number;
  readonly trainingExperienceMonths: number;
  readonly trainingFrequencyPerWeek: number;
  readonly roadmap: StageRoadmap;
}

export type StageTrainingProgramRequestFailureCode =
  | 'invalid_request'
  | 'main_exercise_unavailable'
  | 'provider_failure'
  | 'invalid_structured_output'
  | 'internal_error'
  | 'invalid_response'
  | 'network_error';

export type StageTrainingProgramApplicationResult =
  | {
    readonly status: 'stage_training_program_ready';
    readonly program: ValidatedStageTrainingProgram;
  }
  | {
    readonly status: 'stage_training_program_request_failed';
    readonly code: StageTrainingProgramRequestFailureCode;
  };

const STAGE_TRAINING_PROGRAM_RESPONSE_PROFILE_ID =
  'client-stage-training-program-response-validation';
const STAGE_TRAINING_PROGRAM_RESPONSE_PROFILE_NAME =
  'Client Stage Program response validation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStageTrainingProgramResponse(
  value: unknown,
): value is { readonly program: unknown } {
  return isRecord(value) &&
    Object.keys(value).length === 1 &&
    Object.hasOwn(value, 'program');
}

function mapServerError(
  body: unknown,
): StageTrainingProgramRequestFailureCode {
  const code = isRecord(body) && isRecord(body.error) ? body.error.code : undefined;
  if (code === 'INVALID_REQUEST') return 'invalid_request';
  if (code === 'MAIN_EXERCISE_UNAVAILABLE') return 'main_exercise_unavailable';
  if (code === 'PROVIDER_FAILURE') return 'provider_failure';
  if (code === 'INVALID_STRUCTURED_OUTPUT') return 'invalid_structured_output';
  if (code === 'INTERNAL_ERROR') return 'internal_error';
  return 'internal_error';
}

/**
 * Rebuild the same per-Training-Day Candidate Context used by the Server.
 * This is defensive response validation only; it never sends candidates or
 * replaces the Server as the security boundary.
 */
function buildResponseValidationContext(
  input: StageTrainingProgramApplicationInput,
): StageTrainingProgramValidationContext {
  const equipmentProfile = {
    id: STAGE_TRAINING_PROGRAM_RESPONSE_PROFILE_ID,
    displayName: STAGE_TRAINING_PROGRAM_RESPONSE_PROFILE_NAME,
    availableEquipmentIds: input.equipmentIds,
  };

  return {
    roadmap: input.roadmap,
    trainingDays: getCanonicalStageTrainingDays(input.roadmap).map((day) => ({
      dayIndex: day.dayIndex,
      sessionFocus: day.sessionFocus,
      bossMainExposure: day.bossMainExposure,
      candidates: buildTrainingCandidates({
        equipmentProfile,
        bossMainExerciseId: input.mainExerciseId,
        bossMainExposure: day.bossMainExposure,
        targetMuscles: day.sessionFocus.targetMuscles,
        ...(day.sessionFocus.targetMovementPatterns === undefined
          ? {}
          : { targetMovementPatterns: day.sessionFocus.targetMovementPatterns }),
      }),
    })),
  };
}

/**
 * Defensive Client-side validation of a 200 response. The Server remains the
 * authority for public-request validation and OpenAI output validation; this
 * only prevents malformed or mismatched data from entering Client state.
 */
function validateProgramResponse(
  body: unknown,
  input: StageTrainingProgramApplicationInput,
): ValidatedStageTrainingProgram | undefined {
  if (!isStageTrainingProgramResponse(body)) return undefined;

  try {
    const validation = validateStageTrainingProgram(
      body.program,
      buildResponseValidationContext(input),
    );
    return validation.valid ? validation.program : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Make one Client-to-Server request for a complete Stage Program. Retry,
 * caching, Equipment persistence, and Adventure Session mutation remain
 * outside this application boundary.
 */
export async function requestStageTrainingProgram(
  input: StageTrainingProgramApplicationInput,
  options: { readonly request?: typeof fetch } = {},
): Promise<StageTrainingProgramApplicationResult> {
  const requestBody = {
    equipmentIds: input.equipmentIds,
    mainExerciseId: input.mainExerciseId,
    currentE1rmKg: input.currentE1rmKg,
    stageTargetE1rmKg: input.stageTargetE1rmKg,
    trainingExperienceMonths: input.trainingExperienceMonths,
    trainingFrequencyPerWeek: input.trainingFrequencyPerWeek,
    roadmap: input.roadmap,
  };

  let response: Response;
  try {
    response = await (options.request ?? fetch)('/api/stage-training-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return { status: 'stage_training_program_request_failed', code: 'network_error' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'stage_training_program_request_failed', code: 'invalid_response' };
  }

  if (response.status !== 200) {
    return {
      status: 'stage_training_program_request_failed',
      code: mapServerError(body),
    };
  }

  const program = validateProgramResponse(body, input);
  return program === undefined
    ? { status: 'stage_training_program_request_failed', code: 'invalid_response' }
    : { status: 'stage_training_program_ready', program };
}
