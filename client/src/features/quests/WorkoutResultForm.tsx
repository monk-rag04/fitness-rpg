import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import type {
  CompletedSetRecord,
  ExerciseId,
  ExerciseSuggestion,
  ExerciseDifficultyFeedback,
  ExerciseWorkoutResult,
  ValidatedPlannedExercise,
} from '@fitness-rpg/shared';
import { isBodyweightExerciseId, resolveExerciseSuggestion } from '@fitness-rpg/shared';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { weightEntryHint, workoutResultErrorMessage } from '../../presentation/trainingLabels';

interface SetDraft {
  readonly weightKg: string;
  readonly reps: string;
}

const difficultyFeedbackOptions: readonly {
  readonly value: ExerciseDifficultyFeedback;
  readonly label: string;
}[] = [
  { value: 'too_hard', label: 'きつすぎた' },
  { value: 'just_right', label: 'ちょうどいい' },
  { value: 'easy', label: '余裕あり' },
];

export function toggleDifficultyFeedback(
  current: ExerciseDifficultyFeedback | undefined,
  selected: ExerciseDifficultyFeedback,
): ExerciseDifficultyFeedback | undefined {
  return current === selected ? undefined : selected;
}

export function createWorkoutResultInput(
  plan: ValidatedPlannedExercise,
  completedSets: readonly CompletedSetRecord[],
  existingResult: ExerciseWorkoutResult | undefined,
  difficultyFeedback: ExerciseDifficultyFeedback | undefined,
  performedAt: string,
): ExerciseWorkoutResult {
  const result = {
    plannedExerciseId: plan.exerciseId,
    performedExerciseId: existingResult?.performedExerciseId ?? plan.exerciseId,
    role: plan.role,
    plannedSets: plan.sets,
    plannedRepRange: plan.repRange,
    completedSets,
    performedAt,
  };
  return difficultyFeedback === undefined ? result : { ...result, difficultyFeedback };
}

export function formatExerciseSuggestion(
  suggestion: ExerciseSuggestion,
  bodyweight: boolean,
): string {
  if (bodyweight) return `${suggestion.targetReps}回`;
  return suggestion.weightKg === undefined
    ? `重量：未設定　回数：${suggestion.targetReps}回`
    : `${suggestion.weightKg}kg × ${suggestion.targetReps}回`;
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
  const {
    saveWorkoutResult,
    exerciseProgressById,
    progress,
    setExerciseLoadStep,
  } = useAdventureQuest();
  const effectiveExerciseId = (existingResult?.performedExerciseId ?? plan.exerciseId) as ExerciseId;
  const bodyweight = isBodyweightExerciseId(effectiveExerciseId);
  const suggestion = resolveExerciseSuggestion(
    exerciseProgressById[effectiveExerciseId],
    effectiveExerciseId,
    plan.repRange,
    progress.currentDayIndex,
  );
  const storedSuggestion = exerciseProgressById[effectiveExerciseId]?.nextSuggestion;
  const showRepsProgressed = !bodyweight && storedSuggestion?.status === 'active' &&
    storedSuggestion.ruleVersion === suggestion.ruleVersion &&
    storedSuggestion.repRange.min === plan.repRange.min &&
    storedSuggestion.repRange.max === plan.repRange.max &&
    suggestion.targetReps > plan.repRange.min;
  const entryHint = bodyweight ? undefined : weightEntryHint(effectiveExerciseId);
  const [drafts, setDrafts] = useState<SetDraft[]>(() => createInitialDrafts(plan.sets, existingResult));
  const [difficultyFeedback, setDifficultyFeedback] = useState<ExerciseDifficultyFeedback | undefined>(
    () => existingResult?.difficultyFeedback,
  );
  const [message, setMessage] = useState<string | null>(
    existingResult === undefined ? null : '記録済みです。入力を変更して再記録できます。',
  );
  const [loadStepDraft, setLoadStepDraft] = useState('');
  const [loadStepMessage, setLoadStepMessage] = useState<string | null>(null);

  function updateDraft(index: number, field: keyof SetDraft, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, [field]: value } : draft
    )));
    setMessage(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completedSets: CompletedSetRecord[] = [];

    for (const [index, draft] of drafts.entries()) {
      const weightInput = bodyweight ? '' : draft.weightKg.trim();
      const repsInput = draft.reps.trim();

      if (weightInput === '' && repsInput === '') {
        continue;
      }
      if (repsInput === '' || (!bodyweight && weightInput === '')) {
        setMessage(bodyweight
          ? `SET ${index + 1}の回数を入力してください。`
          : `SET ${index + 1}は重量と回数を両方入力してください。`);
        return;
      }

      const reps = Number(repsInput);
      if (!Number.isSafeInteger(reps) || reps <= 0) {
        setMessage(`SET ${index + 1}の回数は1以上の整数で入力してください。`);
        return;
      }

      if (bodyweight) {
        completedSets.push({ setNumber: index + 1, reps });
        continue;
      }
      const weightKg = Number(weightInput);
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        setMessage(`SET ${index + 1}の重量は0より大きい数値で入力してください。`);
        return;
      }
      completedSets.push({ setNumber: index + 1, weightKg, reps });
    }

    const validation = saveWorkoutResult(createWorkoutResultInput(
      plan,
      completedSets,
      existingResult,
      difficultyFeedback,
      new Date().toISOString(),
    ));

    if (validation.valid) {
      setMessage(`${exerciseName}を記録しました。`);
      onValidRecord?.();
    } else {
      setMessage(`記録できません: ${formatDomainErrors(validation.errors)}`);
    }
  }

  function applyLoadStep() {
    const input = loadStepDraft.trim();
    const loadStepKg = Number(input);
    if (input === '' || !Number.isFinite(loadStepKg) || loadStepKg <= 0) {
      setLoadStepMessage('0より大きい重量刻みを入力してください。');
      return;
    }
    const status = setExerciseLoadStep(plan.exerciseId, loadStepKg);
    if (status === 'applied') {
      setLoadStepMessage(null);
      setLoadStepDraft('');
    } else if (status === 'already_applied') {
      setLoadStepMessage('この重量刻みはすでに適用されています。');
    } else {
      setLoadStepMessage('重量刻みを適用できませんでした。目安を確認してください。');
    }
  }

  return (
    <form className="workout-result-form" onSubmit={submit} noValidate>
      <section className={`exercise-suggestion ${suggestion.status === 'weight_up_ready' ? 'is-weight-up-ready' : ''}`} aria-label="今回の目安">
        <div className="exercise-suggestion__heading">
          <span>今回の目安</span>
          {showRepsProgressed && <span className="exercise-suggestion__tag exercise-suggestion__tag--progressed">DOUBLE PROGRESSION</span>}
          {suggestion.status === 'weight_up_ready' && <span className="exercise-suggestion__tag">WEIGHT UP READY</span>}
        </div>
        <strong>{formatExerciseSuggestion(suggestion, bodyweight)}</strong>
        {bodyweight ? (
          <p>自重種目は回数を記録します。</p>
        ) : suggestion.weightKg === undefined ? (
          <p>初回は無理のない重量から始めてください。</p>
        ) : null}
      </section>
      {suggestion.status === 'weight_up_ready' && suggestion.weightKg !== undefined && !bodyweight && (
        <section className="exercise-load-step" aria-label="重量刻みの設定">
          <strong>重量UPのタイミングです</strong>
          <p>現在 {suggestion.weightKg}kg</p>
          <label htmlFor={`${plan.exerciseId}-load-step`}>
            この器具の重量刻み
            <span>
              <input
                id={`${plan.exerciseId}-load-step`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={loadStepDraft}
                onChange={(event) => {
                  setLoadStepDraft(event.target.value);
                  setLoadStepMessage(null);
                }}
                placeholder="kg"
              />
              <em>kg</em>
            </span>
          </label>
          {loadStepMessage !== null && <p className="exercise-load-step__message" role="status">{loadStepMessage}</p>}
          <button type="button" onClick={applyLoadStep}>この刻みを使う</button>
        </section>
      )}
      <fieldset>
        <legend>Set記録</legend>
        <p className="form-help">空欄のSETは未記録です。一部のSETのみでも記録できます。</p>
        {entryHint !== undefined && <p className="weight-entry-hint">{entryHint}</p>}
        <div className="set-input-list">
          {drafts.map((draft, index) => {
            const setNumber = index + 1;
            const inputPrefix = `${plan.exerciseId}-set-${setNumber}`;
            return (
              <div className={`set-input-row ${bodyweight ? 'set-input-row--bodyweight' : ''}`} key={setNumber}>
                <span className="set-label">SET {setNumber}</span>
                {!bodyweight && (
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
                )}
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
      <section className="difficulty-feedback" aria-labelledby={`${plan.exerciseId}-difficulty-feedback-label`}>
        <div className="difficulty-feedback__heading">
          <h4 id={`${plan.exerciseId}-difficulty-feedback-label`}>今回の負荷は？</h4>
          <span>任意</span>
        </div>
        <div className="difficulty-feedback__options" role="group" aria-labelledby={`${plan.exerciseId}-difficulty-feedback-label`}>
          {difficultyFeedbackOptions.map((option) => (
            <button
              aria-pressed={difficultyFeedback === option.value}
              className="difficulty-feedback__option"
              key={option.value}
              onClick={() => {
                setDifficultyFeedback((current) => toggleDifficultyFeedback(current, option.value));
                setMessage(null);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="difficulty-feedback__help">未選択でも記録・QUEST CLEARできます。</p>
      </section>
      {message !== null && <p className="form-message" role="status">{message}</p>}
      <button className="quest-record-button" type="submit">記録する</button>
    </form>
  );
}
