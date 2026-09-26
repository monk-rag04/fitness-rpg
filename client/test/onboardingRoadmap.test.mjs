import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBrowserLocalStartDate,
  startOnboardingRoadmap,
} from '../src/application/onboardingRoadmap.ts';

const draft = {
  bodyWeightKg: 72,
  trainingExperienceMonths: 8,
  trainingFrequencyPerWeek: 3,
  mainExerciseId: 'barbell_back_squat',
  baselineWeightKg: 60,
  baselineReps: 5,
  finalGoalE1rmKg: 80,
};
const now = new Date(2026, 8, 22, 12);

test('captures the browser local calendar date without an input startDate', () => {
  assert.equal(getBrowserLocalStartDate(now), '2026-09-22');
});

test('valid input calls only the backend endpoint and creates a matching roadmap', async () => {
  let calls = 0;
  const result = await startOnboardingRoadmap(draft, {
    now,
    request: async (url, init) => {
      calls++;
      assert.equal(url, '/api/achievement-duration');
      assert.equal(init.method, 'POST');
      assert.deepEqual(JSON.parse(init.body), {
        exerciseId: 'barbell_back_squat',
        currentE1rmKg: 70,
        stageTargetE1rmKg: 75,
        trainingExperienceMonths: 8,
        trainingFrequencyPerWeek: 3,
      });
      return Response.json({ estimatedAchievementDays: 24 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.roadmap.mainExerciseId, 'barbell_back_squat');
  assert.equal(result.roadmap.startDate, '2026-09-22');
  assert.equal(result.roadmap.durationDays, 28);
  assert.equal('trainingPlan' in result, false);
});

test('unknown baseline and invalid input never call the endpoint', async () => {
  let calls = 0;
  const request = async () => { calls++; return Response.json({ estimatedAchievementDays: 24 }); };
  const baseline = await startOnboardingRoadmap({
    ...draft, baselineWeightKg: null, baselineReps: null,
  }, { now, request });
  assert.equal(baseline.status, 'baseline_required');
  const invalid = await startOnboardingRoadmap({ ...draft, mainExerciseId: 'pull_up' }, { now, request });
  assert.equal(invalid.status, 'invalid_input');
  const suppliedDate = await startOnboardingRoadmap({ ...draft, startDate: '2026-09-22' }, { now, request });
  assert.equal(suppliedDate.status, 'invalid_input');
  assert.equal(calls, 0);
});

test('43-day response never creates a roadmap or substitutes the demo duration', async () => {
  const result = await startOnboardingRoadmap(draft, {
    now,
    request: async () => Response.json({ estimatedAchievementDays: 43 }),
  });
  assert.deepEqual(result, { status: 'stage_replanning_required', estimatedAchievementDays: 43 });
  assert.equal('roadmap' in result, false);
});

test('unknown strength makes one provider request and uses the established 42-day fallback', async () => {
  let calls = 0;
  const result = await startOnboardingRoadmap({
    bodyWeightKg: 60,
    trainingExperienceMonths: 1,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    strengthKnowledge: 'unknown',
  }, {
    now,
    request: async (_url, init) => {
      calls++;
      const input = JSON.parse(init.body);
      assert.equal(input.exerciseId, 'barbell_bench_press');
      assert.ok(input.currentE1rmKg > 0);
      assert.ok(input.stageTargetE1rmKg > input.currentE1rmKg);
      return Response.json({ estimatedAchievementDays: 60 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.selectedRoadmapDurationDays, 42);
  assert.equal(result.baseline.source, 'estimated_profile');
});

test('provider and malformed output failures remain explicit without leaking details', async () => {
  const provider = await startOnboardingRoadmap(draft, {
    now,
    request: async () => Response.json({ error: { code: 'PROVIDER_FAILURE', raw: 'secret' } }, { status: 502 }),
  });
  assert.deepEqual(provider, { status: 'duration_request_failed', code: 'provider_failure' });
  const malformed = await startOnboardingRoadmap(draft, {
    now,
    request: async () => Response.json({ estimatedAchievementDays: 0 }),
  });
  assert.deepEqual(malformed, { status: 'invalid_duration_estimate' });
  const network = await startOnboardingRoadmap(draft, {
    now,
    request: async () => { throw new Error('secret transport detail'); },
  });
  assert.deepEqual(network, { status: 'duration_request_failed', code: 'network_error' });
});
