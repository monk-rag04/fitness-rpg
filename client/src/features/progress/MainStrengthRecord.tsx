import type { ProgressScreenModel } from './progressPresentation';

function recordText(record: ProgressScreenModel['mainStrength']['start']): string {
  return record === null ? '—' : `${record.weightKg}kg × ${record.reps}`;
}

export function MainStrengthRecord({
  mainStrength,
}: {
  readonly mainStrength: ProgressScreenModel['mainStrength'];
}) {
  return (
    <section className="progress-main-record" aria-labelledby="progress-main-title">
      <h2 id="progress-main-title" className="character-section-title character-section-title--plain">
        <span>MAIN STRENGTH RECORD</span>
      </h2>
      <div className="progress-main-record__card character-ornate-card">
        <p className="progress-main-record__exercise">
          {mainStrength.exerciseName ?? '種目未設定'}
        </p>
        <div className="progress-main-record__metrics">
          <div><span>{mainStrength.startEstimated ? '開始時（推定）' : '開始時'}</span><strong>{recordText(mainStrength.start)}</strong></div>
          <div><span>最新記録</span><strong>{mainStrength.latest === null ? '記録なし' : recordText(mainStrength.latest)}</strong></div>
          <div><span>目標</span><strong>{mainStrength.targetE1rmKg === null ? '—' : `${mainStrength.targetE1rmKg}kg`}</strong></div>
        </div>
        <div className="progress-next-suggestion" aria-label="次回の目安">
          <span>次回の目安</span>
          <strong>{mainStrength.nextSuggestion}</strong>
        </div>
      </div>
    </section>
  );
}
