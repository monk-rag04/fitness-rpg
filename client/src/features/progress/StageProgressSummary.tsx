import type { ProgressScreenModel } from './progressPresentation';

export function StageProgressSummary({
  stageProgress,
}: {
  readonly stageProgress: ProgressScreenModel['stageProgress'];
}) {
  const accessibleMaximum = Math.max(stageProgress.totalQuestCount, 1);

  return (
    <section className="progress-stage-card character-ornate-card" aria-labelledby="progress-stage-title">
      <h2 id="progress-stage-title" className="character-section-title"><span>CURRENT STAGE</span></h2>
      <div className="progress-stage-card__quest-count">
        <span>クエスト進行</span>
        <p>
          <strong>{stageProgress.completedQuestCount}</strong>
          <span>/ {stageProgress.totalQuestCount} QUESTS</span>
        </p>
      </div>
      <div
        className="progress-stage-card__track"
        role="progressbar"
        aria-label="クエスト進行"
        aria-valuenow={stageProgress.completedQuestCount}
        aria-valuemin={0}
        aria-valuemax={accessibleMaximum}
      >
        <span style={{ width: `${stageProgress.percent}%` }} />
      </div>
      <div className="progress-stage-card__clear-counts">
        <div>
          <span>トレーニング</span>
          <p><strong>{stageProgress.trainingQuestClearCount}</strong><small>回完了</small></p>
        </div>
        <div className="progress-stage-card__recovery">
          <span>☾ 休養</span>
          <p><strong>{stageProgress.recoveryQuestClearCount}</strong><small>回完了</small></p>
        </div>
      </div>
      <div className="progress-stage-card__boss">
        <span>BOSS ENCOUNTER</span>
        <strong>あと {stageProgress.bossQuestsRemaining} QUESTS</strong>
      </div>
    </section>
  );
}
