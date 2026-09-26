import {
  completeOnboardingRoadmap,
  prepareOnboardingRoadmap,
  type OnboardingRoadmapCompletionResult,
  type OnboardingRoadmapPreparationResult,
} from '@fitness-rpg/shared';

type DurationRequestFailureCode =
  | 'invalid_request'
  | 'provider_failure'
  | 'invalid_structured_output'
  | 'network_error'
  | 'server_error';

export type OnboardingRoadmapApplicationResult =
  | Exclude<OnboardingRoadmapPreparationResult, { readonly status: 'ready_for_duration_estimate' }>
  | Exclude<OnboardingRoadmapCompletionResult, { readonly status: 'reduced_target_estimate_required' }>
  | { readonly status: 'duration_request_failed'; readonly code: DurationRequestFailureCode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type DurationEstimateRequestResult =
  | { readonly status: 'success'; readonly body: unknown }
  | { readonly status: 'failure'; readonly code: DurationRequestFailureCode };

async function requestDurationEstimate(
  input: unknown,
  request: typeof fetch,
): Promise<DurationEstimateRequestResult> {
  let response: Response;
  try {
    response = await request('/api/achievement-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { status: 'failure', code: 'network_error' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'failure', code: 'invalid_structured_output' };
  }
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error.code : undefined;
    const code: DurationRequestFailureCode = error === 'INVALID_REQUEST'
      ? 'invalid_request'
      : error === 'PROVIDER_FAILURE'
        ? 'provider_failure'
        : error === 'INVALID_STRUCTURED_OUTPUT'
          ? 'invalid_structured_output'
          : 'server_error';
    return { status: 'failure', code };
  }
  return { status: 'success', body };
}

/** Capture the browser's local calendar date once, at the start action. */
export function getBrowserLocalStartDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Called by the Production Onboarding UI; Demo Map/Quest keep using their isolated fixture. */
export async function startOnboardingRoadmap(
  draft: unknown,
  options: { readonly now?: Date; readonly request?: typeof fetch } = {},
): Promise<OnboardingRoadmapApplicationResult> {
  if (!isRecord(draft)) {
    return { status: 'invalid_input', errors: [{ code: 'INVALID_INPUT_SHAPE', path: 'input' }] };
  }
  if (Object.hasOwn(draft, 'startDate')) {
    return { status: 'invalid_input', errors: [{ code: 'UNKNOWN_FIELD', path: 'input.startDate' }] };
  }

  const prepared = prepareOnboardingRoadmap({
    ...draft,
    startDate: getBrowserLocalStartDate(options.now),
  });
  if (prepared.status !== 'ready_for_duration_estimate') return prepared;

  const request = options.request ?? fetch;
  const firstEstimate = await requestDurationEstimate(prepared.durationInput, request);
  if (firstEstimate.status === 'failure') {
    return { status: 'duration_request_failed', code: firstEstimate.code };
  }

  const firstCompletion = completeOnboardingRoadmap(prepared, firstEstimate.body);
  if (firstCompletion.status !== 'reduced_target_estimate_required') return firstCompletion;

  const reducedTargetEstimate = await requestDurationEstimate({
    ...prepared.durationInput,
    stageTargetE1rmKg: firstCompletion.reducedStageTargetE1rmKg,
  }, request);
  if (reducedTargetEstimate.status === 'failure') {
    return { status: 'duration_request_failed', code: reducedTargetEstimate.code };
  }
  const completed = completeOnboardingRoadmap(prepared, firstEstimate.body, reducedTargetEstimate.body);
  return completed.status === 'reduced_target_estimate_required'
    ? { status: 'invalid_duration_estimate' }
    : completed;
}
