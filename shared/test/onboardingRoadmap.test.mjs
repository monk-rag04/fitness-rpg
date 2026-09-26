import assert from 'node:assert/strict';
import test from 'node:test';

import {
  E1RM_RULE,
  calculateSetE1rm,
  completeOnboardingRoadmap,
  prepareOnboardingRoadmap,
  validateOnboardingRoadmapInput,
} from '../dist/index.js';

const validInput = {
  bodyWeightKg: 72,
  trainingExperienceMonths: 8,
  trainingFrequencyPerWeek: 3,
  mainExerciseId: 'barbell_bench_press',
  baselineWeightKg: 60,
  baselineReps: 5,
  finalGoalE1rmKg: 80,
  startDate: '2026-09-22',
};

function rejects(patch, code) {
  const result = validateOnboardingRoadmapInput({ ...validInput, ...patch });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === code), JSON.stringify(result.errors));
}

test('accepts valid self-report and keeps it distinct from Workout History', () => {
  const result = validateOnboardingRoadmapInput(validInput);
  assert.equal(result.valid, true);
  assert.equal(result.baseline.source, 'onboarding_self_reported');
  assert.equal(result.baseline.exerciseId, validInput.mainExerciseId);
  assert.equal(result.baseline.baselineE1rmKg, calculateSetE1rm({ weightKg: 60, reps: 5 }).estimated1rmKg);
  assert.equal(result.baseline.ruleVersion, E1RM_RULE.version);
  assert.equal('currentE1rmKg' in result.baseline, false);
});

test('all four D-023 boss main exercises are selectable for onboarding', () => {
  for (const mainExerciseId of [
    'barbell_bench_press',
    'barbell_back_squat',
    'barbell_deadlift',
    'barbell_overhead_press',
  ]) {
    const result = validateOnboardingRoadmapInput({ ...validInput, mainExerciseId });
    assert.equal(result.valid, true, mainExerciseId);
  }
});

test('rejects invalid onboarding fields, including unsupported and unknown exercises', () => {
  rejects({ bodyWeightKg: 0 }, 'INVALID_BODY_WEIGHT');
  rejects({ bodyWeightKg: Infinity }, 'INVALID_BODY_WEIGHT');
  rejects({ trainingExperienceMonths: -1 }, 'INVALID_TRAINING_EXPERIENCE_MONTHS');
  rejects({ trainingExperienceMonths: 1.5 }, 'INVALID_TRAINING_EXPERIENCE_MONTHS');
  rejects({ trainingFrequencyPerWeek: 0 }, 'INVALID_TRAINING_FREQUENCY');
  rejects({ trainingFrequencyPerWeek: 8 }, 'INVALID_TRAINING_FREQUENCY');
  rejects({ mainExerciseId: 'pull_up' }, 'MAIN_EXERCISE_NOT_BOSS_ELIGIBLE');
  rejects({ mainExerciseId: 'missing_exercise' }, 'UNKNOWN_MAIN_EXERCISE');
  rejects({ baselineReps: 0 }, 'INVALID_BASELINE_REPS');
  rejects({ baselineReps: 11 }, 'INVALID_BASELINE_REPS');
  rejects({ baselineWeightKg: 0 }, 'INVALID_BASELINE_WEIGHT');
  rejects({ baselineWeightKg: Infinity }, 'INVALID_BASELINE_WEIGHT');
  rejects({ baselineWeightKg: 1.7e308 }, 'INVALID_BASELINE_ESTIMATE');
  rejects({ finalGoalE1rmKg: Infinity }, 'INVALID_FINAL_GOAL');
  rejects({ startDate: '2026-02-30' }, 'INVALID_START_DATE');
  rejects({ startDate: '2026-9-22' }, 'INVALID_START_DATE');
  rejects({ unknown: true }, 'UNKNOWN_FIELD');
  assert.equal(validateOnboardingRoadmapInput(null).errors[0].code, 'INVALID_INPUT_SHAPE');
});

test('requires both baseline fields or neither; missing baseline does not generate a stage', () => {
  rejects({ baselineReps: null }, 'BASELINE_SET_INCOMPLETE');
  rejects({ baselineWeightKg: null }, 'BASELINE_SET_INCOMPLETE');
  const result = prepareOnboardingRoadmap({ ...validInput, baselineWeightKg: null, baselineReps: null });
  assert.equal(result.status, 'baseline_required');
  assert.equal('durationInput' in result, false);
});

test('unknown strength derives a provisional baseline and a valid automatic goal before provider use', () => {
  const unknownInput = {
    bodyWeightKg: 60,
    trainingExperienceMonths: 1,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    strengthKnowledge: 'unknown',
    startDate: '2026-09-22',
  };
  const prepared = prepareOnboardingRoadmap(unknownInput);
  assert.equal(prepared.status, 'ready_for_duration_estimate');
  assert.equal(prepared.baseline.source, 'estimated_profile');
  assert.equal(prepared.baseline.estimateRuleVersion, 'main-strength-estimate-v1');
  assert.equal(prepared.baseline.reps, 5);
  assert.ok(prepared.input.finalGoalE1rmKg > prepared.baseline.baselineE1rmKg);
  assert.equal(prepared.durationInput.currentE1rmKg, prepared.baseline.baselineE1rmKg);
  assert.ok(prepared.stage.stageTargetE1rmKg <= prepared.input.finalGoalE1rmKg);
  const completed = completeOnboardingRoadmap(prepared, { estimatedAchievementDays: 28 });
  assert.equal(completed.status, 'roadmap_created');
  assert.equal(completed.roadmap.days.length, 28);
  assert.equal(completed.roadmap.mainExerciseId, unknownInput.mainExerciseId);
  assert.deepEqual(unknownInput, {
    bodyWeightKg: 60,
    trainingExperienceMonths: 1,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    strengthKnowledge: 'unknown',
    startDate: '2026-09-22',
  });
});

test('unknown strength rejects manual strength fields and invalid profile before duration request', () => {
  const unknown = {
    bodyWeightKg: 60, trainingExperienceMonths: 1,
    trainingFrequencyPerWeek: 3, mainExerciseId: 'barbell_bench_press',
    startDate: '2026-09-22', strengthKnowledge: 'unknown',
  };
  assert.equal(prepareOnboardingRoadmap({ ...unknown, bodyWeightKg: 0 }).status, 'invalid_input');
  assert.equal(prepareOnboardingRoadmap({ ...unknown, baselineWeightKg: 40 }).status, 'invalid_input');
  assert.equal(prepareOnboardingRoadmap({ ...unknown, finalGoalE1rmKg: 60 }).status, 'invalid_input');
  assert.equal(prepareOnboardingRoadmap({ ...unknown, mainExerciseId: 'push_up' }).status, 'invalid_input');
});

test('1-rep baseline is actual weight, not the Epley multiplier', () => {
  const result = validateOnboardingRoadmapInput({ ...validInput, baselineReps: 1 });
  assert.equal(result.valid, true);
  assert.equal(result.baseline.baselineE1rmKg, 60);
});

test('goal must exceed the unrounded self-reported baseline', () => {
  const baseline = calculateSetE1rm({ weightKg: 60, reps: 5 }).estimated1rmKg;
  rejects({ finalGoalE1rmKg: baseline }, 'FINAL_GOAL_NOT_ABOVE_BASELINE');
  rejects({ finalGoalE1rmKg: baseline - 1 }, 'FINAL_GOAL_NOT_ABOVE_BASELINE');
});

test('reuses D-025 next-stage rule and final-goal cap', () => {
  const result = prepareOnboardingRoadmap(validInput);
  assert.equal(result.status, 'ready_for_duration_estimate');
  assert.equal(result.stage.stageTargetE1rmKg, result.baseline.baselineE1rmKg + 5);
  assert.deepEqual(result.durationInput, {
    exerciseId: validInput.mainExerciseId,
    currentE1rmKg: result.baseline.baselineE1rmKg,
    stageTargetE1rmKg: result.stage.stageTargetE1rmKg,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: 3,
  });

  const capped = prepareOnboardingRoadmap({ ...validInput, finalGoalE1rmKg: 71 });
  assert.equal(capped.status, 'ready_for_duration_estimate');
  assert.equal(capped.stage.stageTargetE1rmKg, 71);
});

test('valid duration creates roadmap and initial progress without a Training Plan', () => {
  const prepared = prepareOnboardingRoadmap(validInput);
  assert.equal(prepared.status, 'ready_for_duration_estimate');
  const result = completeOnboardingRoadmap(prepared, { estimatedAchievementDays: 24 });
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.input.bodyWeightKg, validInput.bodyWeightKg);
  assert.equal(result.input.trainingExperienceMonths, validInput.trainingExperienceMonths);
  assert.equal(result.selectedRoadmapDurationDays, 28);
  assert.equal(result.roadmap.days.length, 28);
  assert.equal(result.roadmap.boss.date, '2026-10-20');
  assert.deepEqual(result.progress, { currentDayIndex: 0 });
  assert.equal('trainingPlan' in result, false);
});

test('42+ estimate is explicit replanning and cannot generate a roadmap', () => {
  const prepared = prepareOnboardingRoadmap(validInput);
  assert.equal(prepared.status, 'ready_for_duration_estimate');
  const result = completeOnboardingRoadmap(prepared, { estimatedAchievementDays: 43 });
  assert.deepEqual(result, { status: 'stage_replanning_required', estimatedAchievementDays: 43 });
  assert.equal('roadmap' in result, false);
  assert.deepEqual(completeOnboardingRoadmap(prepared, { estimatedAchievementDays: 0 }), {
    status: 'invalid_duration_estimate',
  });
});

test('42+ estimate uses the established 42-day ceiling only for provisional unknown strength', () => {
  const prepared = prepareOnboardingRoadmap({
    bodyWeightKg: 60,
    trainingExperienceMonths: 1,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    strengthKnowledge: 'unknown',
    startDate: '2026-09-22',
  });
  assert.equal(prepared.status, 'ready_for_duration_estimate');
  const result = completeOnboardingRoadmap(prepared, { estimatedAchievementDays: 60 });
  assert.equal(result.status, 'roadmap_created');
  assert.equal(result.estimatedAchievementDays, 60);
  assert.equal(result.selectedRoadmapDurationDays, 42);
  assert.equal(result.roadmap.days.length, 42);
});
