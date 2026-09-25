import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { QuestClearFeedback } from './components/QuestClearFeedback';
import { AdventureMap } from './features/adventure/AdventureMap';
import { Onboarding } from './features/onboarding/Onboarding';
import { CurrentQuest } from './features/quests/CurrentQuest';
import { CharacterScreen } from './features/character/CharacterScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
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
      {screen !== 'quest' && (
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
              },
              mainStrengthGoalE1rmKg: result.input.finalGoalE1rmKg,
              onboardingBaseline: {
                exerciseId: result.baseline.exerciseId,
                weightKg: result.baseline.weightKg,
                reps: result.baseline.reps,
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
