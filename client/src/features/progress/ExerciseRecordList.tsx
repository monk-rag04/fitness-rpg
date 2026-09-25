import { ExerciseRecordCard } from './ExerciseRecordCard';
import type { ProgressScreenModel } from './progressPresentation';

export function ExerciseRecordList({
  exerciseRecords,
}: {
  readonly exerciseRecords: ProgressScreenModel['exerciseRecords'];
}) {
  return (
    <section className="progress-exercise-records" aria-labelledby="progress-exercise-records-title">
      <h2 id="progress-exercise-records-title" className="character-section-title character-section-title--plain">
        <span>EXERCISE RECORDS</span>
      </h2>
      {exerciseRecords.length === 0 ? (
        <div className="progress-records-empty character-ornate-card">
          <p>まだトレーニング記録がありません</p>
          <span>Training Questを完了すると、Exerciseごとの実績がここに残ります。</span>
        </div>
      ) : (
        <div className="progress-exercise-records__list">
          {exerciseRecords.map((exercise) => (
            <ExerciseRecordCard key={exercise.exerciseId} exercise={exercise} />
          ))}
        </div>
      )}
    </section>
  );
}
