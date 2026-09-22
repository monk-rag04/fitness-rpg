import { useAdventureQuest } from '../../state/AdventureQuestContext';

export function RecoveryQuest() {
  const { clearCurrentQuest, validationMessage } = useAdventureQuest();

  return (
    <section className="quest-body" aria-labelledby="recovery-title">
      <section className="recovery-card surface-card">
        <p className="eyebrow">RECOVERY QUEST</p>
        <div className="recovery-icon" aria-hidden="true">☾</div>
        <h2 id="recovery-title">休養の日</h2>
        <p>今日は回復日。次の戦いに備えて身体を休めよう。</p>
      </section>

      <section className="quest-clear-panel surface-card" aria-labelledby="recovery-clear-heading">
        <p className="eyebrow">EXPLICIT COMPLETION</p>
        <h2 id="recovery-clear-heading">Recoveryを完了</h2>
        <p>RecoveryにはMVP Checklistはありません。明示的に完了すると次のNodeへ進みます。</p>
        {validationMessage !== null && <p className="validation-message" role="alert">{validationMessage}</p>}
        <button className="button button-primary" type="button" onClick={clearCurrentQuest}>
          Recoveryを完了
        </button>
      </section>
    </section>
  );
}
