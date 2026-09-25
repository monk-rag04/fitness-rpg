import { getBottomNavigationItems } from './bottomNavigationItems';
import type { AdventureHubScreen } from '../state/AdventureQuestContext';

export function BottomNavigation({
  activeScreen,
  onNavigate,
}: {
  readonly activeScreen: AdventureHubScreen;
  readonly onNavigate: (screen: AdventureHubScreen) => void;
}) {
  return (
    <nav className="bottom-navigation" aria-label="Adventure navigation">
      {getBottomNavigationItems(activeScreen).map((item) => (
        <button
          key={item.screen}
          type="button"
          className={`bottom-navigation__item${item.active ? ' bottom-navigation__item--active' : ''}`}
          aria-current={item.ariaCurrent}
          onClick={() => onNavigate(item.screen)}
        >
          <span className="bottom-navigation__icon" aria-hidden="true">{item.icon}</span>
          <span className="bottom-navigation__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
