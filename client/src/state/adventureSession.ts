import type {
  GymEquipmentProfile,
  StageProgress,
  StageRoadmap,
  ValidatedTrainingPlan,
} from '@fitness-rpg/shared';

export interface AdventureQuestSession {
  /** Demo remains isolated for development; onboarding sessions must not receive its plan. */
  readonly source: 'demo' | 'onboarding';
  readonly roadmap: StageRoadmap;
  readonly initialProgress: StageProgress;
  readonly trainingPlan?: ValidatedTrainingPlan;
  readonly equipmentProfile?: GymEquipmentProfile;
}

/** An onboarding result deliberately contains no development Training Plan fixture. */
export function createOnboardingAdventureSession(
  result: Pick<AdventureQuestSession, 'roadmap' | 'initialProgress'>,
): AdventureQuestSession {
  return {
    source: 'onboarding',
    roadmap: result.roadmap,
    initialProgress: result.initialProgress,
  };
}
