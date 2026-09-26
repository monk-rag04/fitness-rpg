import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOSS_TARGET_RULE_VERSION,
  challengeBoss,
  completeNextStageRoadmap,
  generateStageRoadmap,
  getBestClearedMainE1rmKg,
  prepareNextStageRoadmap,
  unlockBossBattle,
} from '../dist/index.js';

function roadmap() {
  return generateStageRoadmap({
    startDate: '2026-09-26',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    stageTargetE1rmKg: 60,
  });
}

function result(overrides = {}) {
  return {
    plannedExerciseId: 'barbell_bench_press',
    performedExerciseId: 'barbell_bench_press',
    role: 'main',
    plannedSets: 3,
    plannedRepRange: { min: 5, max: 8 },
    completedSets: [{ setNumber: 1, weightKg: 70, reps: 5 }],
    performedAt: '2026-09-26T09:00:00.000Z',
    ...overrides,
  };
}

function unlock(overrides = {}) {
  const value = roadmap();
  return unlockBossBattle({
    roadmap: value,
    progress: { currentDayIndex: value.days.length },
    finalGoalE1rmKg: 90,
    ...overrides,
  });
}

test('Boss is locked until every daily quest is complete, then freezes the Stage target rule', () => {
  const value = roadmap();
  assert.deepEqual(unlock({ progress: { currentDayIndex: value.days.length - 1 } }), { status: 'locked' });
  const result = unlock();
  assert.equal(result.status, 'unlocked');
  assert.equal(result.bossBattle.ruleVersion, BOSS_TARGET_RULE_VERSION);
  assert.equal(result.bossBattle.originalStageTargetE1rmKg, 60);
  assert.equal(result.bossBattle.targetE1rmKg, 60);
  assert.equal(result.bossBattle.adapted, false);
});

test('Boss target adapts from cleared actual Main sets and remains capped by Final Goal', () => {
  const value = roadmap();
  const best = getBestClearedMainE1rmKg(value, { currentDayIndex: 1 }, {
    0: { main: result() },
    1: { main: result({ completedSets: [{ setNumber: 1, weightKg: 200, reps: 5 }] }) },
  });
  assert.equal(best, 70 * (1 + 5 / 30));
  const adapted = unlock({ bestActualMainE1rmKg: best });
  assert.equal(adapted.status, 'unlocked');
  assert.equal(adapted.bossBattle.targetE1rmKg, best * 1.03);
  assert.equal(adapted.bossBattle.adapted, true);
  const capped = unlock({ bestActualMainE1rmKg: 100 });
  assert.equal(capped.status, 'unlocked');
  assert.equal(capped.bossBattle.targetE1rmKg, 90);
});

test('uncleared days and non-Main performed exercises are not Boss target evidence', () => {
  const value = roadmap();
  assert.equal(getBestClearedMainE1rmKg(value, { currentDayIndex: 0 }, { 0: { main: result() } }), undefined);
  assert.equal(getBestClearedMainE1rmKg(value, { currentDayIndex: 1 }, {
    0: { accessory: result({ plannedExerciseId: 'dumbbell_curl', performedExerciseId: 'dumbbell_curl', role: 'accessory' }) },
  }), undefined);
});

test('Boss challenge validates access, fixed Main, weight and 1–10 rep eligibility', () => {
  const value = roadmap();
  const bossBattle = unlock().bossBattle;
  const common = { bossBattle, currentDayIndex: value.days.length, dailyQuestCount: value.days.length, mainExerciseId: value.mainExerciseId, exerciseId: value.mainExerciseId, weightKg: 60, reps: 5 };
  assert.equal(challengeBoss({ ...common, bossBattle: undefined }).status, 'boss_locked');
  assert.equal(challengeBoss({ ...common, currentDayIndex: 0 }).status, 'boss_locked');
  assert.equal(challengeBoss({ ...common, exerciseId: 'barbell_back_squat' }).status, 'exercise_mismatch');
  assert.equal(challengeBoss({ ...common, weightKg: 0 }).status, 'invalid_weight');
  assert.equal(challengeBoss({ ...common, reps: 11 }).status, 'invalid_reps');
  assert.equal(challengeBoss({ ...common, reps: 2.5 }).status, 'invalid_reps');
});

test('below target is retryable with unchanged Boss state; exact and above target win once', () => {
  const value = roadmap();
  const bossBattle = unlock().bossBattle;
  const common = { bossBattle, currentDayIndex: value.days.length, dailyQuestCount: value.days.length, mainExerciseId: value.mainExerciseId, exerciseId: value.mainExerciseId };
  const defeat = challengeBoss({ ...common, weightKg: 40, reps: 5 });
  assert.equal(defeat.status, 'defeat');
  assert.equal(defeat.bossBattle, bossBattle);
  assert.equal(bossBattle.defeated, false);
  const exactBattle = { ...bossBattle, targetE1rmKg: 50 };
  const exact = challengeBoss({ ...common, bossBattle: exactBattle, weightKg: 50, reps: 1 });
  assert.equal(exact.status, 'victory');
  assert.equal(exact.attempt.estimatedE1rmKg, 50);
  assert.equal(exact.bossBattle.defeated, true);
  assert.equal(challengeBoss({ ...common, bossBattle: exact.bossBattle, weightKg: 70, reps: 1 }).status, 'already_defeated');
  const above = challengeBoss({ ...common, bossBattle: exactBattle, weightKg: 60, reps: 1 });
  assert.equal(above.status, 'victory');
});

test('next Stage preparation reuses D-025 target step and does not replace it with Final Goal', () => {
  const prepared = prepareNextStageRoadmap({
    currentE1rmKg: 72,
    finalGoalE1rmKg: 90,
    mainExerciseId: 'barbell_bench_press',
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: 3,
    startDate: '2026-10-01',
  });
  assert.equal(prepared.status, 'ready_for_duration_estimate');
  assert.equal(prepared.stageTargetE1rmKg, 77);
  assert.equal(prepared.durationInput.currentE1rmKg, 72);
  assert.equal(prepareNextStageRoadmap({
    currentE1rmKg: 72, finalGoalE1rmKg: 90, mainExerciseId: 'barbell_bench_press',
    trainingExperienceMonths: 8, trainingFrequencyPerWeek: 3, startDate: '2026-10-01', extra: true,
  }).status, 'invalid_input');
  const created = completeNextStageRoadmap(prepared, { estimatedAchievementDays: 21 });
  assert.equal(created.status, 'roadmap_created');
  assert.equal(created.roadmap.stageTargetE1rmKg, 77);
  assert.equal(created.progress.currentDayIndex, 0);
  assert.equal(completeNextStageRoadmap(prepared, { estimatedAchievementDays: 60 }).status, 'stage_replanning_required');
  assert.equal(prepareNextStageRoadmap({
    currentE1rmKg: 90,
    finalGoalE1rmKg: 90,
    mainExerciseId: 'barbell_bench_press',
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: 3,
    startDate: '2026-10-01',
  }).status, 'goal_reached');
});
