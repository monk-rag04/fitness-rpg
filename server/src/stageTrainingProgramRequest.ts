import {
  EQUIPMENT_IDS,
  MUSCLE_GROUPS,
  MOVEMENT_PATTERNS,
  ROADMAP_DURATION_CANDIDATES,
  STAGE_ROADMAP_GENERATION_RULE,
  addLocalDays,
  differenceLocalDays,
  generateStageRoadmap,
  getExerciseById,
  isValidLocalDate,
  type EquipmentId,
  type ExerciseId,
  type LocalDate,
  type MovementPattern,
  type MuscleGroup,
  type StageRoadmap,
  type StageRoadmapDay,
  type StageSessionFocus,
} from '@fitness-rpg/shared';

export interface StageTrainingProgramRequest {
  readonly equipmentIds: readonly EquipmentId[];
  readonly mainExerciseId: ExerciseId;
  readonly currentE1rmKg: number;
  readonly stageTargetE1rmKg: number;
  readonly trainingExperienceMonths: number;
  readonly trainingFrequencyPerWeek: number;
  readonly roadmap: StageRoadmap;
}

export type StageTrainingProgramRequestErrorCode =
  | 'INVALID_INPUT_SHAPE'
  | 'INVALID_FIELD'
  | 'INVALID_EQUIPMENT'
  | 'INVALID_MAIN_EXERCISE'
  | 'INVALID_CURRENT_E1RM'
  | 'INVALID_STAGE_TARGET_E1RM'
  | 'INVALID_TRAINING_EXPERIENCE_MONTHS'
  | 'INVALID_TRAINING_FREQUENCY'
  | 'INVALID_ROADMAP'
  | 'ROADMAP_MAIN_MISMATCH'
  | 'ROADMAP_STAGE_TARGET_MISMATCH'
  | 'ROADMAP_FREQUENCY_MISMATCH';

export interface StageTrainingProgramRequestError {
  readonly code: StageTrainingProgramRequestErrorCode;
  readonly path: string;
}

export type StageTrainingProgramRequestValidationResult =
  | { readonly valid: true; readonly value: StageTrainingProgramRequest }
  | { readonly valid: false; readonly errors: readonly StageTrainingProgramRequestError[] };

const REQUEST_FIELDS = [
  'equipmentIds',
  'mainExerciseId',
  'currentE1rmKg',
  'stageTargetE1rmKg',
  'trainingExperienceMonths',
  'trainingFrequencyPerWeek',
  'roadmap',
] as const;

const ROADMAP_FIELDS = [
  'startDate',
  'durationDays',
  'trainingFrequencyPerWeek',
  'mainExerciseId',
  'stageTargetE1rmKg',
  'days',
  'boss',
  'generationRuleVersion',
] as const;

const BOSS_FIELDS = ['type', 'date'] as const;
const TRAINING_DAY_FIELDS = ['date', 'type', 'sessionFocus', 'bossMainExposure'] as const;
const RECOVERY_DAY_FIELDS = ['date', 'type'] as const;
const SESSION_FOCUS_FIELDS = ['targetMuscles', 'targetMovementPatterns'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(value).every((field) => fields.includes(field));
}

function isKnownEquipmentId(value: unknown): value is EquipmentId {
  return typeof value === 'string' && EQUIPMENT_IDS.includes(value as EquipmentId);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidFrequency(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 7;
}

function isValidTrainingExperience(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSessionFocus(value: unknown): value is StageSessionFocus {
  if (!isRecord(value) || !hasOnlyFields(value, SESSION_FOCUS_FIELDS) ||
      !Array.isArray(value.targetMuscles) ||
      !value.targetMuscles.every((muscle) => MUSCLE_GROUPS.includes(muscle as MuscleGroup))) {
    return false;
  }

  return value.targetMovementPatterns === undefined ||
    (Array.isArray(value.targetMovementPatterns) &&
      value.targetMovementPatterns.every((movement) =>
        MOVEMENT_PATTERNS.includes(movement as MovementPattern),
      ));
}

function validateRoadmapDay(value: unknown): StageRoadmapDay | null {
  if (!isRecord(value) || typeof value.date !== 'string' || !isValidLocalDate(value.date)) return null;

  if (value.type === 'recovery') {
    return hasOnlyFields(value, RECOVERY_DAY_FIELDS)
      ? { date: value.date, type: 'recovery' }
      : null;
  }

  if (value.type !== 'training' || !hasOnlyFields(value, TRAINING_DAY_FIELDS) ||
      typeof value.bossMainExposure !== 'boolean' ||
      !isSessionFocus(value.sessionFocus)) {
    return null;
  }
  return {
    date: value.date,
    type: 'training',
    bossMainExposure: value.bossMainExposure,
    sessionFocus: {
      targetMuscles: [...value.sessionFocus.targetMuscles],
      ...(value.sessionFocus.targetMovementPatterns === undefined
        ? {}
        : { targetMovementPatterns: [...value.sessionFocus.targetMovementPatterns] }),
    },
  };
}

function validateRoadmap(value: unknown): StageRoadmap | null {
  try {
    if (!isRecord(value) || !hasOnlyFields(value, ROADMAP_FIELDS) ||
        typeof value.startDate !== 'string' || !isValidLocalDate(value.startDate) ||
        typeof value.durationDays !== 'number' ||
        !ROADMAP_DURATION_CANDIDATES.includes(value.durationDays as (typeof ROADMAP_DURATION_CANDIDATES)[number]) ||
        !isValidFrequency(value.trainingFrequencyPerWeek) ||
        typeof value.mainExerciseId !== 'string' ||
        getExerciseById(value.mainExerciseId) === undefined ||
        !isPositiveFinite(value.stageTargetE1rmKg) ||
        !Array.isArray(value.days) || value.days.length !== value.durationDays ||
        !isRecord(value.boss) || !hasOnlyFields(value.boss, BOSS_FIELDS) ||
        value.boss.type !== 'boss' || typeof value.boss.date !== 'string' ||
        !isValidLocalDate(value.boss.date) ||
        value.generationRuleVersion !== STAGE_ROADMAP_GENERATION_RULE.version) {
      return null;
    }

    const days = value.days.map((day) => validateRoadmapDay(day));
    if (days.some((day) => day === null)) return null;
    const validatedDays = days as StageRoadmapDay[];

    let lastDelayOffset = 0;
    for (let index = 0; index < validatedDays.length; index += 1) {
      const canonicalDate = addLocalDays(value.startDate, index);
      const delayOffset = differenceLocalDays(validatedDays[index].date, canonicalDate);
      if (delayOffset < 0 || (index > 0 && delayOffset < lastDelayOffset)) return null;
      lastDelayOffset = delayOffset;
    }

    const canonicalBossDate = addLocalDays(value.startDate, value.durationDays);
    if (differenceLocalDays(value.boss.date, canonicalBossDate) !== lastDelayOffset) return null;

    const canonicalRoadmap = generateStageRoadmap({
      startDate: value.startDate,
      durationDays: value.durationDays,
      trainingFrequencyPerWeek: value.trainingFrequencyPerWeek,
      mainExerciseId: value.mainExerciseId,
      stageTargetE1rmKg: value.stageTargetE1rmKg,
    });
    if (validatedDays.some((day, index) => {
      const canonicalDay = canonicalRoadmap.days[index];
      if (day.type !== canonicalDay.type) return true;
      if (day.type === 'recovery') return false;
      if (canonicalDay.type !== 'training') return true;
      return day.bossMainExposure !== canonicalDay.bossMainExposure ||
        JSON.stringify(day.sessionFocus) !== JSON.stringify(canonicalDay.sessionFocus);
    })) return null;

    return {
      startDate: value.startDate,
      durationDays: value.durationDays as StageRoadmap['durationDays'],
      trainingFrequencyPerWeek: value.trainingFrequencyPerWeek,
      mainExerciseId: value.mainExerciseId as ExerciseId,
      stageTargetE1rmKg: value.stageTargetE1rmKg,
      days: validatedDays,
      boss: { type: 'boss', date: value.boss.date },
      generationRuleVersion: STAGE_ROADMAP_GENERATION_RULE.version,
    };
  } catch {
    return null;
  }
}

/** Validate the public snapshot without accepting candidates, plans, or UI state. */
export function validateStageTrainingProgramRequest(
  body: unknown,
): StageTrainingProgramRequestValidationResult {
  if (!isRecord(body)) {
    return { valid: false, errors: [{ code: 'INVALID_INPUT_SHAPE', path: 'body' }] };
  }

  const errors: StageTrainingProgramRequestError[] = [];
  if (!hasOnlyFields(body, REQUEST_FIELDS)) {
    errors.push({ code: 'INVALID_FIELD', path: 'body' });
  }

  if (!Array.isArray(body.equipmentIds) || !body.equipmentIds.every(isKnownEquipmentId) ||
      new Set(body.equipmentIds).size !== body.equipmentIds.length) {
    errors.push({ code: 'INVALID_EQUIPMENT', path: 'body.equipmentIds' });
  }

  if (typeof body.mainExerciseId !== 'string' || getExerciseById(body.mainExerciseId) === undefined) {
    errors.push({ code: 'INVALID_MAIN_EXERCISE', path: 'body.mainExerciseId' });
  }
  if (!isPositiveFinite(body.currentE1rmKg)) {
    errors.push({ code: 'INVALID_CURRENT_E1RM', path: 'body.currentE1rmKg' });
  }
  if (!isPositiveFinite(body.stageTargetE1rmKg)) {
    errors.push({ code: 'INVALID_STAGE_TARGET_E1RM', path: 'body.stageTargetE1rmKg' });
  }
  if (!isValidTrainingExperience(body.trainingExperienceMonths)) {
    errors.push({ code: 'INVALID_TRAINING_EXPERIENCE_MONTHS', path: 'body.trainingExperienceMonths' });
  }
  if (!isValidFrequency(body.trainingFrequencyPerWeek)) {
    errors.push({ code: 'INVALID_TRAINING_FREQUENCY', path: 'body.trainingFrequencyPerWeek' });
  }

  const roadmap = validateRoadmap(body.roadmap);
  if (roadmap === null) {
    errors.push({ code: 'INVALID_ROADMAP', path: 'body.roadmap' });
  }

  if (errors.length > 0 || roadmap === null) {
    return { valid: false, errors };
  }

  if (body.mainExerciseId !== roadmap.mainExerciseId) {
    errors.push({ code: 'ROADMAP_MAIN_MISMATCH', path: 'body.mainExerciseId' });
  }
  if (body.stageTargetE1rmKg !== roadmap.stageTargetE1rmKg) {
    errors.push({ code: 'ROADMAP_STAGE_TARGET_MISMATCH', path: 'body.stageTargetE1rmKg' });
  }
  if (body.trainingFrequencyPerWeek !== roadmap.trainingFrequencyPerWeek) {
    errors.push({ code: 'ROADMAP_FREQUENCY_MISMATCH', path: 'body.trainingFrequencyPerWeek' });
  }
  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      equipmentIds: [...(body.equipmentIds as readonly EquipmentId[])],
      mainExerciseId: body.mainExerciseId as ExerciseId,
      currentE1rmKg: body.currentE1rmKg as number,
      stageTargetE1rmKg: body.stageTargetE1rmKg as number,
      trainingExperienceMonths: body.trainingExperienceMonths as number,
      trainingFrequencyPerWeek: body.trainingFrequencyPerWeek as number,
      roadmap,
    },
  };
}
