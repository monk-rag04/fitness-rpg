import type { EquipmentId } from './equipment.js';

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'horizontal_pull',
  'vertical_push',
  'vertical_pull',
  'squat',
  'hinge',
  'knee_extension',
  'knee_flexion',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_abduction',
  'chest_fly',
  'hip_extension',
  'calf_raise',
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const EXERCISE_DIFFICULTIES = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];

export const EXERCISE_IDS = [
  'barbell_bench_press',
  'dumbbell_bench_press',
  'incline_dumbbell_press',
  'chest_press_machine',
  'cable_chest_fly',
  'dumbbell_chest_fly',
  'push_up',
  'barbell_bent_over_row',
  'one_arm_dumbbell_row',
  'seated_row_machine',
  'lat_pulldown',
  'pull_up',
  'barbell_deadlift',
  'barbell_overhead_press',
  'dumbbell_shoulder_press',
  'shoulder_press_machine',
  'dumbbell_lateral_raise',
  'cable_lateral_raise',
  'barbell_curl',
  'dumbbell_curl',
  'cable_curl',
  'cable_triceps_pushdown',
  'dumbbell_overhead_triceps_extension',
  'close_grip_bench_press',
  'barbell_back_squat',
  'goblet_squat',
  'smith_machine_squat',
  'leg_press',
  'leg_extension',
  'romanian_deadlift',
  'seated_leg_curl',
  'standing_calf_raise',
  'barbell_hip_thrust',
  'glute_bridge',
] as const;

export type ExerciseId = (typeof EXERCISE_IDS)[number];

/** MVP bodyweight exercises use reps only; weighted variants are out of scope. */
export const BODYWEIGHT_EXERCISE_IDS = [
  'push_up',
  'pull_up',
  'glute_bridge',
] as const satisfies readonly ExerciseId[];

export function isBodyweightExerciseId(exerciseId: string): boolean {
  return BODYWEIGHT_EXERCISE_IDS.some((id) => id === exerciseId);
}

export type RequiredEquipmentOption = readonly EquipmentId[];

export interface ExerciseDefinition {
  readonly id: ExerciseId;
  readonly displayName: string;
  readonly primaryMuscles: readonly [MuscleGroup, ...MuscleGroup[]];
  readonly secondaryMuscles: readonly MuscleGroup[];
  readonly movementPattern: MovementPattern;
  readonly difficulty: ExerciseDifficulty;
  /**
   * Each inner array is a complete equipment set. An exercise is available
   * when at least one complete set is satisfied. `[[]]` means no equipment.
   */
  readonly requiredEquipmentOptions: readonly RequiredEquipmentOption[];
  readonly alternativeExerciseIds: readonly ExerciseId[];
}
