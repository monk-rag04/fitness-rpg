import { useOptionalAdventureQuest } from '../../state/AdventureQuestContext';
import { ExerciseRecordList } from './ExerciseRecordList';
import { MainStrengthRecord } from './MainStrengthRecord';
import { deriveProgressScreenModel } from './progressPresentation';
import type { ProgressScreenModel } from './progressPresentation';
import { StageProgressSummary } from './StageProgressSummary';

export function ProgressScreen() {
  const adventure = useOptionalAdventureQuest();
  const model: ProgressScreenModel = deriveProgressScreenModel(adventure === null ? null : {
    roadmap: adventure.roadmap,
    progress: adventure.progress,
    exerciseProgressById: adventure.exerciseProgressById,
    workoutResultsByDay: adventure.workoutResultsByDay,
    completedStages: adventure.completedStages,
    mainStrengthGoalE1rmKg: adventure.mainStrengthGoalE1rmKg,
  });

  return (
    <section className="progress-screen" aria-labelledby="progress-screen-title">
      <header className="progress-screen__header">
        <p>TRAINING LOG</p>
        <h1 id="progress-screen-title">PROGRESS</h1>
      </header>
      <StageProgressSummary stageProgress={model.stageProgress} />
      <MainStrengthRecord mainStrength={model.mainStrength} />
      <ExerciseRecordList exerciseRecords={model.exerciseRecords} />
    </section>
  );
}
