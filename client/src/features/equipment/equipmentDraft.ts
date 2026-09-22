import type { EquipmentId } from '@fitness-rpg/shared';

export type EquipmentDraft =
  | { readonly kind: 'unselected' }
  | { readonly kind: 'equipment'; readonly equipmentIds: readonly EquipmentId[] }
  | { readonly kind: 'no_equipment' };

export const INITIAL_EQUIPMENT_DRAFT: EquipmentDraft = { kind: 'unselected' };

/** Convert a persisted Stage profile into the local, presentational draft. */
export function equipmentDraftFromEquipmentIds(
  equipmentIds: readonly EquipmentId[] | undefined,
): EquipmentDraft {
  if (equipmentIds === undefined) return INITIAL_EQUIPMENT_DRAFT;
  return equipmentIds.length === 0
    ? { kind: 'no_equipment' }
    : { kind: 'equipment', equipmentIds: [...equipmentIds] };
}

export function toggleEquipment(draft: EquipmentDraft, equipmentId: EquipmentId): EquipmentDraft {
  const selected = draft.kind === 'equipment' ? draft.equipmentIds : [];
  const next = selected.includes(equipmentId)
    ? selected.filter((id) => id !== equipmentId)
    : [...selected, equipmentId];
  return next.length === 0 ? INITIAL_EQUIPMENT_DRAFT : { kind: 'equipment', equipmentIds: next };
}

export function toggleNoEquipment(draft: EquipmentDraft): EquipmentDraft {
  return draft.kind === 'no_equipment' ? INITIAL_EQUIPMENT_DRAFT : { kind: 'no_equipment' };
}

export function equipmentIdsForSubmission(draft: EquipmentDraft): readonly EquipmentId[] | null {
  if (draft.kind === 'unselected') return null;
  return draft.kind === 'no_equipment' ? [] : draft.equipmentIds;
}

export function selectedChoiceCount(draft: EquipmentDraft): number {
  return draft.kind === 'equipment' ? draft.equipmentIds.length : draft.kind === 'no_equipment' ? 1 : 0;
}

export function submitEquipmentDraft(
  draft: EquipmentDraft,
  onSubmit: (equipmentIds: readonly EquipmentId[]) => void,
): boolean {
  const equipmentIds = equipmentIdsForSubmission(draft);
  if (equipmentIds === null) return false;
  onSubmit(equipmentIds);
  return true;
}
