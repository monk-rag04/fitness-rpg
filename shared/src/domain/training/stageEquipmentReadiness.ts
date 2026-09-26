import type { EquipmentId } from './equipment.js';
import { getExerciseById } from './exerciseCatalog.js';

export const BASIC_STAGE_EQUIPMENT_IDS = [
  'barbell', 'dumbbell', 'flat_bench', 'adjustable_bench',
  'squat_rack', 'power_rack', 'cable_machine', 'pullup_bar',
] as const satisfies readonly EquipmentId[];

export const OPTIONAL_STAGE_EQUIPMENT_IDS = [
  'smith_machine', 'chest_press_machine', 'shoulder_press_machine',
  'lat_pulldown_machine', 'seated_row_machine', 'leg_press_machine',
  'leg_extension_machine', 'leg_curl_machine',
] as const satisfies readonly EquipmentId[];

export const MIN_BASIC_STAGE_EQUIPMENT_COUNT = 2;

export interface StageEquipmentReadiness {
  readonly selectedBasicCount: number;
  readonly mainRequiredEquipmentIds: readonly EquipmentId[];
  readonly missingMainEquipmentIds: readonly EquipmentId[];
  readonly mainAvailable: boolean;
  readonly ready: boolean;
}

/** Check the stage's equipment gate before any provider request. */
export function evaluateStageEquipmentReadiness(
  mainExerciseId: string,
  equipmentIds: readonly EquipmentId[],
): StageEquipmentReadiness {
  const selected = new Set(equipmentIds);
  const exercise = getExerciseById(mainExerciseId);
  const selectedBasicCount = BASIC_STAGE_EQUIPMENT_IDS.filter((id) => selected.has(id)).length;
  const options = exercise?.requiredEquipmentOptions ?? [];
  const mainRequiredEquipmentIds = [...new Set(options.flat())];
  const missingOptions = options.map((option) => option.filter((id) => !selected.has(id)));
  const mainAvailable = missingOptions.some((missing) => missing.length === 0);
  const missingMainEquipmentIds = mainAvailable
    ? []
    : (missingOptions.sort((left, right) => left.length - right.length)[0] ?? []);

  return {
    selectedBasicCount,
    mainRequiredEquipmentIds,
    missingMainEquipmentIds,
    mainAvailable,
    ready: mainAvailable && selectedBasicCount >= MIN_BASIC_STAGE_EQUIPMENT_COUNT,
  };
}
