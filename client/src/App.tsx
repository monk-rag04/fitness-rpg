import { AppShell } from './components/AppShell';
import { QuestClearFeedback } from './components/QuestClearFeedback';
import { AdventureMap } from './features/adventure/AdventureMap';
import { CurrentQuest } from './features/quests/CurrentQuest';
import {
  AdventureQuestProvider,
  useAdventureQuest,
} from './state/AdventureQuestContext';

function AdventureQuestApp() {
  const { screen } = useAdventureQuest();

  return (
    <AppShell>
      {screen === 'map' ? <AdventureMap /> : <CurrentQuest />}
      <QuestClearFeedback />
    </AppShell>
  );
}

export default function App() {
  return (
    <AdventureQuestProvider>
      <AdventureQuestApp />
    </AdventureQuestProvider>
  );
}
