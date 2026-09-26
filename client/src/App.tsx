import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { QuestClearFeedback } from './components/QuestClearFeedback';
import { AdventureMap } from './features/adventure/AdventureMap';
import { Onboarding } from './features/onboarding/Onboarding';
import { CurrentQuest } from './features/quests/CurrentQuest';
import { CharacterScreen } from './features/character/CharacterScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
import { BossBattleScreen } from './features/boss/BossBattleScreen';
import { StageClearScreen } from './features/boss/StageClearScreen';
import { BottomNavigation } from './components/BottomNavigation';
import {
  AdventureQuestProvider,
  createOnboardingAdventureSession,
  useAdventureQuest,
  type AdventureQuestSession,
} from './state/AdventureQuestContext';

function AdventureQuestApp() {
  const { screen, navigateToHub } = useAdventureQuest();

  return (
    <>
      {screen === 'map' && <AdventureMap />}
      {screen === 'quest' && <CurrentQuest />}
      {screen === 'character' && <CharacterScreen />}
      {screen === 'progress' && <ProgressScreen />}
      {screen === 'boss' && <BossBattleScreen />}
      {screen === 'stage-clear' && <StageClearScreen />}
      {screen !== 'quest' && screen !== 'boss' && screen !== 'stage-clear' && (
        <BottomNavigation activeScreen={screen} onNavigate={navigateToHub} />
      )}
      <QuestClearFeedback />
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<AdventureQuestSession | null>(null);

  return (
    <AppShell>
      {session === null ? (
        <Onboarding
          onRoadmapCreated={(result) => {
            setSession(createOnboardingAdventureSession({
              roadmap: result.roadmap,
              initialProgress: result.progress,
              stageTrainingProgramContext: {
                mainExerciseId: result.input.mainExerciseId,
                currentE1rmKg: result.baseline.baselineE1rmKg,
                trainingExperienceMonths: result.input.trainingExperienceMonths,
                trainingFrequencyPerWeek: result.input.trainingFrequencyPerWeek,
                bodyWeightKg: result.input.bodyWeightKg,
              },
              mainStrengthGoalE1rmKg: result.input.finalGoalE1rmKg,
              onboardingBaseline: {
                exerciseId: result.baseline.exerciseId,
                weightKg: result.baseline.weightKg,
                reps: result.baseline.reps,
                ...(result.baseline.source === 'estimated_profile'
                  ? { source: 'estimated_profile' as const }
                  : {}),
              },
            }));
          }}
        />
      ) : (
        <AdventureQuestProvider session={session}>
          <AdventureQuestApp />
        </AdventureQuestProvider>
      )}
    </AppShell>
  );
}
