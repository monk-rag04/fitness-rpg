import { QuestGoldButton } from './QuestUi';
import { useAdventureQuest } from '../state/AdventureQuestContext';

export function QuestClearFeedback() {
  const { isClearFeedbackVisible, continueAdventure } = useAdventureQuest();

  if (!isClearFeedbackVisible) {
    return null;
  }

  return (
    <div className="quest-clear-backdrop" role="presentation">
      <div className="quest-clear-radiance" aria-hidden="true" />
      <section
        className="quest-clear-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-clear-title"
      >
        <p className="quest-clear-overlay__small">クエスト達成！</p>
        <h1 id="quest-clear-title">QUEST<br />CLEAR</h1>
        <div className="quest-clear-progress">
          <strong>+1</strong>
          <span>次のQUESTへ進行</span>
        </div>
        <QuestGoldButton type="button" onClick={continueAdventure}>
          冒険を続ける
        </QuestGoldButton>
      </section>
    </div>
  );
}
