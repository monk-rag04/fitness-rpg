import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');
const { requestNextStageRoadmap } = await import('../src/application/nextStageRoadmap.ts');

test('explicit Next Stage request reuses the achievement-duration endpoint once and preserves D-025 target', async () => {
  const calls = [];
  const result = await requestNextStageRoadmap({
    currentE1rmKg: 70,
    finalGoalE1rmKg: 90,
    mainExerciseId: 'barbell_bench_press',
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: 3,
  }, {
    now: new Date(2026, 9, 1),
    request: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ estimatedAchievementDays: 14 }) };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/achievement-duration');
  const payload = JSON.parse(calls[0].init.body);
  assert.deepEqual(payload, {
    exerciseId: 'barbell_bench_press', currentE1rmKg: 70, stageTargetE1rmKg: 75,
    trainingExperienceMonths: 8, trainingFrequencyPerWeek: 3,
  });
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.roadmap.startDate, '2026-10-01');
  assert.equal(result.roadmap.stageTargetE1rmKg, 75);
  assert.equal(result.progress.currentDayIndex, 0);
});

test('Final Goal reached avoids a duration request', async () => {
  let calls = 0;
  const result = await requestNextStageRoadmap({
    currentE1rmKg: 90, finalGoalE1rmKg: 90, mainExerciseId: 'barbell_bench_press',
    trainingExperienceMonths: 8, trainingFrequencyPerWeek: 3,
  }, { request: async () => { calls += 1; throw new Error('should not request'); } });
  assert.equal(result.status, 'goal_reached');
  assert.equal(calls, 0);
});

test('duration over 42 days is recoverable and does not create a replacement Roadmap', async () => {
  const result = await requestNextStageRoadmap({
    currentE1rmKg: 70, finalGoalE1rmKg: 90, mainExerciseId: 'barbell_bench_press',
    trainingExperienceMonths: 8, trainingFrequencyPerWeek: 3,
  }, { request: async () => ({ ok: true, json: async () => ({ estimatedAchievementDays: 60 }) }) });
  assert.equal(result.status, 'stage_replanning_required');
  assert.equal(result.estimatedAchievementDays, 60);
});
