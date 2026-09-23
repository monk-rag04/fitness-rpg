import assert from "node:assert/strict";
import test from "node:test";
import {
  equipmentLabel,
  exerciseLabel,
  muscleLabel,
  workoutResultErrorMessage,
} from "../src/presentation/trainingLabels.ts";

test("equipment ids map to Japanese presentation labels", () => {
  const expected = {
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

  for (const [id, label] of Object.entries(expected)) {
    assert.equal(equipmentLabel(id), label);
  }
});

test("exercise ids map to Japanese presentation labels", () => {
  const expected = {
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

  for (const [id, label] of Object.entries(expected)) {
    assert.equal(exerciseLabel(id), label);
  }
});

test("muscle ids map to Japanese labels and unknown ids fall back safely", () => {
  const expected = {
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

  for (const [id, label] of Object.entries(expected)) {
    assert.equal(muscleLabel(id), label);
  }

  assert.equal(equipmentLabel("unknown_equipment"), "unknown_equipment");
  assert.equal(exerciseLabel("unknown_exercise"), "unknown_exercise");
  assert.equal(muscleLabel("unknown_muscle"), "unknown_muscle");
});

test("workout result validation codes map to user-safe Japanese copy", () => {
  assert.equal(workoutResultErrorMessage("INVALID_WEIGHT_KG"), "重量は0より大きい数値で入力してください。");
  assert.equal(workoutResultErrorMessage("INVALID_FIELD"), "入力内容を確認してください。");
  assert.equal(workoutResultErrorMessage("future_internal_code"), "記録内容を確認してください。");
  assert.doesNotMatch(workoutResultErrorMessage("future_internal_code"), /future_internal_code/);
});
