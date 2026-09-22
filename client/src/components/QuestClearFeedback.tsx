import { useAdventureQuest } from '../state/AdventureQuestContext';

export function QuestClearFeedback() {
  const { isClearFeedbackVisible, continueAdventure } = useAdventureQuest();

  if (!isClearFeedbackVisible) {
    return null;
  }

  return (
    <div className="overlay-backdrop" role="presentation">
      <section
        className="quest-clear-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-clear-title"
      >
        <p className="eyebrow">DAILY QUEST COMPLETE</p>
        <div className="clear-emblem" aria-hidden="true">✦</div>
        <h1 id="quest-clear-title">QUEST CLEAR</h1>
        <p>次の地点への道が開かれた。</p>
        <button className="button button-primary" type="button" onClick={continueAdventure}>
          冒険を続ける
        </button>
      </section>
    </div>
  );
}
