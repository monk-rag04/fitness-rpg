import { BodyGrowthGrid } from './BodyGrowthGrid';
import { CharacterHero } from './CharacterHero';
import { MainStrengthCard } from './MainStrengthCard';
import { StageProgressCard } from './StageProgressCard';
import { deriveCharacterScreenModel } from './characterPresentation';
import { useOptionalAdventureQuest } from '../../state/AdventureQuestContext';

export function CharacterScreen() {
  const adventure = useOptionalAdventureQuest();
  const model = deriveCharacterScreenModel(adventure === null ? null : {
    roadmap: adventure.roadmap,
    progress: adventure.progress,
    exerciseProgressById: adventure.exerciseProgressById,
    workoutResultsByDay: adventure.workoutResultsByDay,
    completedStages: adventure.completedStages,
    characterGrowth: adventure.characterGrowth,
    mainStrengthGoalE1rmKg: adventure.mainStrengthGoalE1rmKg,
  });

  return (
    <section className="character-screen" aria-labelledby="character-title">
      <CharacterHero />
      <MainStrengthCard mainStrength={model.mainStrength} />
      <BodyGrowthGrid trainingExp={model.trainingExp} recoveryExp={model.recoveryExp} />
      <StageProgressCard stageProgress={model.stageProgress} />
    </section>
  );
}
