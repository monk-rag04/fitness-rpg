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
