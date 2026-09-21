import type { GymEquipmentProfile } from './equipment.js';
import type {
  ExerciseDefinition,
  ExerciseDifficulty,
  ExerciseId,
  MovementPattern,
  MuscleGroup,
} from './exercise.js';
import { EXERCISE_CATALOG, getExerciseById } from './exerciseCatalog.js';

export interface ExerciseFilterCriteria {
  readonly primaryMuscle?: MuscleGroup;
  readonly movementPattern?: MovementPattern;
  readonly difficulty?: ExerciseDifficulty;
  readonly equipmentProfile?: GymEquipmentProfile;
}

export function hasRequiredEquipment(
  exercise: ExerciseDefinition,
  profile: GymEquipmentProfile,
): boolean {
  const availableEquipment = new Set(profile.availableEquipmentIds);

  return exercise.requiredEquipmentOptions.some((equipmentOption) =>
    equipmentOption.every((equipmentId) => availableEquipment.has(equipmentId)),
  );
}

export function filterExercises(
  criteria: ExerciseFilterCriteria,
  catalog: readonly ExerciseDefinition[] = EXERCISE_CATALOG,
): ExerciseDefinition[] {
  return catalog.filter((exercise) => {
    if (
      criteria.primaryMuscle !== undefined &&
      !exercise.primaryMuscles.includes(criteria.primaryMuscle)
    ) {
      return false;
    }

    if (
      criteria.movementPattern !== undefined &&
      exercise.movementPattern !== criteria.movementPattern
    ) {
      return false;
    }

    if (
      criteria.difficulty !== undefined &&
      exercise.difficulty !== criteria.difficulty
    ) {
      return false;
    }

    if (
      criteria.equipmentProfile !== undefined &&
      !hasRequiredEquipment(exercise, criteria.equipmentProfile)
    ) {
      return false;
    }

    return true;
  });
}

export function getSubstitutionCandidates(
  exerciseId: ExerciseId,
  equipmentProfile: GymEquipmentProfile,
): ExerciseDefinition[] {
  const sourceExercise = getExerciseById(exerciseId);

  if (sourceExercise === undefined) {
    return [];
  }

  const alternativeIds = new Set(sourceExercise.alternativeExerciseIds);

  return EXERCISE_CATALOG.filter((candidate) => {
    const sharesPrimaryMuscle = candidate.primaryMuscles.some((muscle) =>
      sourceExercise.primaryMuscles.includes(muscle),
    );

    return (
      alternativeIds.has(candidate.id) &&
      sharesPrimaryMuscle &&
      candidate.movementPattern === sourceExercise.movementPattern &&
      hasRequiredEquipment(candidate, equipmentProfile)
    );
  });
}
