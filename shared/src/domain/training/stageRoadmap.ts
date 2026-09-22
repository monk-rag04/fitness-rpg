import { getExerciseById } from './exerciseCatalog.js';
import type { ExerciseId, MovementPattern, MuscleGroup } from './exercise.js';
import { ROADMAP_DURATION_CANDIDATES } from './stagePlanning.js';

/** D-026 MVP schedule rule. Persist this version with generated roadmaps. */
export const STAGE_ROADMAP_GENERATION_RULE = {
  version: 'stage-roadmap-even-spread-v1',
} as const;

export type LocalDate = string;
export type RoadmapDurationDays = (typeof ROADMAP_DURATION_CANDIDATES)[number];
export type RoadmapDayType = 'training' | 'recovery';

export interface StageSessionFocus {
  readonly targetMuscles: readonly MuscleGroup[];
  readonly targetMovementPatterns?: readonly MovementPattern[];
}

export type StageRoadmapDay =
  | {
    readonly date: LocalDate;
    readonly type: 'training';
    readonly sessionFocus: StageSessionFocus;
  }
  | {
    readonly date: LocalDate;
    readonly type: 'recovery';
  };

export interface StageBossAnchor {
  readonly type: 'boss';
  readonly date: LocalDate;
}

export interface StageRoadmap {
  readonly startDate: LocalDate;
  readonly durationDays: RoadmapDurationDays;
  readonly trainingFrequencyPerWeek: number;
  readonly mainExerciseId: ExerciseId;
  readonly stageTargetE1rmKg: number;
  readonly days: readonly StageRoadmapDay[];
  readonly boss: StageBossAnchor;
  readonly generationRuleVersion: typeof STAGE_ROADMAP_GENERATION_RULE.version;
}

export interface StageRoadmapGenerationInput {
  readonly startDate: LocalDate;
  readonly durationDays: RoadmapDurationDays;
  readonly trainingFrequencyPerWeek: number;
  readonly mainExerciseId: ExerciseId;
  readonly stageTargetE1rmKg: number;
}

export type StageRoadmapValidationErrorCode =
  | 'INVALID_INPUT_SHAPE'
  | 'INVALID_FIELD'
  | 'INVALID_START_DATE'
  | 'INVALID_DURATION_DAYS'
  | 'INVALID_TRAINING_FREQUENCY'
  | 'INVALID_MAIN_EXERCISE_ID'
  | 'INVALID_STAGE_TARGET_E1RM';

export class StageRoadmapValidationError extends Error {
  public readonly name = 'StageRoadmapValidationError';

  public constructor(public readonly code: StageRoadmapValidationErrorCode) {
    super(`Invalid stage roadmap input: ${code}`);
  }
}

export type StageRoadmapRescheduleErrorCode =
  | 'INVALID_DATE'
  | 'SOURCE_EQUALS_TARGET'
  | 'DATE_OUTSIDE_ROADMAP'
  | 'SOURCE_NOT_TRAINING'
  | 'TARGET_NOT_RECOVERY'
  | 'TARGET_NOT_FUTURE'
  | 'TARGET_IS_BOSS_DATE';

export class StageRoadmapRescheduleError extends Error {
  public readonly name = 'StageRoadmapRescheduleError';

  public constructor(public readonly code: StageRoadmapRescheduleErrorCode) {
    super(`Invalid stage roadmap reschedule request: ${code}`);
  }
}

interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLocalDate(value: unknown): LocalDateParts | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** Share D-026's strict calendar validation with application input boundaries. */
export function isValidLocalDate(value: unknown): value is LocalDate {
  return parseLocalDate(value) !== null;
}

function formatLocalDate(date: Date): LocalDate {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addLocalDays(startDate: LocalDate, days: number): LocalDate {
  const parts = parseLocalDate(startDate);
  if (parts === null) throw new StageRoadmapValidationError('INVALID_START_DATE');
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDate(date);
}

function isRoadmapDurationDays(value: unknown): value is RoadmapDurationDays {
  return typeof value === 'number' && ROADMAP_DURATION_CANDIDATES.some((candidate) => candidate === value);
}

/** Week-relative, deterministic offsets for the fixed 1..7 schedule range. */
export function getTrainingOffsetsForFrequency(trainingFrequencyPerWeek: number): readonly number[] {
  if (!Number.isSafeInteger(trainingFrequencyPerWeek) ||
      trainingFrequencyPerWeek < 1 || trainingFrequencyPerWeek > 7) {
    throw new StageRoadmapValidationError('INVALID_TRAINING_FREQUENCY');
  }
  return Array.from(
    { length: trainingFrequencyPerWeek },
    (_, index) => Math.floor(index * 7 / trainingFrequencyPerWeek),
  );
}

function assertGenerationInput(input: unknown): asserts input is Record<string, unknown> {
  if (!isRecord(input)) throw new StageRoadmapValidationError('INVALID_INPUT_SHAPE');
  const allowedFields = [
    'startDate',
    'durationDays',
    'trainingFrequencyPerWeek',
    'mainExerciseId',
    'stageTargetE1rmKg',
  ];
  if (Object.keys(input).some((field) => !allowedFields.includes(field))) {
    throw new StageRoadmapValidationError('INVALID_FIELD');
  }
  if (parseLocalDate(input.startDate) === null) {
    throw new StageRoadmapValidationError('INVALID_START_DATE');
  }
  if (!isRoadmapDurationDays(input.durationDays)) {
    throw new StageRoadmapValidationError('INVALID_DURATION_DAYS');
  }
  const trainingFrequencyPerWeek = input.trainingFrequencyPerWeek;
  if (typeof trainingFrequencyPerWeek !== 'number' ||
      !Number.isSafeInteger(trainingFrequencyPerWeek) ||
      trainingFrequencyPerWeek < 1 || trainingFrequencyPerWeek > 7) {
    throw new StageRoadmapValidationError('INVALID_TRAINING_FREQUENCY');
  }
  if (typeof input.mainExerciseId !== 'string' || getExerciseById(input.mainExerciseId) === undefined) {
    throw new StageRoadmapValidationError('INVALID_MAIN_EXERCISE_ID');
  }
  if (typeof input.stageTargetE1rmKg !== 'number' ||
      !Number.isFinite(input.stageTargetE1rmKg) || input.stageTargetE1rmKg <= 0) {
    throw new StageRoadmapValidationError('INVALID_STAGE_TARGET_E1RM');
  }
}

/**
 * Generate stage-duration calendar days plus one Boss anchor. This deliberately
 * excludes state, quest outcomes, scheduling persistence, and side effects.
 */
export function generateStageRoadmap(input: unknown): StageRoadmap {
  assertGenerationInput(input);
  const startDate = input.startDate as LocalDate;
  const durationDays = input.durationDays as RoadmapDurationDays;
  const trainingFrequencyPerWeek = input.trainingFrequencyPerWeek as number;
  const mainExercise = getExerciseById(input.mainExerciseId as string)!;
  const trainingOffsets = new Set(getTrainingOffsetsForFrequency(trainingFrequencyPerWeek));
  const sessionFocus: StageSessionFocus = {
    targetMuscles: [...mainExercise.primaryMuscles],
  };

  const days: StageRoadmapDay[] = Array.from({ length: durationDays }, (_, index) => {
    const date = addLocalDays(startDate, index);
    return trainingOffsets.has(index % 7)
      ? { date, type: 'training', sessionFocus: { targetMuscles: [...sessionFocus.targetMuscles] } }
      : { date, type: 'recovery' };
  });

  return {
    startDate,
    durationDays,
    trainingFrequencyPerWeek,
    mainExerciseId: mainExercise.id,
    stageTargetE1rmKg: input.stageTargetE1rmKg as number,
    days,
    boss: { type: 'boss', date: addLocalDays(startDate, durationDays) },
    generationRuleVersion: STAGE_ROADMAP_GENERATION_RULE.version,
  };
}

function assertRescheduleDate(value: unknown): asserts value is LocalDate {
  if (parseLocalDate(value) === null) throw new StageRoadmapRescheduleError('INVALID_DATE');
}

/**
 * Move one training day's focus to a later recovery day without changing the
 * stage duration, boss anchor, target, or any game state.
 */
export function rescheduleTrainingDay(
  roadmap: StageRoadmap,
  sourceDate: LocalDate,
  targetDate: LocalDate,
): StageRoadmap {
  assertRescheduleDate(sourceDate);
  assertRescheduleDate(targetDate);
  if (sourceDate === targetDate) throw new StageRoadmapRescheduleError('SOURCE_EQUALS_TARGET');
  if (targetDate === roadmap.boss.date) throw new StageRoadmapRescheduleError('TARGET_IS_BOSS_DATE');

  const sourceIndex = roadmap.days.findIndex((day) => day.date === sourceDate);
  const targetIndex = roadmap.days.findIndex((day) => day.date === targetDate);
  if (sourceIndex < 0 || targetIndex < 0) throw new StageRoadmapRescheduleError('DATE_OUTSIDE_ROADMAP');
  if (targetDate <= sourceDate) throw new StageRoadmapRescheduleError('TARGET_NOT_FUTURE');

  const source = roadmap.days[sourceIndex];
  const target = roadmap.days[targetIndex];
  if (source.type !== 'training') throw new StageRoadmapRescheduleError('SOURCE_NOT_TRAINING');
  if (target.type !== 'recovery') throw new StageRoadmapRescheduleError('TARGET_NOT_RECOVERY');

  const movedFocus: StageSessionFocus = {
    targetMuscles: [...source.sessionFocus.targetMuscles],
  };
  const days = roadmap.days.map((day, index): StageRoadmapDay => {
    if (index === sourceIndex) return { date: day.date, type: 'recovery' };
    if (index === targetIndex) return { date: day.date, type: 'training', sessionFocus: movedFocus };
    return day.type === 'training'
      ? { date: day.date, type: 'training', sessionFocus: { targetMuscles: [...day.sessionFocus.targetMuscles] } }
      : { date: day.date, type: 'recovery' };
  });

  return { ...roadmap, days, boss: { ...roadmap.boss } };
}
