import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import type {
  ExerciseWorkoutResult,
  ValidatedPlannedExercise,
} from '@fitness-rpg/shared';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { workoutResultErrorMessage } from '../../presentation/trainingLabels';

interface SetDraft {
  readonly weightKg: string;
  readonly reps: string;
}

function createInitialDrafts(
  plannedSets: number,
  existingResult: ExerciseWorkoutResult | undefined,
): SetDraft[] {
  return Array.from({ length: plannedSets }, (_, index) => {
    const existingSet = existingResult?.completedSets.find((set) => set.setNumber === index + 1);
    return {
      weightKg: existingSet === undefined ? '' : String(existingSet.weightKg),
      reps: existingSet === undefined ? '' : String(existingSet.reps),
    };
  });
}

function formatDomainErrors(errors: readonly { readonly code: string }[]): string {
  return [...new Set(errors.map((error) => workoutResultErrorMessage(error.code)))].join(' ');
}

interface WorkoutResultFormProps {
  readonly plan: ValidatedPlannedExercise;
  readonly exerciseName: string;
  readonly existingResult?: ExerciseWorkoutResult;
  readonly onValidRecord?: () => void;
}

export function WorkoutResultForm({
  plan,
  exerciseName,
  existingResult,
  onValidRecord,
}: WorkoutResultFormProps) {
  const { saveWorkoutResult } = useAdventureQuest();
  const [drafts, setDrafts] = useState<SetDraft[]>(() => createInitialDrafts(plan.sets, existingResult));
  const [message, setMessage] = useState<string | null>(
    existingResult === undefined ? null : '記録済みです。入力を変更して再記録できます。',
  );

  function updateDraft(index: number, field: keyof SetDraft, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, [field]: value } : draft
    )));
    setMessage(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completedSets: Array<{ setNumber: number; weightKg: number; reps: number }> = [];

    for (const [index, draft] of drafts.entries()) {
      const weightInput = draft.weightKg.trim();
      const repsInput = draft.reps.trim();

      if (weightInput === '' && repsInput === '') {
        continue;
      }
      if (weightInput === '' || repsInput === '') {
        setMessage(`SET ${index + 1}は重量とrepsを両方入力してください。`);
        return;
      }

      const weightKg = Number(weightInput);
      const reps = Number(repsInput);
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        setMessage(`SET ${index + 1}の重量は0より大きい数値で入力してください。`);
        return;
      }
      if (!Number.isSafeInteger(reps) || reps <= 0) {
        setMessage(`SET ${index + 1}の回数は1以上の整数で入力してください。`);
        return;
      }

      completedSets.push({ setNumber: index + 1, weightKg, reps });
    }

    const validation = saveWorkoutResult({
      plannedExerciseId: plan.exerciseId,
      performedExerciseId: plan.exerciseId,
      role: plan.role,
      plannedSets: plan.sets,
      plannedRepRange: plan.repRange,
      completedSets,
      performedAt: new Date().toISOString(),
    });

    if (validation.valid) {
      setMessage(`${exerciseName}を記録しました。`);
      onValidRecord?.();
    } else {
      setMessage(`記録できません: ${formatDomainErrors(validation.errors)}`);
    }
  }

  return (
    <form className="workout-result-form" onSubmit={submit} noValidate>
      <fieldset>
        <legend>Set記録</legend>
        <p className="form-help">空欄のSETは未記録です。一部のSETのみでも記録できます。</p>
        <div className="set-input-list">
          {drafts.map((draft, index) => {
            const setNumber = index + 1;
            const inputPrefix = `${plan.exerciseId}-set-${setNumber}`;
            return (
              <div className="set-input-row" key={setNumber}>
                <span className="set-label">SET {setNumber}</span>
                <label htmlFor={`${inputPrefix}-weight`}>
                  <span>重量 kg</span>
                  <input
                    id={`${inputPrefix}-weight`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={draft.weightKg}
                    onChange={(event) => updateDraft(index, 'weightKg', event)}
                    placeholder="kg"
                  />
                </label>
                <label htmlFor={`${inputPrefix}-reps`}>
                  <span>回数（reps）</span>
                  <input
                    id={`${inputPrefix}-reps`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={draft.reps}
                    onChange={(event) => updateDraft(index, 'reps', event)}
                    placeholder="reps"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>
      {message !== null && <p className="form-message" role="status">{message}</p>}
      <button className="quest-record-button" type="submit">記録する</button>
    </form>
  );
}
