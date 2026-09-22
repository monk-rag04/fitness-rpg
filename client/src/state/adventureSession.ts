import type {
  GymEquipmentProfile,
  StageProgress,
  StageRoadmap,
  ValidatedStageTrainingProgram,
  ValidatedTrainingPlan,
} from '@fitness-rpg/shared';

export interface AdventureQuestSession {
  /** Demo remains isolated for development; onboarding sessions must not receive its plan. */
  readonly source: 'demo' | 'onboarding';
  readonly roadmap: StageRoadmap;
  readonly initialProgress: StageProgress;
  readonly planByDay: TrainingPlanByDay;
  readonly equipmentProfile?: GymEquipmentProfile;
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

/** An onboarding result starts with no generated plan and no Demo fixture. */
export function createOnboardingAdventureSession(
  result: Pick<AdventureQuestSession, 'roadmap' | 'initialProgress'>,
): AdventureQuestSession {
  return {
    source: 'onboarding',
    roadmap: result.roadmap,
    initialProgress: result.initialProgress,
    planByDay: {},
  };
}
