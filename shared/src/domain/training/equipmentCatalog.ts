import type { EquipmentDefinition, EquipmentId } from './equipment.js';

export const EQUIPMENT_CATALOG = [
  { id: 'barbell', displayName: 'Barbell' },
  { id: 'dumbbell', displayName: 'Dumbbell' },
  { id: 'flat_bench', displayName: 'Flat Bench' },
  { id: 'adjustable_bench', displayName: 'Adjustable Bench' },
  { id: 'squat_rack', displayName: 'Squat Rack' },
  { id: 'power_rack', displayName: 'Power Rack' },
  { id: 'smith_machine', displayName: 'Smith Machine' },
  { id: 'cable_machine', displayName: 'Cable Machine' },
  { id: 'pullup_bar', displayName: 'Pull-up Bar' },
  { id: 'chest_press_machine', displayName: 'Chest Press Machine' },
  { id: 'shoulder_press_machine', displayName: 'Shoulder Press Machine' },
  { id: 'lat_pulldown_machine', displayName: 'Lat Pulldown Machine' },
  { id: 'seated_row_machine', displayName: 'Seated Row Machine' },
  { id: 'leg_press_machine', displayName: 'Leg Press Machine' },
  { id: 'leg_extension_machine', displayName: 'Leg Extension Machine' },
  { id: 'leg_curl_machine', displayName: 'Leg Curl Machine' },
] as const satisfies readonly EquipmentDefinition[];

const equipmentById = new Map<EquipmentId, EquipmentDefinition>(
  EQUIPMENT_CATALOG.map((equipment) => [equipment.id, equipment]),
);

export function getEquipmentById(
  equipmentId: EquipmentId,
): EquipmentDefinition | undefined {
  return equipmentById.get(equipmentId);
}
