import type { ExerciseId } from './exercise.js';
import type { TrainingExpCategory } from './characterGrowth.js';

/** Version this mapping with any generated or persisted exercise growth data. */
export const EXERCISE_EXP_CATEGORY_RULE_VERSION = 'exercise-exp-category-v1' as const;

export const EXERCISE_EXP_CATEGORY_BY_ID = {
  barbell_bench_press: 'chest',
  dumbbell_bench_press: 'chest',
  incline_dumbbell_press: 'chest',
  chest_press_machine: 'chest',
  cable_chest_fly: 'chest',
  dumbbell_chest_fly: 'chest',
  push_up: 'chest',
  close_grip_push_up: 'arms',
  barbell_bent_over_row: 'back',
  one_arm_dumbbell_row: 'back',
  seated_row_machine: 'back',
  lat_pulldown: 'back',
  pull_up: 'back',
  reverse_snow_angel: 'back',
  barbell_overhead_press: 'shoulders',
  dumbbell_shoulder_press: 'shoulders',
  pike_push_up: 'shoulders',
  shoulder_press_machine: 'shoulders',
  dumbbell_lateral_raise: 'shoulders',
  cable_lateral_raise: 'shoulders',
  barbell_curl: 'arms',
  dumbbell_curl: 'arms',
  cable_curl: 'arms',
  cable_triceps_pushdown: 'arms',
  dumbbell_overhead_triceps_extension: 'arms',
  close_grip_bench_press: 'arms',
  barbell_deadlift: 'legs',
  barbell_back_squat: 'legs',
  goblet_squat: 'legs',
  bodyweight_squat: 'legs',
  reverse_lunge: 'legs',
  smith_machine_squat: 'legs',
  leg_press: 'legs',
  leg_extension: 'legs',
  romanian_deadlift: 'legs',
  seated_leg_curl: 'legs',
  standing_calf_raise: 'legs',
  bodyweight_calf_raise: 'legs',
  barbell_hip_thrust: 'legs',
  glute_bridge: 'legs',
} as const satisfies Readonly<Record<ExerciseId, TrainingExpCategory>>;

/** Unknown IDs have no category; callers must reject them instead of defaulting. */
export function getExerciseExpCategory(
  exerciseId: string,
): TrainingExpCategory | undefined {
  return Object.hasOwn(EXERCISE_EXP_CATEGORY_BY_ID, exerciseId)
    ? EXERCISE_EXP_CATEGORY_BY_ID[exerciseId as ExerciseId]
    : undefined;
}
