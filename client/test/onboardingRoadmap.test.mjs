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

test('an estimate over 28 makes one reduced-target request and caps Stage 1 at 28 days', async () => {
  let calls = 0;
  const result = await startOnboardingRoadmap(draft, {
    now,
    request: async (_url, init) => {
      calls++;
      const input = JSON.parse(init.body);
      assert.equal(input.stageTargetE1rmKg, calls === 1 ? 75 : 72.5);
      return Response.json({ estimatedAchievementDays: 43 });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.estimatedAchievementDays, 43);
  assert.equal(result.selectedRoadmapDurationDays, 28);
  assert.equal(result.roadmap.stageTargetE1rmKg, 72.5);
});

test('unknown strength shares the Stage 1 reduced-target rule and remains within 28 days', async () => {
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
      if (calls === 1) return Response.json({ estimatedAchievementDays: 45 });
      assert.equal(input.stageTargetE1rmKg, input.currentE1rmKg + 2.5);
      return Response.json({ estimatedAchievementDays: 19 });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.selectedRoadmapDurationDays, 21);
  assert.equal(result.quickStart.quickStartAdjusted, true);
  assert.equal(result.baseline.source, 'estimated_profile');
});

test('second estimate failure is retryable and does not create a replacement roadmap', async () => {
  let calls = 0;
  const result = await startOnboardingRoadmap(draft, {
    now,
    request: async () => {
      calls++;
      return calls === 1
        ? Response.json({ estimatedAchievementDays: 35 })
        : Response.json({ error: { code: 'PROVIDER_FAILURE' } }, { status: 502 });
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { status: 'duration_request_failed', code: 'provider_failure' });
});

test('a final-goal-capped target avoids a redundant second estimate', async () => {
  const result = await startOnboardingRoadmap({
    ...draft,
    finalGoalE1rmKg: 72.5,
  }, {
    now,
    request: async () => Response.json({ estimatedAchievementDays: 35 }),
  });
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.quickStart.originalPlannedStageTargetE1rmKg, 72.5);
  assert.equal(result.quickStart.selectedStageTargetE1rmKg, 72.5);
  assert.equal(result.selectedRoadmapDurationDays, 28);
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
