import type { GymEquipmentProfile } from './equipment.js';
import { getSubstitutionCandidates } from './filterExercises.js';
import type { ExerciseId } from './exercise.js';
import type { StageRoadmap, StageRoadmapDay } from './stageRoadmap.js';
import type {
  PlannedExerciseRole,
  ValidatedPlannedExercise,
  ValidatedTrainingPlan,
} from './trainingPlan.js';
import {
  validateExerciseWorkoutResult,
  validateWorkoutResultAgainstPlan,
  type ExerciseWorkoutResult,
} from './workoutResult.js';

/** D-027 MVP rule. Persist with progress once a persistence boundary exists. */
export const STAGE_PROGRESS_RULE = {
  version: 'linear-stage-progress-v1',
} as const;

/** Mutable game-state boundary; the StageRoadmap itself remains immutable. */
export interface StageProgress {
  readonly currentDayIndex: number;
}

export type StageQuestStatus = 'completed' | 'available' | 'locked';

interface StageProgressDayViewBase {
  readonly dayIndex: number;
  readonly date: string;
  readonly status: StageQuestStatus;
}

export interface TrainingStageProgressDayView extends StageProgressDayViewBase {
  readonly type: 'training';
  readonly sessionFocus: Extract<StageRoadmapDay, { readonly type: 'training' }>['sessionFocus'];
}

export interface RecoveryStageProgressDayView extends StageProgressDayViewBase {
  readonly type: 'recovery';
}

export type StageProgressDailyNodeView =
  | TrainingStageProgressDayView
  | RecoveryStageProgressDayView;

/** A UI-independent read model for the Adventure Map. */
export interface StageProgressView {
  readonly currentDayIndex: number;
  readonly currentDailyNode: StageProgressDailyNodeView | null;
  readonly dailyNodes: readonly StageProgressDailyNodeView[];
  readonly completedDailyNodes: readonly StageProgressDailyNodeView[];
  readonly lockedFutureDailyNodes: readonly StageProgressDailyNodeView[];
  readonly completedDailyNodeCount: number;
  readonly totalDailyNodeCount: number;
  readonly boss: StageRoadmap['boss'];
  readonly bossAvailable: boolean;
  readonly ruleVersion: typeof STAGE_PROGRESS_RULE.version;
}

export type StageProgressValidationErrorCode =
  | 'INVALID_PROGRESS_SHAPE'
  | 'INVALID_CURRENT_DAY_INDEX'
  | 'INVALID_REQUESTED_DAY_INDEX';

export class StageProgressValidationError extends Error {
  public readonly name = 'StageProgressValidationError';

  public constructor(public readonly code: StageProgressValidationErrorCode) {
    super(`Invalid stage progress: ${code}`);
  }
}

export type TrainingQuestCompletionErrorCode =
  | 'MISSING_TRAINING_PLAN'
  | 'INVALID_TRAINING_PLAN'
  | 'INVALID_WORKOUT_RESULTS'
  | 'INVALID_WORKOUT_RESULT'
  | 'WORKOUT_RESULT_PLAN_MISMATCH'
  | 'DUPLICATE_WORKOUT_RESULT'
  | 'MISSING_REQUIRED_EXERCISE_RESULT'
  | 'MISSING_EQUIPMENT_PROFILE'
  | 'INVALID_EQUIPMENT_PROFILE'
  | 'INVALID_SUBSTITUTION';

export interface TrainingQuestCompletionError {
  readonly code: TrainingQuestCompletionErrorCode;
  readonly path: string;
}

export interface TrainingQuestExerciseView {
  readonly exerciseId: ExerciseId;
  readonly role: PlannedExerciseRole;
  readonly completed: boolean;
  readonly status: 'completed' | 'incomplete';
}

/** Derived completion state only; it is not a checkbox persistence model. */
export interface TrainingQuestCompletionEvaluation {
  readonly readyToClear: boolean;
  readonly exercises: readonly TrainingQuestExerciseView[];
  readonly errors: readonly TrainingQuestCompletionError[];
}

export type QuestCompletionResult =
  | {
    readonly status: 'completed';
    readonly progress: StageProgress;
    readonly completedDayIndex: number;
    readonly bossAvailable: boolean;
  }
  | {
    readonly status: 'already_completed' | 'not_current_quest' | 'wrong_quest_type';
    readonly progress: StageProgress;
  }
  | {
    readonly status: 'not_ready_to_clear';
    readonly progress: StageProgress;
    readonly evaluation: TrainingQuestCompletionEvaluation;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isExercisePlan(value: unknown): value is ValidatedPlannedExercise {
  return isRecord(value) &&
    typeof value.exerciseId === 'string' &&
    (value.role === 'main' || value.role === 'accessory') &&
    isPositiveInteger(value.sets) &&
    isRecord(value.repRange) &&
    isPositiveInteger(value.repRange.min) &&
    isPositiveInteger(value.repRange.max) &&
    value.repRange.min <= value.repRange.max;
}

function getValidatedPlan(
  plan: ValidatedTrainingPlan | undefined,
): { readonly plan: readonly ValidatedPlannedExercise[] } | null {
  if (plan === undefined || plan === null) return null;
  if (!isRecord(plan) || !Array.isArray(plan.exercises) || plan.exercises.length === 0) return null;
  if (!plan.exercises.every(isExercisePlan)) return null;
  const exerciseIds = plan.exercises.map((exercise) => exercise.exerciseId);
  if (new Set(exerciseIds).size !== exerciseIds.length) return null;
  return { plan: plan.exercises };
}

function isGymEquipmentProfile(value: unknown): value is GymEquipmentProfile {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.displayName === 'string' &&
    Array.isArray(value.availableEquipmentIds) &&
    value.availableEquipmentIds.every((equipmentId) => typeof equipmentId === 'string');
}

function assertProgress(
  roadmap: StageRoadmap,
  progress: unknown,
): asserts progress is StageProgress {
  if (!isRecord(progress) || Object.keys(progress).length !== 1 || !Object.hasOwn(progress, 'currentDayIndex')) {
    throw new StageProgressValidationError('INVALID_PROGRESS_SHAPE');
  }
  if (
    typeof progress.currentDayIndex !== 'number' ||
    !Number.isSafeInteger(progress.currentDayIndex) ||
    progress.currentDayIndex < 0 ||
    progress.currentDayIndex > roadmap.days.length
  ) {
    throw new StageProgressValidationError('INVALID_CURRENT_DAY_INDEX');
  }
}

function assertRequestedDayIndex(roadmap: StageRoadmap, requestedDayIndex: unknown): asserts requestedDayIndex is number {
  if (
    typeof requestedDayIndex !== 'number' ||
    !Number.isSafeInteger(requestedDayIndex) ||
    requestedDayIndex < 0 ||
    requestedDayIndex >= roadmap.days.length
  ) {
    throw new StageProgressValidationError('INVALID_REQUESTED_DAY_INDEX');
  }
}

function getDayStatus(dayIndex: number, currentDayIndex: number): StageQuestStatus {
  if (dayIndex < currentDayIndex) return 'completed';
  if (dayIndex === currentDayIndex) return 'available';
  return 'locked';
}

function toDayView(day: StageRoadmapDay, dayIndex: number, currentDayIndex: number): StageProgressDailyNodeView {
  const status = getDayStatus(dayIndex, currentDayIndex);
  if (day.type === 'training') {
    return {
      dayIndex,
      date: day.date,
      type: 'training',
      status,
      sessionFocus: {
        targetMuscles: [...day.sessionFocus.targetMuscles],
        ...(day.sessionFocus.targetMovementPatterns === undefined
          ? {}
          : { targetMovementPatterns: [...day.sessionFocus.targetMovementPatterns] }),
      },
    };
  }
  return { dayIndex, date: day.date, type: 'recovery', status };
}

function isAllowedSubstitution(
  result: ExerciseWorkoutResult,
  equipmentProfile: GymEquipmentProfile | undefined,
): TrainingQuestCompletionError | null {
  if (result.plannedExerciseId === result.performedExerciseId) return null;
  if (equipmentProfile === undefined) {
    return { code: 'MISSING_EQUIPMENT_PROFILE', path: 'equipmentProfile' };
  }
  if (!isGymEquipmentProfile(equipmentProfile)) {
    return { code: 'INVALID_EQUIPMENT_PROFILE', path: 'equipmentProfile' };
  }
  const allowed = getSubstitutionCandidates(result.plannedExerciseId, equipmentProfile)
    .some((candidate) => candidate.id === result.performedExerciseId);
  return allowed
    ? null
    : { code: 'INVALID_SUBSTITUTION', path: 'performedExerciseId' };
}

function resultForPlan(
  result: ExerciseWorkoutResult,
  plan: readonly ValidatedPlannedExercise[],
): ValidatedPlannedExercise | undefined {
  return plan.find((exercise) => exercise.exerciseId === result.plannedExerciseId);
}

/** Start at the first roadmap node; no wall-clock date is consulted. */
export function createInitialStageProgress(_roadmap: StageRoadmap): StageProgress {
  return { currentDayIndex: 0 };
}

/** Derive current/completed/locked map state without UI fields or game rewards. */
export function deriveStageProgressView(
  roadmap: StageRoadmap,
  progress: StageProgress,
): StageProgressView {
  assertProgress(roadmap, progress);
  const dailyNodes = roadmap.days.map((day, index) => toDayView(day, index, progress.currentDayIndex));
  const currentDailyNode = progress.currentDayIndex === roadmap.days.length
    ? null
    : dailyNodes[progress.currentDayIndex];
  const completedDailyNodes = dailyNodes.filter((node) => node.status === 'completed');
  const lockedFutureDailyNodes = dailyNodes.filter((node) => node.status === 'locked');

  return {
    currentDayIndex: progress.currentDayIndex,
    currentDailyNode,
    dailyNodes,
    completedDailyNodes,
    lockedFutureDailyNodes,
    completedDailyNodeCount: progress.currentDayIndex,
    totalDailyNodeCount: roadmap.days.length,
    boss: { ...roadmap.boss },
    bossAvailable: progress.currentDayIndex === roadmap.days.length,
    ruleVersion: STAGE_PROGRESS_RULE.version,
  };
}

/**
 * Determines whether every required main/accessory plan item has one valid,
 * plan-consistent result. It never advances map progress by itself.
 */
export function evaluateTrainingQuestCompletion(
  trainingPlan: ValidatedTrainingPlan | undefined,
  workoutResults: readonly unknown[],
  equipmentProfile?: GymEquipmentProfile,
): TrainingQuestCompletionEvaluation {
  const errors: TrainingQuestCompletionError[] = [];
  if (trainingPlan === undefined || trainingPlan === null) {
    return {
      readyToClear: false,
      exercises: [],
      errors: [{ code: 'MISSING_TRAINING_PLAN', path: 'trainingPlan' }],
    };
  }
  const validatedPlan = getValidatedPlan(trainingPlan);
  if (validatedPlan === null) {
    return {
      readyToClear: false,
      exercises: [],
      errors: [{ code: 'INVALID_TRAINING_PLAN', path: 'trainingPlan' }],
    };
  }
  if (!Array.isArray(workoutResults)) {
    return {
      readyToClear: false,
      exercises: validatedPlan.plan.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        role: exercise.role,
        completed: false,
        status: 'incomplete' as const,
      })),
      errors: [{ code: 'INVALID_WORKOUT_RESULTS', path: 'workoutResults' }],
    };
  }

  const validResultsByPlanExercise = new Map<ExerciseId, ExerciseWorkoutResult[]>();
  const invalidPlanExerciseIds = new Set<ExerciseId>();

  for (const [index, input] of workoutResults.entries()) {
    const resultValidation = validateExerciseWorkoutResult(input);
    if (!resultValidation.valid) {
      errors.push({ code: 'INVALID_WORKOUT_RESULT', path: `workoutResults[${index}]` });
      continue;
    }

    const result = resultValidation.value;
    const plannedExercise = resultForPlan(result, validatedPlan.plan);
    if (plannedExercise === undefined) {
      errors.push({ code: 'WORKOUT_RESULT_PLAN_MISMATCH', path: `workoutResults[${index}].plannedExerciseId` });
      continue;
    }
    const consistency = validateWorkoutResultAgainstPlan(result, plannedExercise);
    if (!consistency.valid) {
      errors.push({ code: 'WORKOUT_RESULT_PLAN_MISMATCH', path: `workoutResults[${index}]` });
      invalidPlanExerciseIds.add(plannedExercise.exerciseId);
      continue;
    }
    const substitutionError = isAllowedSubstitution(result, equipmentProfile);
    if (substitutionError !== null) {
      errors.push({ ...substitutionError, path: `workoutResults[${index}].${substitutionError.path}` });
      invalidPlanExerciseIds.add(plannedExercise.exerciseId);
      continue;
    }

    const matchingResults = validResultsByPlanExercise.get(plannedExercise.exerciseId) ?? [];
    matchingResults.push(result);
    validResultsByPlanExercise.set(plannedExercise.exerciseId, matchingResults);
  }

  for (const [exerciseId, results] of validResultsByPlanExercise) {
    if (results.length > 1) {
      errors.push({ code: 'DUPLICATE_WORKOUT_RESULT', path: `workoutResults.${exerciseId}` });
      invalidPlanExerciseIds.add(exerciseId);
    }
  }

  const exercises = validatedPlan.plan.map((exercise): TrainingQuestExerciseView => {
    const matchingResults = validResultsByPlanExercise.get(exercise.exerciseId) ?? [];
    const completed = matchingResults.length === 1 && !invalidPlanExerciseIds.has(exercise.exerciseId);
    if (!completed) {
      errors.push({ code: 'MISSING_REQUIRED_EXERCISE_RESULT', path: `trainingPlan.exercises.${exercise.exerciseId}` });
    }
    return {
      exerciseId: exercise.exerciseId,
      role: exercise.role,
      completed,
      status: completed ? 'completed' : 'incomplete',
    };
  });

  return { readyToClear: errors.length === 0, exercises, errors };
}

function initialCompletionResult(
  roadmap: StageRoadmap,
  progress: StageProgress,
  requestedDayIndex: number,
): QuestCompletionResult | null {
  assertProgress(roadmap, progress);
  assertRequestedDayIndex(roadmap, requestedDayIndex);
  if (requestedDayIndex < progress.currentDayIndex) {
    return { status: 'already_completed', progress };
  }
  if (requestedDayIndex > progress.currentDayIndex) {
    return { status: 'not_current_quest', progress };
  }
  return null;
}

function completedResult(
  roadmap: StageRoadmap,
  completedDayIndex: number,
): QuestCompletionResult {
  const progress = { currentDayIndex: completedDayIndex + 1 };
  return {
    status: 'completed',
    progress,
    completedDayIndex,
    bossAvailable: progress.currentDayIndex === roadmap.days.length,
  };
}

/** Explicitly clear the current training node after completion evaluation succeeds. */
export function completeTrainingQuest(
  roadmap: StageRoadmap,
  progress: StageProgress,
  requestedDayIndex: number,
  trainingPlan: ValidatedTrainingPlan | undefined,
  workoutResults: readonly unknown[],
  equipmentProfile?: GymEquipmentProfile,
): QuestCompletionResult {
  const earlyResult = initialCompletionResult(roadmap, progress, requestedDayIndex);
  if (earlyResult !== null) return earlyResult;
  if (roadmap.days[requestedDayIndex].type !== 'training') {
    return { status: 'wrong_quest_type', progress };
  }
  const evaluation = evaluateTrainingQuestCompletion(trainingPlan, workoutResults, equipmentProfile);
  if (!evaluation.readyToClear) {
    return { status: 'not_ready_to_clear', progress, evaluation };
  }
  return completedResult(roadmap, requestedDayIndex);
}

/** Explicitly clear the current recovery node; Recovery has no MVP checklist. */
export function completeRecoveryQuest(
  roadmap: StageRoadmap,
  progress: StageProgress,
  requestedDayIndex: number,
): QuestCompletionResult {
  const earlyResult = initialCompletionResult(roadmap, progress, requestedDayIndex);
  if (earlyResult !== null) return earlyResult;
  if (roadmap.days[requestedDayIndex].type !== 'recovery') {
    return { status: 'wrong_quest_type', progress };
  }
  return completedResult(roadmap, requestedDayIndex);
}
