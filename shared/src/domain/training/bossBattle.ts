import { calculateSetE1rm, isBossE1rmExerciseId } from './e1rm.js';
import type { ExerciseId } from './exercise.js';
import type { StageProgress } from './stageProgress.js';
import type { StageRoadmap } from './stageRoadmap.js';
import type { ExerciseWorkoutResult } from './workoutResult.js';

export const BOSS_TARGET_RULE_VERSION = 'boss-target-v1' as const;

export interface BossWinningAttempt {
  readonly exerciseId: ExerciseId;
  readonly weightKg: number;
  readonly reps: number;
  readonly estimatedE1rmKg: number;
}

/** Frozen at Boss unlock. It is separate from Daily Quest and Training history. */
export interface BossBattleState {
  readonly ruleVersion: typeof BOSS_TARGET_RULE_VERSION;
  readonly originalStageTargetE1rmKg: number;
  readonly targetE1rmKg: number;
  readonly adapted: boolean;
  readonly defeated: boolean;
  readonly winningAttempt?: BossWinningAttempt;
}

export type WorkoutResultsByDay = Readonly<
  Partial<Record<number, Readonly<Record<string, ExerciseWorkoutResult>>>>
>;

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Only actual Main results from explicitly cleared Training days qualify.
 * Suggestions, estimated/onboarding baselines, skipped items, and uncleared
 * results are not present in this input's eligible prefix.
 */
export function getBestClearedMainE1rmKg(
  roadmap: StageRoadmap,
  progress: StageProgress,
  workoutResultsByDay: WorkoutResultsByDay,
): number | undefined {
  if (!isBossE1rmExerciseId(roadmap.mainExerciseId) ||
      !Number.isSafeInteger(progress.currentDayIndex) || progress.currentDayIndex < 0) {
    return undefined;
  }

  const completedCount = Math.min(progress.currentDayIndex, roadmap.days.length);
  let best: number | undefined;
  for (let dayIndex = 0; dayIndex < completedCount; dayIndex += 1) {
    if (roadmap.days[dayIndex]?.type !== 'training') continue;
    for (const result of Object.values(workoutResultsByDay[dayIndex] ?? {})) {
      if (result.performedExerciseId !== roadmap.mainExerciseId) continue;
      for (const set of result.completedSets) {
        if (!isPositiveFinite(set.weightKg) || !Number.isSafeInteger(set.reps) || set.reps <= 0) continue;
        try {
          const estimate = calculateSetE1rm({ weightKg: set.weightKg, reps: set.reps });
          if (estimate.eligible && (best === undefined || estimate.estimated1rmKg > best)) {
            best = estimate.estimated1rmKg;
          }
        } catch {
          // Invalid records are never a Boss input; valid Session results are pre-validated.
        }
      }
    }
  }
  return best;
}

export type BossUnlockResult =
  | { readonly status: 'locked' }
  | { readonly status: 'invalid_input' }
  | { readonly status: 'unlocked' | 'already_unlocked'; readonly bossBattle: BossBattleState };

/** Apply the stage-local adaptation rule once, exactly when the Boss unlocks. */
export function unlockBossBattle(input: {
  readonly roadmap: StageRoadmap;
  readonly progress: StageProgress;
  readonly finalGoalE1rmKg: number;
  readonly bestActualMainE1rmKg?: number;
  readonly existingBossBattle?: BossBattleState;
}): BossUnlockResult {
  if (input.progress.currentDayIndex !== input.roadmap.days.length) return { status: 'locked' };
  if (input.existingBossBattle !== undefined) {
    return { status: 'already_unlocked', bossBattle: input.existingBossBattle };
  }
  const originalStageTargetE1rmKg = input.roadmap.stageTargetE1rmKg;
  if (!isPositiveFinite(originalStageTargetE1rmKg) ||
      !isPositiveFinite(input.finalGoalE1rmKg) ||
      input.finalGoalE1rmKg < originalStageTargetE1rmKg ||
      (input.bestActualMainE1rmKg !== undefined && !isPositiveFinite(input.bestActualMainE1rmKg))) {
    return { status: 'invalid_input' };
  }

  const targetE1rmKg = input.bestActualMainE1rmKg === undefined
    ? originalStageTargetE1rmKg
    : Math.min(
      input.finalGoalE1rmKg,
      Math.max(originalStageTargetE1rmKg, input.bestActualMainE1rmKg * 1.03),
    );
  const bossBattle: BossBattleState = {
    ruleVersion: BOSS_TARGET_RULE_VERSION,
    originalStageTargetE1rmKg,
    targetE1rmKg,
    adapted: targetE1rmKg > originalStageTargetE1rmKg,
    defeated: false,
  };
  return { status: 'unlocked', bossBattle };
}

export type BossChallengeResult =
  | { readonly status: 'boss_locked' | 'already_defeated' | 'invalid_weight' | 'invalid_reps' | 'exercise_mismatch' }
  | {
    readonly status: 'defeat' | 'victory';
    readonly attempt: BossWinningAttempt;
    readonly bossBattle: BossBattleState;
  };

/** Validate a fixed-Main, D-023 e1RM attempt without touching Training state. */
export function challengeBoss(input: {
  readonly bossBattle: BossBattleState | undefined;
  readonly currentDayIndex: number;
  readonly dailyQuestCount: number;
  readonly mainExerciseId: ExerciseId;
  readonly exerciseId: string;
  readonly weightKg: unknown;
  readonly reps: unknown;
}): BossChallengeResult {
  if (input.bossBattle === undefined || input.currentDayIndex !== input.dailyQuestCount) {
    return { status: 'boss_locked' };
  }
  if (input.bossBattle.defeated) return { status: 'already_defeated' };
  if (input.exerciseId !== input.mainExerciseId || !isBossE1rmExerciseId(input.mainExerciseId)) {
    return { status: 'exercise_mismatch' };
  }
  if (!isPositiveFinite(input.weightKg)) return { status: 'invalid_weight' };
  if (typeof input.reps !== 'number' || !Number.isSafeInteger(input.reps) || input.reps < 1 || input.reps > 10) {
    return { status: 'invalid_reps' };
  }

  const estimate = calculateSetE1rm({ weightKg: input.weightKg, reps: input.reps });
  if (!estimate.eligible) return { status: 'invalid_reps' };
  const attempt: BossWinningAttempt = {
    exerciseId: input.mainExerciseId,
    weightKg: input.weightKg,
    reps: input.reps,
    estimatedE1rmKg: estimate.estimated1rmKg,
  };
  if (attempt.estimatedE1rmKg < input.bossBattle.targetE1rmKg) {
    return { status: 'defeat', attempt, bossBattle: input.bossBattle };
  }
  return {
    status: 'victory',
    attempt,
    bossBattle: { ...input.bossBattle, defeated: true, winningAttempt: attempt },
  };
}

export function isFinalGoalCleared(
  winningE1rmKg: number,
  finalGoalE1rmKg: number,
): boolean {
  return isPositiveFinite(winningE1rmKg) && isPositiveFinite(finalGoalE1rmKg) &&
    winningE1rmKg >= finalGoalE1rmKg;
}

/** Boss strength is useful only as the planning input; it is not a Workout Result. */
export function resolveNextStagePlanningStrength(
  bestClearedActualMainE1rmKg: number | undefined,
  winningBossE1rmKg: number,
): number | null {
  if (!isPositiveFinite(winningBossE1rmKg) ||
      (bestClearedActualMainE1rmKg !== undefined && !isPositiveFinite(bestClearedActualMainE1rmKg))) {
    return null;
  }
  return Math.max(bestClearedActualMainE1rmKg ?? 0, winningBossE1rmKg);
}
