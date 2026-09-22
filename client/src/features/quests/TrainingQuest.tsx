import { getExerciseById } from '@fitness-rpg/shared';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { WorkoutResultForm } from './WorkoutResultForm';

export function TrainingQuest() {
  const {
    trainingPlan,
    workoutResults,
    trainingEvaluation,
    clearCurrentQuest,
    validationMessage,
    progressView,
  } = useAdventureQuest();
  const sessionFocus = progressView.currentDailyNode?.type === 'training'
    ? progressView.currentDailyNode.sessionFocus.targetMuscles.map((muscle) => muscle.toUpperCase()).join(' · ')
    : '';

  return (
    <section className="quest-body" aria-labelledby="training-plan-title">
      <div className="quest-focus surface-card">
        <p className="summary-label">SESSION FOCUS</p>
        <p>{sessionFocus}</p>
      </div>

      <div className="section-heading">
        <p className="eyebrow">EXERCISE PLAN</p>
        <h2 id="training-plan-title">今日のトレーニング</h2>
      </div>

      <div className="exercise-list">
        {trainingPlan.exercises.map((plan) => {
          const exercise = getExerciseById(plan.exerciseId);
          const completion = trainingEvaluation.exercises.find(
            (item) => item.exerciseId === plan.exerciseId,
          );
          const existingResult = workoutResults.find(
            (result) => result.plannedExerciseId === plan.exerciseId,
          );

          return (
            <article className="exercise-card surface-card" key={plan.exerciseId}>
              <header className="exercise-card-header">
                <div>
                  <p className="role-label">{plan.role}</p>
                  <h3>{exercise?.displayName ?? plan.exerciseId}</h3>
                  <p className="plan-detail">
                    {plan.sets} SETS · {plan.repRange.min}–{plan.repRange.max} REPS
                  </p>
                </div>
                <span className={`exercise-status is-${completion?.status ?? 'incomplete'}`}>
                  {completion?.completed ? 'RECORDED' : 'NOT RECORDED'}
                </span>
              </header>
              <WorkoutResultForm
                key={`${plan.exerciseId}-${existingResult?.performedAt ?? 'new'}`}
                plan={plan}
                exerciseName={exercise?.displayName ?? plan.exerciseId}
                existingResult={existingResult}
              />
            </article>
          );
        })}
      </div>

      <section className="quest-clear-panel surface-card" aria-labelledby="quest-clear-heading">
        <p className="eyebrow">FINAL ACTION</p>
        <h2 id="quest-clear-heading">QUEST CLEAR</h2>
        <p>
          {trainingEvaluation.readyToClear
            ? 'すべての必須Exerciseが有効なWorkout Resultとして記録されています。'
            : 'すべての必須Exerciseを記録するとQuestを完了できます。'}
        </p>
        {validationMessage !== null && <p className="validation-message" role="alert">{validationMessage}</p>}
        <button
          className="button button-primary"
          type="button"
          disabled={!trainingEvaluation.readyToClear}
          onClick={clearCurrentQuest}
        >
          QUEST CLEAR
        </button>
      </section>
    </section>
  );
}
