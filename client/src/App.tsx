import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { QuestClearFeedback } from './components/QuestClearFeedback';
import { AdventureMap } from './features/adventure/AdventureMap';
import { Onboarding } from './features/onboarding/Onboarding';
import { CurrentQuest } from './features/quests/CurrentQuest';
import {
  AdventureQuestProvider,
  createOnboardingAdventureSession,
  useAdventureQuest,
  type AdventureQuestSession,
} from './state/AdventureQuestContext';

function AdventureQuestApp() {
  const { screen } = useAdventureQuest();

  return (
    <>
      {screen === 'map' ? <AdventureMap /> : <CurrentQuest />}
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
