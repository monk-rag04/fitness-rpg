import type {
  AchievementDurationEstimate,
  AchievementDurationEstimatorInput,
} from '@fitness-rpg/shared';
import {
  validateAchievementDurationEstimate,
  validateAchievementDurationEstimatorInput,
} from '@fitness-rpg/shared';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from 'openai';
import type OpenAI from 'openai';

import { createOpenAIClient, getOpenAIModel } from './client.js';
import { achievementDurationEstimateFormat } from './achievementDurationSchema.js';

export const ACHIEVEMENT_DURATION_ESTIMATOR_PROMPT_VERSION = 'achievement-duration-estimator-prompt-v1';

export type AchievementDurationGenerationErrorCode =
  | 'INVALID_INPUT'
  | 'OPENAI_API_ERROR'
  | 'STRUCTURED_OUTPUT_MISSING'
  | 'DOMAIN_VALIDATION_FAILED';

export type AchievementDurationStructuredOutputDiagnosticReason =
  | 'response_not_completed'
  | 'output_text_missing'
  | 'json_parse_failed'
  | 'domain_validation_failed';

export type AchievementDurationResponseStatus =
  | 'completed'
  | 'failed'
  | 'in_progress'
  | 'cancelled'
  | 'queued'
  | 'incomplete'
  | 'unknown';

export type AchievementDurationProviderFailureKind =
  | 'bad_request'
  | 'authentication'
  | 'permission_denied'
  | 'not_found'
  | 'rate_limit'
  | 'server_error'
  | 'connection_error'
  | 'timeout'
  | 'unknown_provider_error';

export interface AchievementDurationProviderFailureDiagnostic {
  readonly kind: AchievementDurationProviderFailureKind;
  readonly status?: number;
  /** Safe machine-readable provider code; only retained for rate-limit failures. */
  readonly code?: string;
  /** Safe low-level connection/timeout code from the SDK error cause. */
  readonly causeCode?: string;
  /** SDK class name, retained only as a safe identifier for internal diagnostics. */
  readonly sdkErrorName?: string;
  /** Safe provider error type identifier, when available. */
  readonly type?: string;
}

export interface AchievementDurationStructuredOutputDiagnostic {
  readonly reason: AchievementDurationStructuredOutputDiagnosticReason;
  readonly responseStatus?: AchievementDurationResponseStatus;
}

export class AchievementDurationGenerationError extends Error {
  public readonly name = 'AchievementDurationGenerationError';

  public constructor(
    public readonly code: AchievementDurationGenerationErrorCode,
    message: string,
    public readonly diagnostic?: AchievementDurationStructuredOutputDiagnostic,
    public readonly providerDiagnostic?: AchievementDurationProviderFailureDiagnostic,
  ) {
    super(message);
  }
}

const RESPONSE_STATUSES: readonly AchievementDurationResponseStatus[] = [
  'completed',
  'failed',
  'in_progress',
  'cancelled',
  'queued',
  'incomplete',
];

function toSafeResponseStatus(status: unknown): AchievementDurationResponseStatus {
  return typeof status === 'string' && RESPONSE_STATUSES.includes(status as AchievementDurationResponseStatus)
    ? status as AchievementDurationResponseStatus
    : 'unknown';
}

function logStructuredOutputFailure(diagnostic: AchievementDurationStructuredOutputDiagnostic): void {
  // Keep production logs quiet while allowing the development server to expose
  // a one-line, non-sensitive diagnostic. No response or input content is logged.
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return;
  const responseStatus = diagnostic.responseStatus === undefined
    ? ''
    : ` responseStatus=${diagnostic.responseStatus}`;
  console.warn(
    `[achievement-duration] structured_output_failure reason=${diagnostic.reason}${responseStatus}`,
  );
}

function toSafeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    return undefined;
  }
  return value;
}

function getSafeSdkErrorName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const constructorName = (error as { readonly constructor?: { readonly name?: unknown } }).constructor?.name;
  return toSafeIdentifier(constructorName);
}

function getProviderStatus(error: APIError): number | undefined {
  return typeof error.status === 'number' && Number.isInteger(error.status)
    ? error.status
    : undefined;
}

function getSafeCauseCode(error: APIConnectionError): string | undefined {
  const seen = new Set<object>();
  let current: unknown = error;

  // Read only the bounded cause chain. This preserves a useful low-level
  // transport code without retaining an error message, stack, response body,
  // or any other provider content.
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null || seen.has(current)) {
      return undefined;
    }
    seen.add(current);

    const cause = (current as { readonly cause?: unknown }).cause;
    if (typeof cause !== 'object' || cause === null || seen.has(cause)) {
      return undefined;
    }

    const causeCode = toSafeIdentifier((cause as { readonly code?: unknown }).code);
    if (causeCode !== undefined) return causeCode;

    current = cause;
  }

  return undefined;
}

function classifyProviderStatus(status: number | undefined): AchievementDurationProviderFailureKind {
  if (status === 400 || status === 422) return 'bad_request';
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission_denied';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status !== undefined && status >= 500) return 'server_error';
  return 'unknown_provider_error';
}

/**
 * Converts an OpenAI SDK failure into safe, machine-readable metadata.
 * Error messages, parsed bodies, headers, request input, and credentials are
 * intentionally excluded.
 */
export function classifyOpenAIProviderError(
  error: unknown,
): AchievementDurationProviderFailureDiagnostic {
  const sdkErrorName = getSafeSdkErrorName(error);
  if (error instanceof APIConnectionTimeoutError) {
    const causeCode = getSafeCauseCode(error);
    return {
      kind: 'timeout',
      ...(causeCode === undefined ? {} : { causeCode }),
      ...(sdkErrorName === undefined ? {} : { sdkErrorName }),
    };
  }
  if (error instanceof APIConnectionError) {
    const causeCode = getSafeCauseCode(error);
    return {
      kind: 'connection_error',
      ...(causeCode === undefined ? {} : { causeCode }),
      ...(sdkErrorName === undefined ? {} : { sdkErrorName }),
    };
  }
  if (!(error instanceof APIError)) {
    return { kind: 'unknown_provider_error', sdkErrorName };
  }

  const status = getProviderStatus(error);
  const kind = classifyProviderStatus(status);
  const code = kind === 'rate_limit' ? toSafeIdentifier(error.code) : undefined;
  const type = toSafeIdentifier(error.type);
  return {
    kind,
    ...(status === undefined ? {} : { status }),
    ...(code === undefined ? {} : { code }),
    ...(sdkErrorName === undefined ? {} : { sdkErrorName }),
    ...(type === undefined ? {} : { type }),
  };
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
      { reason: 'json_parse_failed' },
    );
  }

  const validation = validateAchievementDurationEstimate(output);
  if (!validation.valid) {
    throw new AchievementDurationGenerationError(
      'DOMAIN_VALIDATION_FAILED',
      `Achievement duration estimate failed domain validation: ${validation.errors.map((error) => error.code).join(', ')}`,
      { reason: 'domain_validation_failed' },
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
  } catch (error) {
    // SDK errors can include request details. Do not surface them or a key.
    throw new AchievementDurationGenerationError(
      'OPENAI_API_ERROR',
      'OpenAI request failed.',
      undefined,
      classifyOpenAIProviderError(error),
    );
  }

  const responseStatus = toSafeResponseStatus(response.status);
  if (response.status !== 'completed') {
    const diagnostic = { reason: 'response_not_completed' as const, responseStatus };
    logStructuredOutputFailure(diagnostic);
    throw new AchievementDurationGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'The OpenAI response did not contain a completed structured output.',
      diagnostic,
    );
  }

  const outputText = response.output_text;
  if (typeof outputText !== 'string' || outputText.trim() === '') {
    const diagnostic = { reason: 'output_text_missing' as const, responseStatus };
    logStructuredOutputFailure(diagnostic);
    throw new AchievementDurationGenerationError(
      'STRUCTURED_OUTPUT_MISSING',
      'The OpenAI response did not contain a completed structured output.',
      diagnostic,
    );
  }

  try {
    return validateGeneratedAchievementDurationEstimate(outputText);
  } catch (error) {
    if (error instanceof AchievementDurationGenerationError && error.diagnostic !== undefined) {
      logStructuredOutputFailure({
        ...error.diagnostic,
        responseStatus,
      });
    }
    throw error;
  }
}
