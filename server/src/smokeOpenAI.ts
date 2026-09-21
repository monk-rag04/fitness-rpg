import { buildTrainingCandidates, type TrainingSessionPlannerInput } from '@fitness-rpg/shared';

import { MissingOpenAIKeyError } from './openai/client.js';
import { generateTrainingPlan, TrainingPlanGenerationError } from './openai/trainingPlan.js';

async function main(): Promise<void> {
  const candidates = buildTrainingCandidates({
    mainExerciseId: 'barbell_bench_press',
    targetMuscles: ['chest'],
    targetMovementPatterns: ['horizontal_push'],
    equipmentProfile: {
      id: 'smoke-barbell-bench',
      displayName: 'Smoke Barbell and Bench',
      availableEquipmentIds: ['barbell', 'flat_bench'],
    },
  });

  const input: TrainingSessionPlannerInput = {
    candidates,
    context: {
      trainingExperienceMonths: 0,
      sessionFocus: {
        targetMuscles: ['chest'],
        targetMovementPatterns: ['horizontal_push'],
      },
    },
  };

  const plan = await generateTrainingPlan(input);
  console.log('OpenAI smoke test passed: TrainingPlanDraft validated.');
  console.log(JSON.stringify(plan, null, 2));
}

main().catch((error: unknown) => {
  if (error instanceof MissingOpenAIKeyError || error instanceof TrainingPlanGenerationError) {
    console.error(`OpenAI smoke test failed [${error.code}]: ${error.message}`);
  } else {
    console.error('OpenAI smoke test failed [UNEXPECTED_ERROR].');
  }
  process.exitCode = 1;
});
