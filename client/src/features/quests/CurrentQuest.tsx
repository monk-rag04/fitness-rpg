import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { RecoveryQuest } from './RecoveryQuest';
import { TrainingQuest } from './TrainingQuest';

export function CurrentQuest() {
  const { progressView, returnToMap } = useAdventureQuest();
  const currentNode = progressView.currentDailyNode;

  if (currentNode === null) {
    return (
      <section className="screen empty-quest-state">
        <p className="eyebrow">ROADMAP COMPLETE</p>
        <h1>Boss Anchorが利用可能です</h1>
        <button className="button button-secondary" type="button" onClick={returnToMap}>
          Mapへ戻る
        </button>
      </section>
    );
  }

  const isTraining = currentNode.type === 'training';
  const questType = isTraining ? 'TRAINING QUEST' : 'RECOVERY QUEST';

  return (
    <section className="screen current-quest" aria-labelledby="quest-title">
      <header className="quest-header">
        <button className="back-button" type="button" onClick={returnToMap}>
          ← Mapへ戻る
        </button>
        <p className="eyebrow">{questType} · {currentNode.date}</p>
        <h1 id="quest-title">{isTraining ? 'トレーニングの日' : '休養の日'}</h1>
      </header>
      {isTraining ? <TrainingQuest /> : <RecoveryQuest />}
    </section>
  );
}
