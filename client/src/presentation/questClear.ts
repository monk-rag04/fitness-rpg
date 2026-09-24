import type { QuestRewardSummary, TrainingExpCategory } from '@fitness-rpg/shared';

const trainingExpPresentationOrder: readonly (readonly [TrainingExpCategory, string])[] = [
  ['chest', '胸'],
  ['back', '背中'],
  ['shoulders', '肩'],
  ['arms', '腕'],
  ['legs', '脚'],
];

export interface TrainingExpPresentationRow {
  readonly category: TrainingExpCategory;
  readonly label: string;
  readonly amount: number;
}

/** Presentation-only Japanese labels and stable ordering for an applied reward snapshot. */
export function trainingExpPresentationRows(
  summary: QuestRewardSummary | null,
): readonly TrainingExpPresentationRow[] {
  if (summary === null || summary.questType !== 'training') return [];

  return trainingExpPresentationOrder.flatMap(([category, label]) => {
    const amount = summary.trainingExpGained[category];
    return typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0
      ? [{ category, label, amount }]
      : [];
  });
}
