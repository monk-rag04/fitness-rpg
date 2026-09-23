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
  /** Legacy per-session primary / Main Exercise input. */
  readonly mainExerciseId?: string;
  /** D-032 Stage-level Boss Strength exercise, distinct from session primary. */
  readonly bossMainExerciseId?: string;
  /** When true, the Boss Main is the required primary for this Session. */
  readonly bossMainExposure?: boolean;
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
  /** Required Session Primary for legacy or Boss-exposure contexts. */
  readonly mainExercise?: TrainingExerciseCandidate;
  readonly candidateExercises: readonly TrainingExerciseCandidate[];
  /** D-032 metadata used to keep Boss Strength separate from Session Primary. */
  readonly bossMainExerciseId?: ExerciseId;
  readonly bossMainExposure?: boolean;
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

function getExercise(
  mainExerciseId: string | undefined,
  equipmentProfile: GymEquipmentProfile,
  requireEquipment: boolean,
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

  if (requireEquipment && !hasRequiredEquipment(mainExercise, equipmentProfile)) {
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
  const hasStageContext = request.bossMainExerciseId !== undefined ||
    request.bossMainExposure !== undefined;
  const isBossExposure = hasStageContext
    ? request.bossMainExposure === true
    : request.mainExerciseId !== undefined;
  const bossMainExerciseId = hasStageContext
    ? request.bossMainExerciseId
    : undefined;
  const bossMainExercise = getExercise(
    bossMainExerciseId,
    request.equipmentProfile,
    isBossExposure,
  );
  const legacyMainExercise = hasStageContext
    ? undefined
    : getExercise(request.mainExerciseId, request.equipmentProfile, true);
  const requiredMainExercise = hasStageContext
    ? (isBossExposure ? bossMainExercise : undefined)
    : legacyMainExercise;
  const excludedBossMainExerciseId = bossMainExercise?.id ??
    (typeof bossMainExerciseId === 'string' ? bossMainExerciseId : legacyMainExercise?.id);
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
      candidateIds.has(exercise.id) && exercise.id !== excludedBossMainExerciseId,
  ).map(toCandidate);

  return {
    mainExercise: requiredMainExercise === undefined ? undefined : toCandidate(requiredMainExercise),
    candidateExercises,
    ...(hasStageContext && bossMainExerciseId !== undefined
      ? {
        bossMainExerciseId: bossMainExerciseId as ExerciseId,
        bossMainExposure: isBossExposure,
      }
      : {}),
  };
}
