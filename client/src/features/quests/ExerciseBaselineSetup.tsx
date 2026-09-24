import { useState, type FormEvent } from 'react';
import type { ExerciseBaselineRegistrationStatus } from '../../state/adventureSession';

export type ExerciseBaselineSetupMode = 'choose' | 'experienced' | 'first_time';

interface ExerciseBaselineSetupProps {
  readonly mode: ExerciseBaselineSetupMode;
  readonly selfReportSupported: boolean;
  readonly onModeChange: (mode: ExerciseBaselineSetupMode) => void;
  readonly registerBaseline: (weightKg: number, reps: number) => ExerciseBaselineRegistrationStatus;
  readonly onConfirmFirstTime: () => void;
}

export function exerciseBaselineRegistrationErrorMessage(status: ExerciseBaselineRegistrationStatus): string {
  switch (status) {
    case 'invalid_baseline_weight':
      return '重量は0より大きい数値で入力してください。';
    case 'invalid_baseline_reps':
      return '回数は1以上の整数で入力してください。';
    case 'self_report_not_supported':
      return 'この種目は重量の自己申告に対応していません。最初の記録から目安を作ります。';
    case 'baseline_already_set':
      return 'この種目のBaselineはすでに設定されています。';
    case 'unknown_exercise':
      return '種目を確認できませんでした。';
    case 'invalid_day_index':
      return '現在のQuestを確認できませんでした。';
    case 'registered':
      return '';
  }
}

export function ExerciseBaselineSetup({
  mode,
  selfReportSupported,
  onModeChange,
  registerBaseline,
  onConfirmFirstTime,
}: ExerciseBaselineSetupProps) {
  const [weightKg, setWeightKg] = useState('');
  const [reps, setReps] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  function submitBaseline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weightText = weightKg.trim();
    const repsText = reps.trim();
    const parsedWeight = weightText === '' ? Number.NaN : Number(weightText);
    const parsedReps = repsText === '' ? Number.NaN : Number(repsText);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setMessage('重量は0より大きい数値で入力してください。');
      return;
    }
    if (!Number.isSafeInteger(parsedReps) || parsedReps <= 0) {
      setMessage('回数は1以上の整数で入力してください。');
      return;
    }

    const status = registerBaseline(parsedWeight, parsedReps);
    if (status !== 'registered') {
      setMessage(exerciseBaselineRegistrationErrorMessage(status));
      return;
    }
    setMessage(null);
  }

  return (
    <section className="exercise-baseline-setup" aria-label="Baseline初回設定">
      <div className="exercise-baseline-setup__heading">
        <div>
          <span className="exercise-baseline-setup__eyebrow">初回設定</span>
          <p>{selfReportSupported
            ? '次回以降の目安を作るため、この種目の現在の記録を教えてください。'
            : 'この種目は最初のトレーニング結果から目安を作ります。'}</p>
        </div>
        <span className="exercise-baseline-setup__tag">BASELINE</span>
      </div>

      {selfReportSupported && (
        <div className="exercise-baseline-setup__choices" aria-label="トレーニング経験">
          <button
            className={mode === 'experienced' ? 'is-selected' : ''}
            type="button"
            aria-pressed={mode === 'experienced'}
            onClick={() => { setMessage(null); onModeChange('experienced'); }}
          >
            経験あり
          </button>
          <button
            className={mode === 'first_time' ? 'is-selected' : ''}
            type="button"
            aria-pressed={mode === 'first_time'}
            onClick={() => { setMessage(null); onModeChange('first_time'); }}
          >
            初めて
          </button>
        </div>
      )}

      {selfReportSupported && mode === 'experienced' && (
        <form className="exercise-baseline-setup__form" onSubmit={submitBaseline} noValidate>
          <p className="exercise-baseline-setup__description">最近の無理なく再現できる記録を入力してください。</p>
          <label>
            <span>最近扱った重量</span>
            <span className="exercise-baseline-setup__input-with-unit">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={weightKg}
                onChange={(event) => { setWeightKg(event.target.value); setMessage(null); }}
                placeholder=""
                aria-label="最近扱った重量 kg"
              />
              <em>kg</em>
            </span>
          </label>
          <label>
            <span>その重量でできる回数</span>
            <span className="exercise-baseline-setup__input-with-unit">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={reps}
                onChange={(event) => { setReps(event.target.value); setMessage(null); }}
                placeholder=""
                aria-label="その重量でできる回数 reps"
              />
              <em>reps</em>
            </span>
          </label>
          {message !== null && <p className="exercise-baseline-setup__message" role="alert">{message}</p>}
          <button className="exercise-baseline-setup__primary" type="submit">この記録を設定する</button>
        </form>
      )}

      {mode === 'first_time' && (
        <div className="exercise-baseline-setup__first-time">
          {selfReportSupported && <p>最初のトレーニング結果から、次回以降の目安を作ります。</p>}
          <button className="exercise-baseline-setup__primary" type="button" onClick={onConfirmFirstTime}>
            この設定で進む
          </button>
        </div>
      )}
    </section>
  );
}
