import { useState } from 'react';
import { canSelfReportExerciseBaseline } from '@fitness-rpg/shared';
import { QuestOrnateFrame, QuestSectionTitle, QuestTypeTag } from '../../components/QuestUi';
import { useAdventureQuest } from '../../state/AdventureQuestContext';
import { exerciseLabel } from '../../presentation/trainingLabels';
import { ExerciseBaselineSetup, type ExerciseBaselineSetupMode } from './ExerciseBaselineSetup';
import { WorkoutResultForm } from './WorkoutResultForm';

export function TrainingQuest() {
  const {
    trainingPlan,
    workoutResults,
    trainingEvaluation,
    stageTrainingProgramContext,
    exerciseProgressById,
    baselineSetupConfirmedById,
    registerExerciseBaseline,
    confirmExerciseBaselineSetup,
  } = useAdventureQuest();
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [baselineModeById, setBaselineModeById] = useState<Readonly<Record<string, ExerciseBaselineSetupMode>>>({});

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
            const hasBaseline = exerciseProgressById[plan.exerciseId]?.baseline !== undefined;
            const isOnboardingMain = plan.exerciseId === stageTrainingProgramContext?.mainExerciseId;
            const showBaselineSetup = stageTrainingProgramContext !== undefined &&
              !isOnboardingMain &&
              !hasBaseline &&
              baselineSetupConfirmedById[plan.exerciseId] !== true;
            const selfReportSupported = canSelfReportExerciseBaseline(plan.exerciseId);
            const baselineMode = baselineModeById[plan.exerciseId] ??
              (selfReportSupported ? 'choose' : 'first_time');
            const setSummary = existingResult?.completedSets
              .map((set) => set.weightKg === undefined
                ? `${set.reps}回`
                : `${set.weightKg}kg × ${set.reps}回`)
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
                    {showBaselineSetup && (
                      <ExerciseBaselineSetup
                        mode={baselineMode}
                        selfReportSupported={selfReportSupported}
                        onModeChange={(mode) => setBaselineModeById((current) => ({
                          ...current,
                          [plan.exerciseId]: mode,
                        }))}
                        registerBaseline={(weightKg, reps) => registerExerciseBaseline({
                          exerciseId: plan.exerciseId,
                          weightKg,
                          reps,
                        })}
                        onConfirmFirstTime={() => confirmExerciseBaselineSetup(plan.exerciseId)}
                      />
                    )}
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
