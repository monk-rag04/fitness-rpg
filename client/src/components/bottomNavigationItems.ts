import type { AdventureHubScreen } from '../state/AdventureQuestContext';

export interface BottomNavigationItem {
  readonly screen: AdventureHubScreen;
  readonly label: 'MAP' | 'CHARACTER' | 'PROGRESS';
  readonly icon: string;
  readonly active: boolean;
  readonly ariaCurrent: 'page' | undefined;
}

const HUB_ITEMS = [
  { screen: 'map', label: 'MAP', icon: '⌖' },
  { screen: 'character', label: 'CHARACTER', icon: '♜' },
  { screen: 'progress', label: 'PROGRESS', icon: '▥' },
] as const;

export function getBottomNavigationItems(activeScreen: AdventureHubScreen): readonly BottomNavigationItem[] {
  return HUB_ITEMS.map((item) => ({
    ...item,
    active: item.screen === activeScreen,
    ariaCurrent: item.screen === activeScreen ? 'page' : undefined,
  }));
}
