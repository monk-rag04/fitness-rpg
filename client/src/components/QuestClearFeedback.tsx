import { QuestGoldButton, QuestSectionTitle } from './QuestUi';
import { useAdventureQuest } from '../state/AdventureQuestContext';
import { trainingExpPresentationRows } from '../presentation/questClear';
import type { QuestRewardSummary } from '@fitness-rpg/shared';

export function QuestClearFeedback() {
  const { isClearFeedbackVisible, questRewardSummary, continueAdventure } = useAdventureQuest();

  if (!isClearFeedbackVisible) {
    return null;
  }

  return (
    <QuestClearRewardContent
      rewardSummary={questRewardSummary}
      onContinue={continueAdventure}
    />
  );
}

export function QuestClearRewardContent({
  rewardSummary,
  onContinue,
}: {
  readonly rewardSummary: QuestRewardSummary | null;
  readonly onContinue: () => void;
}) {
  const trainingRows = trainingExpPresentationRows(rewardSummary);
  const completionLabel = rewardSummary?.questType === 'training'
    ? 'TRAINING COMPLETE'
    : rewardSummary?.questType === 'recovery'
      ? 'RECOVERY COMPLETE'
      : 'QUEST COMPLETE';

  return (
    <div className="quest-clear-backdrop" role="presentation">
      <div className="quest-clear-radiance" aria-hidden="true" />
      <section
        className="quest-clear-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-clear-title"
      >
        <p className="quest-clear-overlay__small">{completionLabel}</p>
        <h1 id="quest-clear-title" className="quest-clear-overlay__title">
          <span>QUEST</span>
          <span>CLEAR</span>
        </h1>

        {rewardSummary === null ? (
          <p className="quest-clear-unavailable" role="status">
            報酬情報を表示できませんでした。
          </p>
        ) : (
          <>
            {rewardSummary.questType === 'training' && (
              <section className="quest-clear-reward-card quest-clear-reward-card--training" aria-labelledby="quest-clear-growth-title">
                <QuestSectionTitle>
                  <span id="quest-clear-growth-title">CHARACTER GROWTH</span>
                </QuestSectionTitle>
                <p className="quest-clear-reward-card__subtitle">今回の獲得EXP</p>
                {trainingRows.length > 0 ? (
                  <dl className="quest-clear-reward-list">
                    {trainingRows.map(({ category, label, amount }) => (
                      <div className="quest-clear-reward-row" key={category}>
                        <dt>{label} EXP</dt>
                        <dd>+{amount}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="quest-clear-reward-empty">今回表示できるEXPはありません。</p>
                )}
              </section>
            )}

            {rewardSummary.questType === 'recovery' && rewardSummary.recoveryExpGained > 0 && (
              <dl className="quest-clear-reward-card quest-clear-reward-card--recovery">
                <div className="quest-clear-reward-row">
                  <dt>RECOVERY EXP</dt>
                  <dd>+{rewardSummary.recoveryExpGained}</dd>
                </div>
              </dl>
            )}

            <div className="quest-clear-progress" aria-label="MAP PROGRESS">
              <span>MAP PROGRESS</span>
              <strong>+{rewardSummary.mapProgressGained}</strong>
            </div>
          </>
        )}

        <QuestGoldButton type="button" className="quest-clear-return" onClick={onContinue}>
          MAPへ戻る
        </QuestGoldButton>
      </section>
    </div>
  );
}
