import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ONBOARDING_MAIN_EXERCISES,
  createOnboardingSubmissionGate,
  createInitialOnboardingDraft,
  formatE1rmKg,
  getBaselinePreview,
  getOnboardingStepErrors,
  toOnboardingRoadmapDraft,
} from '../src/features/onboarding/onboardingState.ts';
import { createOnboardingAdventureSession } from '../src/state/adventureSession.ts';
import { createInitialStageProgress, generateStageRoadmap } from '@fitness-rpg/shared';

function validDraft(overrides = {}) {
  return {
    ...createInitialOnboardingDraft(),
    bodyWeightKg: '72',
    trainingExperienceMonths: '8',
    trainingFrequencyPerWeek: '3',
    baselineWeightKg: '60',
    baselineReps: '5',
    finalGoalE1rmKg: '80',
    ...overrides,
  };
}

test('step 1 requires positive body weight, experience months, and frequency 1..7', () => {
  const errors = getOnboardingStepErrors(1, validDraft({
    bodyWeightKg: '0',
    trainingExperienceMonths: '-1',
    trainingFrequencyPerWeek: '8',
  }));
  assert.deepEqual(errors.map((error) => error.field), [
    'bodyWeightKg',
    'trainingExperienceMonths',
    'trainingFrequencyPerWeek',
  ]);
});

test('only Boss-eligible main exercises are selectable and Pull-up stays out of the UI choices', () => {
  assert.deepEqual(ONBOARDING_MAIN_EXERCISES.map((exercise) => exercise.id), [
    'barbell_bench_press',
    'barbell_back_squat',
    'barbell_deadlift',
    'barbell_overhead_press',
  ]);
  assert.equal(ONBOARDING_MAIN_EXERCISES.some((exercise) => exercise.id === 'pull_up'), false);
});

test('baseline preview delegates a 1..10-rep set to shared e1RM logic without a UI formula', () => {
  assert.deepEqual(getBaselinePreview(validDraft({ baselineReps: '1', baselineWeightKg: '70' })), {
    status: 'ready',
    e1rmKg: 70,
    ruleVersion: 'epley-v1',
  });
  assert.deepEqual(getBaselinePreview(validDraft({ baselineReps: '10', baselineWeightKg: '60' })), {
    status: 'ready',
    e1rmKg: 80,
    ruleVersion: 'epley-v1',
  });
  assert.equal(getBaselinePreview(validDraft({ baselineReps: '11' })).status, 'invalid_reps');
  assert.equal(formatE1rmKg(70), '70.0kg');
});

test('an unknown baseline is preserved as baseline_required input rather than a fabricated strength value', () => {
  const draft = validDraft({
    isBaselineUnknown: true,
    baselineWeightKg: '60',
    baselineReps: '5',
  });
  assert.deepEqual(getBaselinePreview(draft), { status: 'missing' });
  assert.deepEqual(toOnboardingRoadmapDraft(draft), {
    bodyWeightKg: 72,
    trainingExperienceMonths: 8,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press',
    baselineWeightKg: null,
    baselineReps: null,
    finalGoalE1rmKg: 80,
  });
});

test('final goal must be strictly above the shared baseline preview', () => {
  assert.equal(getOnboardingStepErrors(3, validDraft({ finalGoalE1rmKg: '70' }))[0].field, 'finalGoalE1rmKg');
  assert.equal(getOnboardingStepErrors(3, validDraft({ finalGoalE1rmKg: '69.9' }))[0].field, 'finalGoalE1rmKg');
  assert.deepEqual(getOnboardingStepErrors(3, validDraft({ finalGoalE1rmKg: '70.1' })), []);
});

test('onboarding adventure sessions carry only the created roadmap and progress, never the Demo Bench plan', () => {
  const roadmap = generateStageRoadmap({
    startDate: '2026-09-22',
    durationDays: 14,
    trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_deadlift',
    stageTargetE1rmKg: 105,
  });
  const session = createOnboardingAdventureSession({
    roadmap,
    initialProgress: createInitialStageProgress(roadmap),
  });
  assert.equal(session.source, 'onboarding');
  assert.equal(session.roadmap.mainExerciseId, 'barbell_deadlift');
  assert.equal(session.trainingPlan, undefined);
  assert.equal(session.equipmentProfile, undefined);
});

test('the loading gate rejects a second CTA tap until the first request settles', async () => {
  const gate = createOnboardingSubmissionGate();
  let calls = 0;
  let release;
  const first = gate.run(async () => {
    calls++;
    await new Promise((resolve) => { release = resolve; });
    return 'created';
  });
  const duplicate = await gate.run(async () => {
    calls++;
    return 'unexpected';
  });
  assert.equal(duplicate, null);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, 'created');
  assert.equal(await gate.run(async () => 'retry'), 'retry');
});
