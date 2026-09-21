import type { GymEquipmentProfile } from './equipment.js';
import type {
  ExerciseDefinition,
  ExerciseDifficulty,
  ExerciseId,
  MovementPattern,
  MuscleGroup,
} from './exercise.js';
import { EXERCISE_CATALOG, getExerciseById } from './exerciseCatalog.js';
import { filterExercises, hasRequiredEquipment } from './filterExercises.js';

export interface TrainingCandidateRequest {
  readonly equipmentProfile: GymEquipmentProfile;
  readonly mainExerciseId?: string;
  readonly targetMuscles?: readonly MuscleGroup[];
  readonly targetMovementPatterns?: readonly MovementPattern[];
  readonly difficulty?: ExerciseDifficulty;
}

export interface TrainingExerciseCandidate {
  readonly exerciseId: ExerciseId;
  readonly displayName: string;
  readonly primaryMuscles: readonly MuscleGroup[];
  readonly secondaryMuscles: readonly MuscleGroup[];
  readonly movementPattern: MovementPattern;
  readonly difficulty: ExerciseDifficulty;
}

export interface TrainingCandidateResult {
  readonly mainExercise?: TrainingExerciseCandidate;
  readonly candidateExercises: readonly TrainingExerciseCandidate[];
}

export type TrainingCandidateErrorCode =
  | 'MAIN_EXERCISE_NOT_FOUND'
  | 'MAIN_EXERCISE_UNAVAILABLE';

export class TrainingCandidateError extends Error {
  public readonly name = 'TrainingCandidateError';

  public constructor(
    public readonly code: TrainingCandidateErrorCode,
    public readonly mainExerciseId: string,
  ) {
    super(
      code === 'MAIN_EXERCISE_NOT_FOUND'
        ? `Main exercise does not exist in the catalog: ${mainExerciseId}`
        : `Main exercise is unavailable with the equipment profile: ${mainExerciseId}`,
    );
  }
}

function toCandidate(
  exercise: ExerciseDefinition,
): TrainingExerciseCandidate {
  return {
    exerciseId: exercise.id,
    displayName: exercise.displayName,
    primaryMuscles: [...exercise.primaryMuscles],
    secondaryMuscles: [...exercise.secondaryMuscles],
    movementPattern: exercise.movementPattern,
    difficulty: exercise.difficulty,
  };
}

function getMainExercise(
  mainExerciseId: string | undefined,
  equipmentProfile: GymEquipmentProfile,
): ExerciseDefinition | undefined {
  if (mainExerciseId === undefined) {
    return undefined;
  }

  const mainExercise = getExerciseById(mainExerciseId);

  if (mainExercise === undefined) {
    throw new TrainingCandidateError(
      'MAIN_EXERCISE_NOT_FOUND',
      mainExerciseId,
    );
  }

  if (!hasRequiredEquipment(mainExercise, equipmentProfile)) {
    throw new TrainingCandidateError(
      'MAIN_EXERCISE_UNAVAILABLE',
      mainExerciseId,
    );
  }

  return mainExercise;
}

export function buildTrainingCandidates(
  request: TrainingCandidateRequest,
): TrainingCandidateResult {
  const mainExercise = getMainExercise(
    request.mainExerciseId,
    request.equipmentProfile,
  );
  const targetMuscles = request.targetMuscles ?? [undefined];
  const targetMovementPatterns = request.targetMovementPatterns ?? [undefined];
  const candidateIds = new Set<ExerciseId>();

  for (const primaryMuscle of targetMuscles) {
    for (const movementPattern of targetMovementPatterns) {
      for (const exercise of filterExercises({
        primaryMuscle,
        movementPattern,
        difficulty: request.difficulty,
        equipmentProfile: request.equipmentProfile,
      })) {
        candidateIds.add(exercise.id);
      }
    }
  }

  const candidateExercises = EXERCISE_CATALOG.filter(
    (exercise) =>
      candidateIds.has(exercise.id) && exercise.id !== mainExercise?.id,
  ).map(toCandidate);

  return {
    mainExercise:
      mainExercise === undefined ? undefined : toCandidate(mainExercise),
    candidateExercises,
  };
}
