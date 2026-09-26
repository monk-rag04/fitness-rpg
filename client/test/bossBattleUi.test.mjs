import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateStageRoadmap } from '@fitness-rpg/shared';

process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.app.json', import.meta.url));
await import('tsx');
const { AdventureQuestProvider } = await import('../src/state/AdventureQuestContext.tsx');
const { createOnboardingAdventureSession } = await import('../src/state/adventureSession.ts');
const { BossBattleScreen } = await import('../src/features/boss/BossBattleScreen.tsx');
const { StageClearScreen } = await import('../src/features/boss/StageClearScreen.tsx');

function session({ defeated = false, winningAttempt, finalGoal = 100 } = {}) {
  const roadmap = generateStageRoadmap({
    startDate: '2026-09-26', durationDays: 14, trainingFrequencyPerWeek: 3,
    mainExerciseId: 'barbell_bench_press', stageTargetE1rmKg: 75,
  });
  const base = createOnboardingAdventureSession({
    roadmap,
    initialProgress: { currentDayIndex: roadmap.days.length },
    stageTrainingProgramContext: {
      mainExerciseId: roadmap.mainExerciseId, currentE1rmKg: 70,
      trainingExperienceMonths: 8, trainingFrequencyPerWeek: roadmap.trainingFrequencyPerWeek,
    },
    mainStrengthGoalE1rmKg: finalGoal,
  });
  return {
    ...base,
    stageNumber: 1,
    bossBattle: {
      ruleVersion: 'boss-target-v1', originalStageTargetE1rmKg: 75,
      targetE1rmKg: 80, adapted: true, defeated,
      ...(winningAttempt === undefined ? {} : { winningAttempt }),
    },
  };
}

test('Boss Battle screen uses fixed Main, displays adapted target, and leaves actual input blank', () => {
  const markup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: session() },
    createElement(BossBattleScreen),
  ));
  assert.match(markup, /BOSS BATTLE/);
  assert.match(markup, /MAIN STRENGTH/);
  assert.match(markup, /BOSS ADAPTED/);
  assert.match(markup, /80kg e1RM/);
  assert.match(markup, /name="weightKg"|aria-label="挑戦重量 kg"/);
  assert.match(markup, /value=""/);
  assert.doesNotMatch(markup, /bottom-navigation/);
});

test('Stage Clear shows victory evidence and only offers Next Stage before Final Goal', () => {
  const winner = { exerciseId: 'barbell_bench_press', weightKg: 80, reps: 5, estimatedE1rmKg: 93.33333333333333 };
  const markup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: session({ defeated: true, winningAttempt: winner, finalGoal: 100 }) },
    createElement(StageClearScreen),
  ));
  assert.match(markup, /BOSS DEFEATED/);
  assert.match(markup, /STAGE CLEAR/);
  assert.match(markup, /YOUR e1RM/);
  assert.match(markup, /次のStageへ/);
  assert.doesNotMatch(markup, /bottom-navigation/);
});

test('Final Goal victory does not offer another generated Stage', () => {
  const winner = { exerciseId: 'barbell_bench_press', weightKg: 100, reps: 1, estimatedE1rmKg: 100 };
  const markup = renderToStaticMarkup(createElement(
    AdventureQuestProvider,
    { session: session({ defeated: true, winningAttempt: winner, finalGoal: 100 }) },
    createElement(StageClearScreen),
  ));
  assert.match(markup, /FINAL GOAL CLEAR/);
  assert.doesNotMatch(markup, /次のStageへ/);
});
