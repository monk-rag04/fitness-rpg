import { useState } from 'react';
import type { ExerciseSkipReason, ExerciseSkipRecord } from '@fitness-rpg/shared';
import { useAdventureQuest } from '../../state/AdventureQuestContext';

const skipReasons: readonly { readonly value: ExerciseSkipReason; readonly label: string }[] = [
  { value: 'equipment_unavailable', label: '器具が空いていない' },
  { value: 'time_constraint', label: '時間が足りない' },
  { value: 'condition', label: 'コンディションの都合' },
  { value: 'other', label: 'その他' },
];

export function exerciseSkipReasonLabel(reason: ExerciseSkipReason): string {
  return skipReasons.find((item) => item.value === reason)?.label ?? 'その他';
}

export function ExerciseSkipControl({
  exerciseId,
  skipped,
}: {
  readonly exerciseId: string;
  readonly skipped?: ExerciseSkipRecord;
}) {
  const { skipExercise, undoExerciseSkip } = useAdventureQuest();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ExerciseSkipReason | undefined>();
  const [pledgeAccepted, setPledgeAccepted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (skipped !== undefined) {
    return (
      <div className="exercise-skip-summary" aria-label="種目スキップ状態">
        <div>
          <strong>SKIPPED</strong>
          <span>{exerciseSkipReasonLabel(skipped.reason)}</span>
        </div>
        <button
          className="exercise-skip-summary__undo"
          type="button"
          onClick={() => {
            const status = undoExerciseSkip(exerciseId);
            if (status !== 'undone') setMessage('スキップを取り消せませんでした。');
          }}
        >
          スキップを取り消す
        </button>
        {message !== null && <p role="status">{message}</p>}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button className="exercise-skip-trigger" type="button" onClick={() => setIsOpen(true)}>
        この種目をスキップ
      </button>
    );
  }

  return (
    <section className="exercise-skip-panel" aria-label="種目をスキップ">
      <p>この種目をスキップする理由</p>
      <div className="exercise-skip-panel__reasons" role="group" aria-label="スキップ理由">
        {skipReasons.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={reason === option.value}
            className={reason === option.value ? 'is-selected' : ''}
            onClick={() => { setReason(option.value); setMessage(null); }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="exercise-skip-panel__pledge">
        <input
          type="checkbox"
          checked={pledgeAccepted}
          onChange={(event) => { setPledgeAccepted(event.target.checked); setMessage(null); }}
        />
        他の種目で挽回すると誓いますか？
      </label>
      {message !== null && <p role="alert">{message}</p>}
      <div className="exercise-skip-panel__actions">
        <button
          className="exercise-skip-panel__confirm"
          type="button"
          disabled={reason === undefined || !pledgeAccepted}
          onClick={() => {
            if (reason === undefined || !pledgeAccepted) return;
            const status = skipExercise({ exerciseId, reason, pledgeAccepted: true });
            if (status === 'skipped') {
              setIsOpen(false);
              setReason(undefined);
              setPledgeAccepted(false);
              setMessage(null);
            } else {
              setMessage('スキップを記録できませんでした。Questの状態を確認してください。');
            }
          }}
        >
          YES — 誓います
        </button>
        <button className="exercise-skip-panel__cancel" type="button" onClick={() => setIsOpen(false)}>
          やめる
        </button>
      </div>
    </section>
  );
}
