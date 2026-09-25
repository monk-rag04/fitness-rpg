import type {
  EquipmentId,
  ExerciseId,
  MuscleGroup,
} from "@fitness-rpg/shared";

const equipmentLabels: Record<EquipmentId, string> = {
  barbell: "バーベル",
  dumbbell: "ダンベル",
  flat_bench: "フラットベンチ",
  adjustable_bench: "アジャスタブルベンチ",
  squat_rack: "スクワットラック",
  power_rack: "パワーラック",
  smith_machine: "スミスマシン",
  cable_machine: "ケーブルマシン",
  pullup_bar: "懸垂バー",
  chest_press_machine: "チェストプレスマシン",
  shoulder_press_machine: "ショルダープレスマシン",
  lat_pulldown_machine: "ラットプルダウンマシン",
  seated_row_machine: "シーテッドローマシン",
  leg_press_machine: "レッグプレスマシン",
  leg_extension_machine: "レッグエクステンションマシン",
  leg_curl_machine: "レッグカールマシン",
};

const exerciseLabels: Record<ExerciseId, string> = {
  barbell_bench_press: "バーベルベンチプレス",
  dumbbell_bench_press: "ダンベルベンチプレス",
  incline_dumbbell_press: "インクラインダンベルプレス",
  chest_press_machine: "チェストプレスマシン",
  cable_chest_fly: "ケーブルチェストフライ",
  dumbbell_chest_fly: "ダンベルチェストフライ",
  push_up: "プッシュアップ",
  barbell_bent_over_row: "バーベルベントオーバーロー",
  one_arm_dumbbell_row: "ワンハンドダンベルロー",
  seated_row_machine: "シーテッドローマシン",
  lat_pulldown: "ラットプルダウン",
  pull_up: "プルアップ",
  barbell_deadlift: "バーベルデッドリフト",
  barbell_overhead_press: "バーベルオーバーヘッドプレス",
  dumbbell_shoulder_press: "ダンベルショルダープレス",
  shoulder_press_machine: "ショルダープレスマシン",
  dumbbell_lateral_raise: "ダンベルラテラルレイズ",
  cable_lateral_raise: "ケーブルラテラルレイズ",
  barbell_curl: "バーベルカール",
  dumbbell_curl: "ダンベルカール",
  cable_curl: "ケーブルカール",
  cable_triceps_pushdown: "ケーブルトライセプスプレスダウン",
  dumbbell_overhead_triceps_extension: "ダンベルオーバーヘッドトライセプスエクステンション",
  close_grip_bench_press: "ナローグリップベンチプレス",
  barbell_back_squat: "バーベルバックスクワット",
  goblet_squat: "ゴブレットスクワット",
  smith_machine_squat: "スミスマシンスクワット",
  leg_press: "レッグプレス",
  leg_extension: "レッグエクステンション",
  romanian_deadlift: "ルーマニアンデッドリフト",
  seated_leg_curl: "シーテッドレッグカール",
  standing_calf_raise: "スタンディングカーフレイズ",
  barbell_hip_thrust: "バーベルヒップスラスト",
  glute_bridge: "グルートブリッジ",
};

const muscleLabels: Record<MuscleGroup, string> = {
  chest: "胸",
  back: "背中",
  shoulders: "肩",
  biceps: "上腕二頭筋",
  triceps: "上腕三頭筋",
  quads: "大腿四頭筋",
  hamstrings: "ハムストリングス",
  glutes: "臀部",
  calves: "ふくらはぎ",
};

const barbellExerciseIds = new Set<ExerciseId>([
  "barbell_bench_press",
  "barbell_bent_over_row",
  "barbell_deadlift",
  "barbell_overhead_press",
  "barbell_curl",
  "close_grip_bench_press",
  "barbell_back_squat",
  "barbell_hip_thrust",
]);

const dumbbellExerciseIds = new Set<ExerciseId>([
  "dumbbell_bench_press",
  "incline_dumbbell_press",
  "dumbbell_chest_fly",
  "one_arm_dumbbell_row",
  "dumbbell_shoulder_press",
  "dumbbell_lateral_raise",
  "dumbbell_curl",
  "dumbbell_overhead_triceps_extension",
]);

const machineOrCableExerciseIds = new Set<ExerciseId>([
  "chest_press_machine",
  "cable_chest_fly",
  "seated_row_machine",
  "lat_pulldown",
  "shoulder_press_machine",
  "cable_lateral_raise",
  "cable_curl",
  "cable_triceps_pushdown",
  "smith_machine_squat",
  "leg_press",
  "leg_extension",
  "seated_leg_curl",
]);

export function equipmentLabel(id: string): string {
  return equipmentLabels[id as EquipmentId] ?? id;
}

export function exerciseLabel(id: string): string {
  return exerciseLabels[id as ExerciseId] ?? id;
}

export function muscleLabel(id: string): string {
  return muscleLabels[id as MuscleGroup] ?? id;
}

/** Only explicitly unambiguous Catalog exercises receive a weight convention hint. */
export function weightEntryHint(exerciseId: string): string | undefined {
  if (barbellExerciseIds.has(exerciseId as ExerciseId)) return "バーを含む総重量";
  if (dumbbellExerciseIds.has(exerciseId as ExerciseId)) return "ダンベル1個あたりの重量";
  if (machineOrCableExerciseIds.has(exerciseId as ExerciseId)) return "その機械で設定した表示重量";
  return undefined;
}

const workoutResultErrorMessages: Record<string, string> = {
  INVALID_WORKOUT_RESULT_SHAPE: "記録内容を確認してください。",
  INVALID_FIELD: "入力内容を確認してください。",
  PLANNED_EXERCISE_NOT_FOUND: "予定された種目を確認できません。",
  PERFORMED_EXERCISE_NOT_FOUND: "記録する種目を確認できません。",
  INVALID_ROLE: "種目の区分を確認してください。",
  INVALID_PLANNED_SETS: "予定セット数を確認してください。",
  INVALID_PLANNED_REP_RANGE: "予定回数を確認してください。",
  INVALID_COMPLETED_SETS: "記録したセットを確認してください。",
  EMPTY_COMPLETED_SETS: "少なくとも1セットを記録してください。",
  INVALID_SET_NUMBER: "セット番号を確認してください。",
  DUPLICATE_SET_NUMBER: "同じセット番号が重複しています。",
  INVALID_WEIGHT_KG: "重量は0より大きい数値で入力してください。",
  WEIGHT_NOT_ALLOWED_FOR_BODYWEIGHT: "自重種目では重量を記録せず、回数を入力してください。",
  INVALID_REPS: "回数は1以上の整数で入力してください。",
  INVALID_PERFORMED_AT: "記録日時を確認してください。",
};

export function workoutResultErrorMessage(code: string): string {
  return workoutResultErrorMessages[code] ?? "記録内容を確認してください。";
}
