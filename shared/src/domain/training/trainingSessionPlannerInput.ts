import { getExerciseById } from './exerciseCatalog.js';
import {
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type MovementPattern,
  type MuscleGroup,
} from './exercise.js';
import type {
  TrainingCandidateResult,
  TrainingExerciseCandidate,
} from './trainingCandidates.js';

export interface TrainingSessionPlannerContext {
  readonly trainingExperienceMonths: number;
  readonly sessionFocus: {
    readonly targetMuscles: readonly MuscleGroup[];
    readonly targetMovementPatterns?: readonly MovementPattern[];
  };
}

/** One Training Session, not a weekly schedule or Roadmap. */
export interface TrainingSessionPlannerInput {
  readonly candidates: TrainingCandidateResult;
  readonly context: TrainingSessionPlannerContext;
}

export type TrainingSessionPlannerInputErrorCode =
  | 'INVALID_INPUT_SHAPE'
  | 'INVALID_FIELD'
  | 'INVALID_CANDIDATES'
  | 'INVALID_CANDIDATE'
  | 'DUPLICATE_CANDIDATE'
  | 'INVALID_CONTEXT'
  | 'INVALID_TRAINING_EXPERIENCE_MONTHS'
  | 'INVALID_SESSION_FOCUS'
  | 'INVALID_TARGET_MUSCLES'
  | 'INVALID_TARGET_MUSCLE'
  | 'INVALID_TARGET_MOVEMENT_PATTERNS'
  | 'INVALID_TARGET_MOVEMENT_PATTERN';

export interface TrainingSessionPlannerInputError {
  readonly code: TrainingSessionPlannerInputErrorCode;
  readonly path: string;
}

export type TrainingSessionPlannerInputValidationResult =
  | { readonly valid: true; readonly value: TrainingSessionPlannerInput }
  | { readonly valid: false; readonly errors: readonly TrainingSessionPlannerInputError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addUnexpectedFieldErrors(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: TrainingSessionPlannerInputError[],
): void {
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) {
      errors.push({ code: 'INVALID_FIELD', path: `${path}.${field}` });
    }
  }
}

function sameStringArray(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index]);
}

function isCandidate(value: unknown): value is TrainingExerciseCandidate {
  if (!isRecord(value) || typeof value.exerciseId !== 'string') {
    return false;
  }

  const exercise = getExerciseById(value.exerciseId);
  return exercise !== undefined &&
    Object.keys(value).every((key) => [
      'exerciseId', 'displayName', 'primaryMuscles', 'secondaryMuscles',
      'movementPattern', 'difficulty',
    ].includes(key)) &&
    value.displayName === exercise.displayName &&
    sameStringArray(value.primaryMuscles, exercise.primaryMuscles) &&
    sameStringArray(value.secondaryMuscles, exercise.secondaryMuscles) &&
    value.movementPattern === exercise.movementPattern &&
    value.difficulty === exercise.difficulty;
}

function validateCandidates(
  value: unknown,
  errors: TrainingSessionPlannerInputError[],
): value is TrainingCandidateResult {
  if (!isRecord(value) || !Array.isArray(value.candidateExercises)) {
    errors.push({ code: 'INVALID_CANDIDATES', path: 'candidates' });
    return false;
  }

  addUnexpectedFieldErrors(
    value,
    ['mainExercise', 'candidateExercises', 'bossMainExerciseId', 'bossMainExposure'],
    'candidates',
    errors,
  );
  const seen = new Set<string>();

  if (value.mainExercise !== undefined) {
    if (!isCandidate(value.mainExercise)) {
      errors.push({ code: 'INVALID_CANDIDATE', path: 'candidates.mainExercise' });
    } else {
      seen.add(value.mainExercise.exerciseId);
    }
  }

  for (const [index, candidate] of value.candidateExercises.entries()) {
    const path = `candidates.candidateExercises[${index}]`;
    if (!isCandidate(candidate)) {
      errors.push({ code: 'INVALID_CANDIDATE', path });
      continue;
    }
    if (seen.has(candidate.exerciseId)) {
      errors.push({ code: 'DUPLICATE_CANDIDATE', path: `${path}.exerciseId` });
    }
    seen.add(candidate.exerciseId);
  }

  if (value.bossMainExerciseId !== undefined &&
      (typeof value.bossMainExerciseId !== 'string' ||
       getExerciseById(value.bossMainExerciseId) === undefined)) {
    errors.push({ code: 'INVALID_CANDIDATE', path: 'candidates.bossMainExerciseId' });
  }
  if (value.bossMainExposure !== undefined && typeof value.bossMainExposure !== 'boolean') {
    errors.push({ code: 'INVALID_CANDIDATE', path: 'candidates.bossMainExposure' });
  }
  if ((value.bossMainExerciseId === undefined) !== (value.bossMainExposure === undefined)) {
    errors.push({ code: 'INVALID_CANDIDATE', path: 'candidates.bossMainExerciseId' });
  }
  if (value.bossMainExerciseId !== undefined && typeof value.bossMainExposure === 'boolean') {
    const bossMainExerciseId = value.bossMainExerciseId;
    if (value.bossMainExposure === true &&
        (!isCandidate(value.mainExercise) || value.mainExercise.exerciseId !== bossMainExerciseId)) {
      errors.push({ code: 'INVALID_CANDIDATE', path: 'candidates.mainExercise' });
    }
    if (value.bossMainExposure === false &&
        isCandidate(value.mainExercise) && value.mainExercise.exerciseId === bossMainExerciseId) {
      errors.push({ code: 'INVALID_CANDIDATE', path: 'candidates.mainExercise' });
    }
  }
  if (typeof value.bossMainExerciseId === 'string' &&
      Array.isArray(value.candidateExercises) &&
      value.candidateExercises.some((candidate) => isRecord(candidate) && candidate.exerciseId === value.bossMainExerciseId)) {
    errors.push({ code: 'INVALID_CANDIDATE', path: 'candidates.candidateExercises' });
  }

  return true;
}

function validateContext(
  value: unknown,
  errors: TrainingSessionPlannerInputError[],
): value is TrainingSessionPlannerContext {
  if (!isRecord(value)) {
    errors.push({ code: 'INVALID_CONTEXT', path: 'context' });
    return false;
  }

  addUnexpectedFieldErrors(value, ['trainingExperienceMonths', 'sessionFocus'], 'context', errors);
  if (typeof value.trainingExperienceMonths !== 'number' ||
      !Number.isFinite(value.trainingExperienceMonths) ||
      !Number.isInteger(value.trainingExperienceMonths) ||
      value.trainingExperienceMonths < 0) {
    errors.push({ code: 'INVALID_TRAINING_EXPERIENCE_MONTHS', path: 'context.trainingExperienceMonths' });
  }

  const focus = value.sessionFocus;
  if (!isRecord(focus)) {
    errors.push({ code: 'INVALID_SESSION_FOCUS', path: 'context.sessionFocus' });
    return false;
  }

  addUnexpectedFieldErrors(focus, ['targetMuscles', 'targetMovementPatterns'], 'context.sessionFocus', errors);
  if (!Array.isArray(focus.targetMuscles)) {
    errors.push({ code: 'INVALID_TARGET_MUSCLES', path: 'context.sessionFocus.targetMuscles' });
  } else {
    for (const [index, muscle] of focus.targetMuscles.entries()) {
      if (!MUSCLE_GROUPS.includes(muscle as MuscleGroup)) {
        errors.push({ code: 'INVALID_TARGET_MUSCLE', path: `context.sessionFocus.targetMuscles[${index}]` });
      }
    }
  }

  if (focus.targetMovementPatterns !== undefined) {
    if (!Array.isArray(focus.targetMovementPatterns)) {
      errors.push({ code: 'INVALID_TARGET_MOVEMENT_PATTERNS', path: 'context.sessionFocus.targetMovementPatterns' });
    } else {
      for (const [index, movement] of focus.targetMovementPatterns.entries()) {
        if (!MOVEMENT_PATTERNS.includes(movement as MovementPattern)) {
          errors.push({ code: 'INVALID_TARGET_MOVEMENT_PATTERN', path: `context.sessionFocus.targetMovementPatterns[${index}]` });
        }
      }
    }
  }

  return true;
}

/** Validate an untrusted session input without rerunning equipment filtering. */
export function validateTrainingSessionPlannerInput(
  input: unknown,
): TrainingSessionPlannerInputValidationResult {
  if (!isRecord(input)) {
    return { valid: false, errors: [{ code: 'INVALID_INPUT_SHAPE', path: 'input' }] };
  }

  const errors: TrainingSessionPlannerInputError[] = [];
  addUnexpectedFieldErrors(input, ['candidates', 'context'], 'input', errors);
  const candidates = input.candidates;
  const context = input.context;
  const candidatesValid = validateCandidates(candidates, errors);
  const contextValid = validateContext(context, errors);

  if (errors.length > 0 || !candidatesValid || !contextValid) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      candidates,
      context: {
        trainingExperienceMonths: context.trainingExperienceMonths,
        sessionFocus: {
          targetMuscles: [...context.sessionFocus.targetMuscles],
          ...(context.sessionFocus.targetMovementPatterns === undefined
            ? {}
            : { targetMovementPatterns: [...context.sessionFocus.targetMovementPatterns] }),
        },
      },
    },
  };
}
