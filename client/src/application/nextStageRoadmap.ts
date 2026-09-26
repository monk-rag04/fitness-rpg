import {
  completeNextStageRoadmap,
  prepareNextStageRoadmap,
  type NextStageRoadmapInput,
  type NextStageRoadmapPreparation,
} from '@fitness-rpg/shared';
import { getBrowserLocalStartDate } from './onboardingRoadmap';

export type NextStageRoadmapApplicationResult =
  | Exclude<NextStageRoadmapPreparation, { readonly status: 'ready_for_duration_estimate' }>
  | { readonly status: 'roadmap_request_failed'; readonly code: 'network_error' | 'invalid_response' | 'server_error' }
  | Extract<ReturnType<typeof completeNextStageRoadmap>, { readonly status: 'roadmap_created' | 'stage_replanning_required' | 'invalid_duration_estimate' }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reuse the existing achievement-duration endpoint for an explicit Next Stage action. */
export async function requestNextStageRoadmap(
  input: Omit<NextStageRoadmapInput, 'startDate'>,
  options: { readonly now?: Date; readonly request?: typeof fetch } = {},
): Promise<NextStageRoadmapApplicationResult> {
  const prepared = prepareNextStageRoadmap({ ...input, startDate: getBrowserLocalStartDate(options.now) });
  if (prepared.status !== 'ready_for_duration_estimate') return prepared;

  let response: Response;
  try {
    response = await (options.request ?? fetch)('/api/achievement-duration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prepared.durationInput),
    });
  } catch {
    return { status: 'roadmap_request_failed', code: 'network_error' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'roadmap_request_failed', code: 'invalid_response' };
  }
  if (!response.ok) {
    return { status: 'roadmap_request_failed', code: 'server_error' };
  }
  if (!isRecord(body)) return { status: 'roadmap_request_failed', code: 'invalid_response' };
  return completeNextStageRoadmap(prepared, body);
}
