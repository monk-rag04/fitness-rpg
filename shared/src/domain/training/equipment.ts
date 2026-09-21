export const EQUIPMENT_IDS = [
  'barbell',
  'dumbbell',
  'flat_bench',
  'adjustable_bench',
  'squat_rack',
  'power_rack',
  'smith_machine',
  'cable_machine',
  'pullup_bar',
  'chest_press_machine',
  'shoulder_press_machine',
  'lat_pulldown_machine',
  'seated_row_machine',
  'leg_press_machine',
  'leg_extension_machine',
  'leg_curl_machine',
] as const;

export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export interface EquipmentDefinition {
  readonly id: EquipmentId;
  readonly displayName: string;
}

export interface GymEquipmentProfile {
  readonly id: string;
  readonly displayName: string;
  readonly availableEquipmentIds: readonly EquipmentId[];
}
