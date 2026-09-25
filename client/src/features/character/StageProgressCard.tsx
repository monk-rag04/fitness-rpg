import type { CharacterScreenModel } from './characterPresentation';

export function StageProgressCard({
  stageProgress,
}: {
  readonly stageProgress: CharacterScreenModel['stageProgress'];
}) {
  const accessibleMaximum = Math.max(stageProgress.totalQuestCount, 1);

  return (
    <section className="character-stage-progress character-ornate-card" aria-labelledby="character-stage-title">
      <h2 id="character-stage-title">CURRENT STAGE</h2>
      <div className="character-stage-progress__summary">
        <span>STAGE</span>
        <p><strong>{stageProgress.completedQuestCount}</strong> / {stageProgress.totalQuestCount} <span>QUESTS</span></p>
      </div>
      <div
        className="character-stage-progress__track"
        role="progressbar"
        aria-label="Current StageのQuest進行"
        aria-valuenow={stageProgress.completedQuestCount}
        aria-valuemin={0}
        aria-valuemax={accessibleMaximum}
      >
        <span style={{ width: `${stageProgress.percent}%` }} />
      </div>
      <div className="character-stage-progress__boss">
        <span>BOSS ENCOUNTER</span>
        <strong>あと {stageProgress.bossQuestsRemaining} QUESTS</strong>
      </div>
    </section>
  );
}
