import { useState } from 'react';
import { QuestOrnateFrame, QuestSectionTitle, QuestTypeTag } from '../../components/QuestUi';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { exerciseLabel } from '../../presentation/trainingLabels';
import { WorkoutResultForm } from './WorkoutResultForm';

export function TrainingQuest() {
  const { trainingPlan, workoutResults, trainingEvaluation } = useAdventureQuest();
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  if (trainingPlan === null) return null;

  return (
    <section className="quest-main-content" aria-label="今日のトレーニング">
      <QuestOrnateFrame className="main-quest-frame">
        <QuestSectionTitle>メインQUEST</QuestSectionTitle>
        <p className="main-quest-intro">今日のトレーニングを完了せよ</p>

        <div className="figma-exercise-list">
          {trainingPlan.exercises.map((plan) => {
            const displayName = exerciseLabel(plan.exerciseId);
            const completion = trainingEvaluation.exercises.find(
              (item) => item.exerciseId === plan.exerciseId,
            );
            const existingResult = workoutResults.find(
              (result) => result.plannedExerciseId === plan.exerciseId,
            );
            const isCompleted = completion?.completed ?? false;
            const isEditing = editingExerciseId === plan.exerciseId;
            const setSummary = existingResult?.completedSets
              .map((set) => `${set.weightKg}kg × ${set.reps} reps`)
              .join(' · ');

            return (
              <article
                className={`figma-exercise-card ${isCompleted ? 'is-completed' : ''} ${isCompleted && !isEditing ? 'is-compact' : ''}`}
                key={plan.exerciseId}
              >
                <header className="figma-exercise-card__heading">
                  <div className="figma-exercise-card__identity">
                    <span className={`exercise-completion-box ${isCompleted ? 'is-completed' : ''}`} aria-label={isCompleted ? '記録済み' : '未記録'}>
                      {isCompleted ? '✓' : ''}
                    </span>
                    <h3>{displayName}</h3>
                  </div>
                  <QuestTypeTag>{plan.role}</QuestTypeTag>
                </header>
                {!isCompleted || isEditing ? (
                  <>
                    <p className="figma-exercise-card__plan">{plan.sets} SETS · {plan.repRange.min}–{plan.repRange.max} REPS</p>
                    <WorkoutResultForm
                      key={`${plan.exerciseId}-${existingResult?.performedAt ?? 'new'}`}
                      plan={plan}
                      exerciseName={displayName}
                      existingResult={existingResult}
                      onValidRecord={() => setEditingExerciseId(null)}
                    />
                    {isEditing && (
                      <button
                        className="exercise-edit-button exercise-edit-button--close"
                        type="button"
                        onClick={() => setEditingExerciseId(null)}
                      >
                        閉じる
                      </button>
                    )}
                  </>
                ) : (
                  <div className="completed-exercise-summary">
                    <p className="completed-set-summary">{setSummary ?? '記録済み'}</p>
                    <button
                      className="exercise-edit-button"
                      type="button"
                      onClick={() => setEditingExerciseId(plan.exerciseId)}
                    >
                      編集
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </QuestOrnateFrame>
    </section>
  );
}
