import type { CharacterScreenModel, StrengthRecordDisplay } from './characterPresentation';

function strengthRecordText(record: StrengthRecordDisplay | null): string {
  return record === null ? '—' : `${record.weightKg}kg × ${record.reps}`;
}

export function MainStrengthCard({
  mainStrength,
}: {
  readonly mainStrength: CharacterScreenModel['mainStrength'];
}) {
  return (
    <section className="character-main-strength character-ornate-card" aria-labelledby="character-main-strength-title">
      <h2 id="character-main-strength-title" className="character-section-title"><span>MAIN STRENGTH</span></h2>
      <p className="character-main-strength__exercise">
        {mainStrength.exerciseName ?? '種目未設定'}
      </p>
      <div className="character-strength-metrics" aria-label="Main Strengthの記録と目標">
        <div className="character-strength-metric">
          <span>START</span>
          <strong>{strengthRecordText(mainStrength.start)}</strong>
        </div>
        <div className="character-strength-metric character-strength-metric--current">
          <span>CURRENT</span>
          <strong>{mainStrength.current === null ? '記録なし' : strengthRecordText(mainStrength.current)}</strong>
        </div>
        <div className="character-strength-metric">
          <span>TARGET</span>
          <strong>{mainStrength.targetE1rmKg === null ? '—' : `${mainStrength.targetE1rmKg}kg`}</strong>
        </div>
      </div>
      <p className="character-main-strength__note">
        CURRENTはClear済みQuestで実際に記録されたWorkout Resultを表示します。
      </p>
    </section>
  );
}
