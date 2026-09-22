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
  | OnboardingRoadmapCompletionResult
  | { readonly status: 'duration_request_failed'; readonly code: DurationRequestFailureCode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  let response: Response;
  try {
    response = await (options.request ?? fetch)('/api/achievement-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prepared.durationInput),
    });
  } catch {
    return { status: 'duration_request_failed', code: 'network_error' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'duration_request_failed', code: 'invalid_structured_output' };
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
    return { status: 'duration_request_failed', code };
  }
  return completeOnboardingRoadmap(prepared, body);
}
