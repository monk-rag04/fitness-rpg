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
