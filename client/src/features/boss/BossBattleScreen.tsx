import { useState, type FormEvent } from 'react';
import type { BossWinningAttempt } from '@fitness-rpg/shared';
import { QuestGoldButton, QuestSectionTitle } from '../../components/QuestUi';
import { exerciseLabel } from '../../presentation/trainingLabels';
import { useAdventureQuest } from '../../state/AdventureQuestContext';

function formatKg(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}kg`;
}

function formatAttempt(attempt: BossWinningAttempt): string {
  return `${formatKg(attempt.weightKg)} × ${attempt.reps}回`;
}

const ERROR_COPY: Readonly<Record<string, string>> = {
  invalid_weight: '重量は0より大きい数値で入力してください。',
  invalid_reps: '回数は1〜10回で入力してください。',
  exercise_mismatch: 'Main Strengthの内容を確認してください。',
  boss_locked: 'Daily QuestをすべてClearすると挑戦できます。',
  already_defeated: 'このBossはすでに討伐済みです。',
};

export function BossBattleScreen() {
  const { roadmap, bossBattle, stageNumber, challengeBoss, returnToMap } = useAdventureQuest();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [defeat, setDefeat] = useState<BossWinningAttempt | null>(null);
  const mainName = exerciseLabel(roadmap.mainExerciseId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const result = challengeBoss({
      weightKg: weight.trim() === '' ? Number.NaN : Number(weight),
      reps: reps.trim() === '' ? Number.NaN : Number(reps),
    });
    if (result.status === 'victory') return;
    if (result.status === 'defeat') {
      setDefeat(result.attempt);
      return;
    }
    setMessage(ERROR_COPY[result.status] ?? '入力内容を確認してください。');
  }

  if (bossBattle === undefined || bossBattle.defeated) {
    return (
      <section className="screen boss-screen" aria-labelledby="boss-title">
        <p className="eyebrow">STAGE {stageNumber} · BOSS BATTLE</p>
        <h1 id="boss-title">BOSS BATTLE</h1>
        <p className="boss-message" role="status">Bossの状態を読み込めません。MAPから状態を確認してください。</p>
        <QuestGoldButton type="button" onClick={returnToMap}>MAPへ戻る</QuestGoldButton>
      </section>
    );
  }

  return (
    <section className="screen boss-screen" aria-labelledby="boss-title">
      <header className="boss-screen__header">
        <p className="eyebrow">STAGE {stageNumber} · BOSS BATTLE</p>
        <h1 id="boss-title">BOSS BATTLE</h1>
        <p className="boss-screen__intro">Main Strengthの実力でBossに挑みます。</p>
      </header>

      <section className="boss-card" aria-label="Boss challenge">
        <QuestSectionTitle><span>MAIN STRENGTH</span></QuestSectionTitle>
        <h2>{mainName}</h2>
        <div className="boss-target">
          <span>BOSS TARGET</span>
          <strong>{formatKg(bossBattle.targetE1rmKg)} e1RM</strong>
        </div>
        {bossBattle.adapted && (
          <aside className="boss-adapted">
            <strong>BOSS ADAPTED</strong>
            <span>Original Stage Target {formatKg(bossBattle.originalStageTargetE1rmKg)}</span>
            <span>Boss Target {formatKg(bossBattle.targetE1rmKg)}</span>
          </aside>
        )}

        {defeat === null ? (
          <form className="boss-form" onSubmit={submit}>
            <label>
              挑戦重量 <span>kg</span>
              <input aria-label="挑戦重量 kg" type="number" inputMode="decimal" min="0.1" step="0.1" value={weight} onChange={(event) => setWeight(event.currentTarget.value)} />
            </label>
            <label>
              回数 <span>reps</span>
              <input aria-label="回数 reps" type="number" inputMode="numeric" min="1" max="10" step="1" value={reps} onChange={(event) => setReps(event.currentTarget.value)} />
            </label>
            {message !== null && <p className="boss-message" role="alert">{message}</p>}
            <QuestGoldButton type="submit">BOSSに挑戦</QuestGoldButton>
          </form>
        ) : (
          <section className="boss-result boss-result--defeat" aria-labelledby="boss-result-title">
            <p className="eyebrow">BATTLE RESULT</p>
            <h2 id="boss-result-title">Bossに届きませんでした</h2>
            <dl>
              <div><dt>今回の挑戦</dt><dd>{formatAttempt(defeat)}</dd></div>
              <div><dt>YOUR e1RM</dt><dd>{formatKg(defeat.estimatedE1rmKg)}</dd></div>
              <div><dt>BOSS TARGET</dt><dd>{formatKg(bossBattle.targetE1rmKg)}</dd></div>
              <div><dt>あと</dt><dd>{formatKg(Math.max(0, bossBattle.targetE1rmKg - defeat.estimatedE1rmKg))}</dd></div>
            </dl>
            <QuestGoldButton type="button" onClick={() => { setDefeat(null); setWeight(''); setReps(''); }}>もう一度挑戦</QuestGoldButton>
          </section>
        )}
      </section>
      <button className="boss-back-link" type="button" onClick={returnToMap}>MAPへ戻る</button>
    </section>
  );
}
