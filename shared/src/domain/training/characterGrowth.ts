export const TRAINING_EXP_CATEGORIES = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
] as const;

export type TrainingExpCategory = (typeof TRAINING_EXP_CATEGORIES)[number];

export interface CharacterGrowth {
  readonly trainingExp: Readonly<Record<TrainingExpCategory, number>>;
  readonly recoveryExp: number;
}

export function createInitialCharacterGrowth(): CharacterGrowth {
  return {
    trainingExp: {
      chest: 0,
      back: 0,
      shoulders: 0,
      arms: 0,
      legs: 0,
    },
    recoveryExp: 0,
  };
}
