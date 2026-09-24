import { getExerciseById } from './exerciseCatalog.js';
import {
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type ExerciseId,
  type MovementPattern,
  type MuscleGroup,
} from './exercise.js';
import { ROADMAP_DURATION_CANDIDATES } from './stagePlanning.js';

/** D-026 MVP schedule rule. Persist this version with generated roadmaps. */
export const STAGE_ROADMAP_GENERATION_RULE = {
  version: 'stage-roadmap-even-spread-v1',
} as const;

export type LocalDate = string;
export type RoadmapDurationDays = (typeof ROADMAP_DURATION_CANDIDATES)[number];
export type RoadmapDayType = 'training' | 'recovery';

export type StageSessionFocusPreset =
  | 'full_body'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs';

const FULL_BODY_MOVEMENTS: readonly MovementPattern[] = [...MOVEMENT_PATTERNS];
const UPPER_MUSCLES: readonly MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
const LOWER_MUSCLES: readonly MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];
const PUSH_MUSCLES: readonly MuscleGroup[] = ['chest', 'shoulders', 'triceps'];
const PULL_MUSCLES: readonly MuscleGroup[] = ['back', 'biceps'];
const LEGS_MUSCLES: readonly MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

const UPPER_MOVEMENTS: readonly MovementPattern[] = [
  'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
  'elbow_flexion', 'elbow_extension', 'shoulder_abduction', 'chest_fly',
];
const LOWER_MOVEMENTS: readonly MovementPattern[] = [
  'squat', 'hinge', 'knee_extension', 'knee_flexion', 'hip_extension', 'calf_raise',
];
const PUSH_MOVEMENTS: readonly MovementPattern[] = [
  'horizontal_push', 'vertical_push', 'chest_fly', 'elbow_extension', 'shoulder_abduction',
];
const PULL_MOVEMENTS: readonly MovementPattern[] = [
  'horizontal_pull', 'vertical_pull', 'elbow_flexion',
];
const LEGS_MOVEMENTS: readonly MovementPattern[] = [...LOWER_MOVEMENTS];

/** Typed, Catalog-backed focus presets. Presets are not UI or Product copy. */
export const STAGE_SESSION_FOCUS_PRESETS: Readonly<Record<StageSessionFocusPreset, StageSessionFocus>> = {
  full_body: { targetMuscles: [...MUSCLE_GROUPS], targetMovementPatterns: FULL_BODY_MOVEMENTS },
  upper: { targetMuscles: UPPER_MUSCLES, targetMovementPatterns: UPPER_MOVEMENTS },
  lower: { targetMuscles: LOWER_MUSCLES, targetMovementPatterns: LOWER_MOVEMENTS },
  push: { targetMuscles: PUSH_MUSCLES, targetMovementPatterns: PUSH_MOVEMENTS },
  pull: { targetMuscles: PULL_MUSCLES, targetMovementPatterns: PULL_MOVEMENTS },
  legs: { targetMuscles: LEGS_MUSCLES, targetMovementPatterns: LEGS_MOVEMENTS },
};

/** Session-order split cycles selected only from the existing 1..7 frequency. */
export const STAGE_SESSION_SPLIT_BY_FREQUENCY: Readonly<Record<number, readonly StageSessionFocusPreset[]>> = {
  1: ['full_body'],
  2: ['full_body', 'full_body'],
  3: ['upper', 'lower', 'full_body'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'legs', 'upper', 'lower'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
  7: ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'full_body'],
};

const BOSS_MAIN_EXPOSURE_PRESETS: Readonly<Record<string, readonly StageSessionFocusPreset[]>> = {
  barbell_bench_press: ['push', 'upper'],
  barbell_overhead_press: ['push', 'upper'],
  barbell_back_squat: ['legs', 'lower'],
  barbell_deadlift: ['pull', 'lower'],
  pull_up: ['pull', 'upper'],
};

export interface StageSessionFocus {
  readonly targetMuscles: readonly MuscleGroup[];
  readonly targetMovementPatterns?: readonly MovementPattern[];
}

export type StageRoadmapDay =
  | {
    readonly date: LocalDate;
    readonly type: 'training';
    readonly sessionFocus: StageSessionFocus;
    readonly bossMainExposure: boolean;
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

export type CurrentQuestRescheduleErrorCode =
  | 'INVALID_DATE'
  | 'INVALID_CURRENT_DAY_INDEX'
  | 'CURRENT_QUEST_UNAVAILABLE'
  | 'DATE_BEFORE_TODAY'
  | 'DATE_BEFORE_CURRENT_QUEST'
  | 'DATE_OUT_OF_RANGE';

export class CurrentQuestRescheduleError extends Error {
  public readonly name = 'CurrentQuestRescheduleError';

  public constructor(public readonly code: CurrentQuestRescheduleErrorCode) {
    super(`Invalid current quest reschedule request: ${code}`);
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

export function addLocalDays(startDate: LocalDate, days: number): LocalDate {
  const parts = parseLocalDate(startDate);
  if (parts === null) throw new StageRoadmapValidationError('INVALID_START_DATE');
  if (!Number.isSafeInteger(days)) throw new RangeError('Calendar day offset must be a safe integer.');
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  const result = formatLocalDate(date);
  if (parseLocalDate(result) === null) throw new RangeError('Calendar day result is outside LocalDate range.');
  return result;
}

/** Compare strict YYYY-MM-DD values without parsing them as local-time Date strings. */
export function compareLocalDates(left: LocalDate, right: LocalDate): -1 | 0 | 1 {
  if (parseLocalDate(left) === null || parseLocalDate(right) === null) {
    throw new StageRoadmapValidationError('INVALID_START_DATE');
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

function localDateOrdinal(parts: LocalDateParts): number {
  let year = parts.year;
  const adjustedYear = year - (parts.month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  year = adjustedYear - era * 400;
  const shiftedMonth = parts.month + (parts.month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + parts.day - 1;
  const dayOfEra = year * 365 + Math.floor(year / 4) - Math.floor(year / 100) + dayOfYear;
  return era * 146097 + dayOfEra;
}

/** Return the signed Gregorian calendar-day distance `later - earlier`, without milliseconds or timezone. */
export function differenceLocalDays(later: LocalDate, earlier: LocalDate): number {
  const laterParts = parseLocalDate(later);
  const earlierParts = parseLocalDate(earlier);
  if (laterParts === null || earlierParts === null) {
    throw new StageRoadmapValidationError('INVALID_START_DATE');
  }
  return localDateOrdinal(laterParts) - localDateOrdinal(earlierParts);
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

function getBossMainExposureOrdinals(
  trainingFrequencyPerWeek: number,
  mainExerciseId: ExerciseId,
): readonly number[] {
  if (trainingFrequencyPerWeek === 1) return [0];
  if (trainingFrequencyPerWeek === 2) return [0];

  const cycle = STAGE_SESSION_SPLIT_BY_FREQUENCY[trainingFrequencyPerWeek];
  const exposurePresets = BOSS_MAIN_EXPOSURE_PRESETS[mainExerciseId] ?? [];
  const cycleExposurePresets = trainingFrequencyPerWeek === 3
    ? [...exposurePresets, 'full_body' as const]
    : exposurePresets;
  const matching = cycle
    .map((preset, ordinal) => cycleExposurePresets.includes(preset) ? ordinal : -1)
    .filter((ordinal) => ordinal >= 0);
  return matching.slice(0, 2);
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
  const splitCycle = STAGE_SESSION_SPLIT_BY_FREQUENCY[trainingFrequencyPerWeek];
  const bossMainExposureOrdinals = new Set(
    getBossMainExposureOrdinals(trainingFrequencyPerWeek, mainExercise.id),
  );
  let trainingSessionOrdinal = 0;

  const days: StageRoadmapDay[] = Array.from({ length: durationDays }, (_, index) => {
    const date = addLocalDays(startDate, index);
    if (!trainingOffsets.has(index % 7)) return { date, type: 'recovery' };

    const split = splitCycle[trainingSessionOrdinal % splitCycle.length];
    const sessionFocus = STAGE_SESSION_FOCUS_PRESETS[split];
    const bossMainExposure = bossMainExposureOrdinals.has(
      trainingSessionOrdinal % splitCycle.length,
    );
    trainingSessionOrdinal += 1;
    return {
      date,
      type: 'training',
      sessionFocus: {
        targetMuscles: [...sessionFocus.targetMuscles],
        targetMovementPatterns: [...sessionFocus.targetMovementPatterns!],
      },
      bossMainExposure,
    };
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

/** Delay the current Daily Quest slot and every subsequent slot by the same calendar-day offset. */
export function rescheduleCurrentQuest(
  roadmap: StageRoadmap,
  currentDayIndex: number,
  newDate: LocalDate,
  today: LocalDate,
): StageRoadmap {
  if (parseLocalDate(newDate) === null || parseLocalDate(today) === null) {
    throw new CurrentQuestRescheduleError('INVALID_DATE');
  }
  if (!Number.isSafeInteger(currentDayIndex) || currentDayIndex < 0) {
    throw new CurrentQuestRescheduleError('INVALID_CURRENT_DAY_INDEX');
  }
  if (currentDayIndex >= roadmap.days.length) {
    throw new CurrentQuestRescheduleError('CURRENT_QUEST_UNAVAILABLE');
  }
  const currentQuest = roadmap.days[currentDayIndex];
  if (currentQuest === undefined) {
    throw new CurrentQuestRescheduleError('CURRENT_QUEST_UNAVAILABLE');
  }
  if (parseLocalDate(currentQuest.date) === null) {
    throw new CurrentQuestRescheduleError('INVALID_DATE');
  }
  if (compareLocalDates(newDate, today) < 0) {
    throw new CurrentQuestRescheduleError('DATE_BEFORE_TODAY');
  }
  if (compareLocalDates(newDate, currentQuest.date) < 0) {
    throw new CurrentQuestRescheduleError('DATE_BEFORE_CURRENT_QUEST');
  }
  if (newDate === currentQuest.date) return roadmap;

  const shiftDays = differenceLocalDays(newDate, currentQuest.date);
  try {
    const days = roadmap.days.map((day, index) => index < currentDayIndex
      ? day
      : { ...day, date: addLocalDays(day.date, shiftDays) });
    const boss = { ...roadmap.boss, date: addLocalDays(roadmap.boss.date, shiftDays) };
    return { ...roadmap, days, boss };
  } catch {
    throw new CurrentQuestRescheduleError('DATE_OUT_OF_RANGE');
  }
}
