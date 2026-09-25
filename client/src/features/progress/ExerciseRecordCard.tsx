import type { ProgressExerciseRecordModel } from './progressPresentation';

function recordText(
  record: ProgressExerciseRecordModel['initialRecord'],
  isBodyweight: boolean,
  missing: string,
): string {
  if (record === null) return missing;
  if (isBodyweight || record.weightKg === undefined) return `${record.reps}回`;
  return `${record.weightKg}kg × ${record.reps}`;
}

export function ExerciseRecordCard({
  exercise,
}: {
  readonly exercise: ProgressExerciseRecordModel;
}) {
  return (
    <article className="progress-exercise-card">
      <header className="progress-exercise-card__header">
        <h3>{exercise.exerciseName}</h3>
        <strong>{exercise.sessionsCompleted}回実施</strong>
      </header>
      <p className="progress-exercise-card__meta">
        <span>{exercise.catalogName}</span>
        <span aria-hidden="true"> · </span>
        <span>{exercise.categoryJapanese} / {exercise.categoryEnglish}</span>
      </p>
      <div className="progress-exercise-card__records">
        <div>
          <span>初回記録</span>
          <strong>{recordText(exercise.initialRecord, exercise.isBodyweight, '—')}</strong>
        </div>
        <div>
          <span>最新記録</span>
          <strong>{recordText(exercise.latestRecord, exercise.isBodyweight, '記録なし')}</strong>
        </div>
        <div className="progress-exercise-card__suggestion">
          <span>次回目安</span>
          <strong>{exercise.nextSuggestion}</strong>
        </div>
      </div>
    </article>
  );
}
