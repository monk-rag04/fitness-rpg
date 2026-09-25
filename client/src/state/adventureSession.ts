import { EQUIPMENT_IDS } from '@fitness-rpg/shared';
import {
  completeRecoveryQuestWithReward,
  completeTrainingQuestWithReward,
  createInitialCharacterGrowth,
  captureFirstWorkoutExerciseBaseline,
  createOnboardingExerciseProgressState,
  createInitialExerciseProgressState,
  applyExerciseLoadStep,
  evaluateExerciseProgression,
  incrementExerciseSessionsCompleted,
  registerSelfReportedExerciseBaseline,
  type CharacterGrowth,
  type ExerciseProgressById,
  type ExerciseLoadStepStatus,
  type ExerciseWorkoutResult,
  type QuestRewardSummary,
} from '@fitness-rpg/shared';
import type {
  EquipmentId,
  ExerciseId,
  GymEquipmentProfile,
  StageProgress,
  StageRoadmap,
  ValidatedStageTrainingProgram,
  ValidatedTrainingPlan,
} from '@fitness-rpg/shared';

/**
 * Immutable facts accepted during onboarding that the Stage Program request
 * needs later. This is session data, not a second copy of a generated plan.
 */
export interface StageTrainingProgramSessionContext {
  readonly mainExerciseId: ExerciseId;
  readonly currentE1rmKg: number;
  readonly trainingExperienceMonths: number;
  readonly trainingFrequencyPerWeek: number;
}

export interface AdventureQuestSession {
  /** Demo remains isolated for development; onboarding sessions must not receive its plan. */
  readonly source: 'demo' | 'onboarding';
  readonly roadmap: StageRoadmap;
  readonly initialProgress: StageProgress;
  readonly planByDay: TrainingPlanByDay;
  readonly equipmentProfile?: GymEquipmentProfile;
  readonly stageTrainingProgramContext?: StageTrainingProgramSessionContext;
  readonly exerciseProgressById?: ExerciseProgressById;
}

export interface OnboardingMainExerciseBaseline {
  readonly exerciseId: ExerciseId;
  readonly weightKg: number;
  readonly reps: number;
}

/** In-memory domain state owned by the current Adventure Quest session. */
export interface AdventureQuestDomainState {
  readonly roadmap: StageRoadmap;
  readonly progress: StageProgress;
  readonly planByDay: TrainingPlanByDay;
  readonly equipmentProfile: GymEquipmentProfile | undefined;
  readonly stageTrainingProgramContext: StageTrainingProgramSessionContext | undefined;
  readonly exerciseProgressById: ExerciseProgressById;
  readonly workoutResultsByDay: Readonly<Record<number, Readonly<Record<string, ExerciseWorkoutResult>>>>;
  readonly characterGrowth: CharacterGrowth;
}

export type AdventureQuestTransitionStatus =
  | 'completed'
  | 'already_completed'
  | 'not_current_quest'
  | 'wrong_quest_type'
  | 'not_ready_to_clear'
  | 'invalid_reward_state'
  | 'invalid_exercise_progress_state'
  | 'invalid_day_index';

export type ExerciseLoadStepSessionStatus = ExerciseLoadStepStatus |
  'not_current_training_day' |
  'exercise_not_in_plan';

export type AdventureQuestRewardTransition =
  | {
    readonly status: 'completed';
    readonly domain: AdventureQuestDomainState;
    readonly rewardSummary: QuestRewardSummary;
  }
  | {
    readonly status: Exclude<AdventureQuestTransitionStatus, 'completed'>;
    readonly domain: AdventureQuestDomainState;
  };

export function createAdventureQuestDomainState(
  session: AdventureQuestSession,
): AdventureQuestDomainState {
  return {
    roadmap: session.roadmap,
    progress: session.initialProgress,
    planByDay: session.planByDay,
    equipmentProfile: session.equipmentProfile,
    stageTrainingProgramContext: session.stageTrainingProgramContext,
    exerciseProgressById: session.exerciseProgressById ?? {},
    workoutResultsByDay: {},
    characterGrowth: createInitialCharacterGrowth(),
  };
}

/** Save a validated Result only; EXP is awarded later by successful Quest Clear. */
export function saveWorkoutResultForCurrentDay(
  domain: AdventureQuestDomainState,
  result: ExerciseWorkoutResult,
): AdventureQuestDomainState {
  const dayIndex = domain.progress.currentDayIndex;
  const resultsForDay = domain.workoutResultsByDay[dayIndex] ?? {};
  const exerciseProgressById = captureFirstWorkoutExerciseBaseline(
    domain.exerciseProgressById,
    result,
    dayIndex,
  );
  return {
    ...domain,
    exerciseProgressById,
    workoutResultsByDay: {
      ...domain.workoutResultsByDay,
      [dayIndex]: {
        ...resultsForDay,
        [result.plannedExerciseId]: result,
      },
    },
  };
}

/**
 * Re-evaluate a requested day against the supplied current state, then return
 * progress and growth together. Failure preserves the exact input state.
 */
export function completeAdventureQuest(
  domain: AdventureQuestDomainState,
  requestedDayIndex: number,
): AdventureQuestRewardTransition {
  if (!Number.isSafeInteger(requestedDayIndex) ||
      requestedDayIndex < 0 || requestedDayIndex >= domain.roadmap.days.length) {
    return { status: 'invalid_day_index', domain };
  }

  const day = domain.roadmap.days[requestedDayIndex];
  const results = Object.values(domain.workoutResultsByDay[requestedDayIndex] ?? {});
  const trainingPlan = day.type === 'training'
    ? getTrainingPlanForDay(domain.roadmap, domain.planByDay, requestedDayIndex) ?? undefined
    : undefined;
  const completion = day.type === 'training'
    ? completeTrainingQuestWithReward(
      domain.roadmap,
      domain.progress,
      requestedDayIndex,
      trainingPlan,
      results,
      domain.equipmentProfile,
      domain.characterGrowth,
    )
    : completeRecoveryQuestWithReward(
      domain.roadmap,
      domain.progress,
      requestedDayIndex,
      domain.characterGrowth,
    );

  if (completion.status !== 'completed') return { status: completion.status, domain };
  let exerciseProgressById = domain.exerciseProgressById;
  if (day.type === 'training') {
    const sessions = incrementExerciseSessionsCompleted(exerciseProgressById, results);
    if (!sessions.valid) return { status: 'invalid_exercise_progress_state', domain };
    exerciseProgressById = sessions.exerciseProgressById;

    if (trainingPlan !== undefined) {
      const resultsByPlanId = new Map(results.map((result) => [result.plannedExerciseId, result]));
      const progressionByPerformedId = new Map<string, number>();
      for (const result of results) {
        progressionByPerformedId.set(
          result.performedExerciseId,
          (progressionByPerformedId.get(result.performedExerciseId) ?? 0) + 1,
        );
      }
      for (const plannedExercise of trainingPlan.exercises) {
        const result = resultsByPlanId.get(plannedExercise.exerciseId);
        if (result === undefined || progressionByPerformedId.get(result.performedExerciseId) !== 1) continue;
        const current = exerciseProgressById[result.performedExerciseId] ??
          createInitialExerciseProgressState(result.performedExerciseId);
        const nextSuggestion = evaluateExerciseProgression({
          exerciseProgress: current,
          plannedExercise,
          workoutResult: result,
          currentDayIndex: requestedDayIndex,
        });
        exerciseProgressById = {
          ...exerciseProgressById,
          [result.performedExerciseId]: { ...current, nextSuggestion },
        };
      }
    }
  }
  return {
    status: 'completed',
    domain: {
      ...domain,
      progress: completion.progress,
      characterGrowth: completion.characterGrowth,
      exerciseProgressById,
    },
    rewardSummary: completion.rewardSummary,
  };
}

export function setExerciseLoadStepForCurrentDay(
  domain: AdventureQuestDomainState,
  input: { readonly plannedExerciseId: string; readonly loadStepKg: unknown },
): { readonly status: ExerciseLoadStepSessionStatus; readonly domain: AdventureQuestDomainState } {
  const dayIndex = domain.progress.currentDayIndex;
  if (domain.roadmap.days[dayIndex]?.type !== 'training') {
    return { status: 'not_current_training_day', domain };
  }
  const plan = getTrainingPlanForDay(domain.roadmap, domain.planByDay, dayIndex);
  const plannedExercise = plan?.exercises.find((exercise) => exercise.exerciseId === input.plannedExerciseId);
  if (plannedExercise === undefined) return { status: 'exercise_not_in_plan', domain };

  const savedResult = domain.workoutResultsByDay[dayIndex]?.[plannedExercise.exerciseId];
  const effectiveExerciseId = savedResult?.performedExerciseId ?? plannedExercise.exerciseId;
  const result = applyExerciseLoadStep({
    exerciseProgress: domain.exerciseProgressById[effectiveExerciseId],
    exerciseId: effectiveExerciseId,
    loadStepKg: input.loadStepKg,
    repRange: plannedExercise.repRange,
  });
  if (!result.valid) return { status: result.status, domain };

  return {
    status: 'applied',
    domain: {
      ...domain,
      exerciseProgressById: {
        ...domain.exerciseProgressById,
        [effectiveExerciseId]: result.exerciseProgress,
      },
    },
  };
}

/**
 * Session-local, day-scoped cache. It intentionally has no persistence or
 * generation side effects; D-030 plan generation is connected in a later task.
 */
export type TrainingPlanByDay = Readonly<Partial<Record<number, ValidatedTrainingPlan>>>;

export type TrainingPlanCacheStatus =
  | 'cached'
  | 'already_cached'
  | 'invalid_day_index'
  | 'not_training_day';

export interface TrainingPlanCacheWriteResult {
  readonly status: TrainingPlanCacheStatus;
  readonly planByDay: TrainingPlanByDay;
}

export type StageTrainingProgramCacheStatus =
  | 'cached'
  | 'already_cached'
  | 'invalid_stage_program'
  | 'roadmap_missing';

export interface StageTrainingProgramCacheWriteResult {
  readonly status: StageTrainingProgramCacheStatus;
  readonly planByDay: TrainingPlanByDay;
}

/** The State boundary needs only the current roadmap and its day-plan cache. */
export interface StageTrainingProgramCacheTarget {
  readonly roadmap?: StageRoadmap | null;
  readonly planByDay: TrainingPlanByDay;
}

export type StageEquipmentProfileStatus =
  | 'set'
  | 'already_set'
  | 'invalid_equipment_ids'
  | 'equipment_locked';

export interface StageEquipmentProfileWriteResult<TTarget extends StageEquipmentProfileTarget> {
  readonly status: StageEquipmentProfileStatus;
  readonly target: TTarget;
  readonly equipmentProfile: GymEquipmentProfile | undefined;
}

/** The State boundary needs only the Stage cache and its shared profile. */
export interface StageEquipmentProfileTarget {
  readonly planByDay: TrainingPlanByDay;
  readonly equipmentProfile?: GymEquipmentProfile;
}

const STAGE_EQUIPMENT_PROFILE_ID = 'stage-equipment-profile';
const STAGE_EQUIPMENT_PROFILE_DISPLAY_NAME = 'Stage Equipment';

function isRoadmapDayIndex(roadmap: StageRoadmap, dayIndex: unknown): dayIndex is number {
  return typeof dayIndex === 'number' &&
    Number.isSafeInteger(dayIndex) &&
    dayIndex >= 0 &&
    dayIndex < roadmap.days.length;
}

/** Return only the requested Training Day's plan; Recovery and Boss have none. */
export function getTrainingPlanForDay(
  roadmap: StageRoadmap,
  planByDay: TrainingPlanByDay,
  dayIndex: unknown,
): ValidatedTrainingPlan | null {
  if (!isRoadmapDayIndex(roadmap, dayIndex) || roadmap.days[dayIndex].type !== 'training') {
    return null;
  }
  return planByDay[dayIndex] ?? null;
}

/**
 * Store the first validated plan for an in-range Training Day. The caller owns
 * validation and generation; this cache deliberately never overwrites a plan.
 */
export function cacheTrainingPlanForDay(
  roadmap: StageRoadmap,
  planByDay: TrainingPlanByDay,
  dayIndex: unknown,
  plan: ValidatedTrainingPlan,
): TrainingPlanCacheWriteResult {
  if (!isRoadmapDayIndex(roadmap, dayIndex)) {
    return { status: 'invalid_day_index', planByDay };
  }
  if (roadmap.days[dayIndex].type !== 'training') {
    return { status: 'not_training_day', planByDay };
  }
  if (planByDay[dayIndex] !== undefined) {
    return { status: 'already_cached', planByDay };
  }
  return {
    status: 'cached',
    planByDay: { ...planByDay, [dayIndex]: plan },
  };
}

function hasExactTrainingDayCoverage(
  roadmap: StageRoadmap,
  program: ValidatedStageTrainingProgram,
): boolean {
  if (!Array.isArray(program.sessions)) return false;

  const expectedDayIndexes = new Set(
    roadmap.days.flatMap((day, dayIndex) => day.type === 'training' ? [dayIndex] : []),
  );
  if (program.sessions.length !== expectedDayIndexes.size) return false;

  const seenDayIndexes = new Set<number>();
  for (const session of program.sessions) {
    const dayIndex = session?.dayIndex;
    if (!isRoadmapDayIndex(roadmap, dayIndex) ||
        roadmap.days[dayIndex].type !== 'training' ||
        !expectedDayIndexes.has(dayIndex) ||
        seenDayIndexes.has(dayIndex)) {
      return false;
    }
    seenDayIndexes.add(dayIndex);
  }

  return seenDayIndexes.size === expectedDayIndexes.size;
}

/**
 * Atomically cache one already-validated Stage Program for the current
 * roadmap. It intentionally does not revalidate plan guardrails or mutate
 * inputs; that work belongs to the Shared validation boundary.
 */
export function cacheStageTrainingProgram(
  target: StageTrainingProgramCacheTarget | null | undefined,
  program: ValidatedStageTrainingProgram,
): StageTrainingProgramCacheWriteResult {
  if (target?.roadmap === undefined || target.roadmap === null) {
    return { status: 'roadmap_missing', planByDay: target?.planByDay ?? {} };
  }
  if (!hasExactTrainingDayCoverage(target.roadmap, program)) {
    return { status: 'invalid_stage_program', planByDay: target.planByDay };
  }
  if (Object.keys(target.planByDay).length > 0) {
    return { status: 'already_cached', planByDay: target.planByDay };
  }

  const nextPlanByDay: Record<number, ValidatedTrainingPlan> = {};
  for (const session of program.sessions) {
    nextPlanByDay[session.dayIndex] = session.plan;
  }
  return { status: 'cached', planByDay: nextPlanByDay };
}

function normalizeEquipmentIds(input: unknown): readonly EquipmentId[] | null {
  if (!Array.isArray(input) ||
      !input.every((equipmentId) =>
        typeof equipmentId === 'string' && EQUIPMENT_IDS.includes(equipmentId as EquipmentId),
      ) ||
      new Set(input).size !== input.length) {
    return null;
  }
  const selectedIds = new Set(input as readonly EquipmentId[]);
  return EQUIPMENT_IDS.filter((equipmentId) => selectedIds.has(equipmentId));
}

function hasSameEquipmentIds(
  profile: GymEquipmentProfile,
  equipmentIds: readonly EquipmentId[],
): boolean {
  return profile.availableEquipmentIds.length === equipmentIds.length &&
    profile.availableEquipmentIds.every((equipmentId, index) => equipmentId === equipmentIds[index]);
}

/**
 * Register or update the current Stage's shared Equipment Profile before a
 * Stage Program has been cached. Main-exercise availability is intentionally
 * left to the Stage Program boundary.
 */
export function setStageEquipmentProfile<TTarget extends StageEquipmentProfileTarget>(
  target: TTarget,
  equipmentIds: unknown,
): StageEquipmentProfileWriteResult<TTarget> {
  const normalizedEquipmentIds = normalizeEquipmentIds(equipmentIds);
  if (normalizedEquipmentIds === null) {
    return {
      status: 'invalid_equipment_ids',
      target,
      equipmentProfile: target.equipmentProfile,
    };
  }
  if (Object.keys(target.planByDay).length > 0) {
    return {
      status: 'equipment_locked',
      target,
      equipmentProfile: target.equipmentProfile,
    };
  }
  if (target.equipmentProfile !== undefined &&
      hasSameEquipmentIds(target.equipmentProfile, normalizedEquipmentIds)) {
    return { status: 'already_set', target, equipmentProfile: target.equipmentProfile };
  }

  const equipmentProfile: GymEquipmentProfile = {
    id: STAGE_EQUIPMENT_PROFILE_ID,
    displayName: STAGE_EQUIPMENT_PROFILE_DISPLAY_NAME,
    availableEquipmentIds: normalizedEquipmentIds,
  };
  return {
    status: 'set',
    target: { ...target, equipmentProfile },
    equipmentProfile,
  };
}

/** An onboarding result starts with no generated plan and no Demo fixture. */
export function createOnboardingAdventureSession(
  result: Pick<AdventureQuestSession, 'roadmap' | 'initialProgress' | 'stageTrainingProgramContext'> & {
    readonly onboardingBaseline?: OnboardingMainExerciseBaseline;
  },
): AdventureQuestSession {
  const onboardingBaseline = result.onboardingBaseline;
  const mainProgress = onboardingBaseline === undefined ||
      onboardingBaseline.exerciseId !== result.roadmap.mainExerciseId ||
      (result.stageTrainingProgramContext !== undefined &&
        onboardingBaseline.exerciseId !== result.stageTrainingProgramContext.mainExerciseId)
    ? null
    : createOnboardingExerciseProgressState({
      ...onboardingBaseline,
      capturedDayIndex: result.initialProgress.currentDayIndex,
    });
  return {
    source: 'onboarding',
    roadmap: result.roadmap,
    initialProgress: result.initialProgress,
    planByDay: {},
    ...(result.stageTrainingProgramContext === undefined
      ? {}
      : { stageTrainingProgramContext: result.stageTrainingProgramContext }),
    ...(mainProgress === null
      ? {}
      : { exerciseProgressById: { [mainProgress.exerciseId]: mainProgress } }),
  };
}

export type ExerciseBaselineRegistrationStatus =
  | 'registered'
  | 'unknown_exercise'
  | 'baseline_already_set'
  | 'self_report_not_supported'
  | 'invalid_baseline_weight'
  | 'invalid_baseline_reps'
  | 'invalid_day_index';

export interface ExerciseBaselineRegistrationTransition {
  readonly status: ExerciseBaselineRegistrationStatus;
  readonly domain: AdventureQuestDomainState;
}

/** Register an optional baseline at the current Quest index without completing a session. */
export function registerExerciseBaselineForCurrentDay(
  domain: AdventureQuestDomainState,
  input: { readonly exerciseId: string; readonly weightKg: unknown; readonly reps: unknown },
): ExerciseBaselineRegistrationTransition {
  const result = registerSelfReportedExerciseBaseline(domain.exerciseProgressById, {
    ...input,
    capturedDayIndex: domain.progress.currentDayIndex,
  });
  if (!result.valid) {
    const status: ExerciseBaselineRegistrationStatus = result.code === 'UNKNOWN_EXERCISE'
      ? 'unknown_exercise'
      : result.code === 'BASELINE_ALREADY_SET'
        ? 'baseline_already_set'
        : result.code === 'SELF_REPORT_NOT_SUPPORTED'
          ? 'self_report_not_supported'
          : result.code === 'INVALID_BASELINE_WEIGHT'
            ? 'invalid_baseline_weight'
            : result.code === 'INVALID_BASELINE_REPS'
              ? 'invalid_baseline_reps'
              : 'invalid_day_index';
    return { status, domain };
  }
  return {
    status: 'registered',
    domain: { ...domain, exerciseProgressById: result.exerciseProgressById },
  };
}
