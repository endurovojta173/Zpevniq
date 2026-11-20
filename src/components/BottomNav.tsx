import cs from '../i18n/cs.json';
import { platform } from '../services/platform';

export type AppSection = 'library' | 'search' | 'settings';

export interface BottomNavProps {
  readonly activeSection: AppSection;
  readonly savedCount: number;
  readonly hidden?: boolean;
  readonly onSelectSection: (section: AppSection) => void;
}

function SongbookIcon({ active }: { readonly active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      {!active ? (
        <>
          <path d="M9 10h6" />
          <path d="M9 7h6" />
        </>
      ) : null}
    </svg>
  );
}

function SearchIcon({ active }: { readonly active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.4 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SettingsIcon({ active }: { readonly active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function NavItemIcon({
  id,
  active,
}: {
  readonly id: AppSection;
  readonly active: boolean;
}) {
  if (id === 'library') {
    return <SongbookIcon active={active} />;
  }
  if (id === 'search') {
    return <SearchIcon active={active} />;
  }
  return <SettingsIcon active={active} />;
}

export function BottomNav({
  activeSection,
  savedCount,
  hidden = false,
  onSelectSection,
}: BottomNavProps) {
  const items: readonly {
    readonly id: AppSection;
    readonly label: string;
    readonly badge?: number;
  }[] = [
    { id: 'library', label: cs.nav.songbook, badge: savedCount },
    { id: 'search', label: cs.nav.search },
    { id: 'settings', label: cs.nav.settings },
  ];

  const isIosGlass = platform.chromeStyle === 'ios-glass';
  const hideMotionClasses = hidden
    ? 'translate-y-24 opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto'
    : 'translate-y-0 opacity-100';

  const containerClasses = isIosGlass
    ? `fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-30 mx-auto max-w-md rounded-full p-1.5 chrome-glass select-none transition-[transform,opacity] duration-200 md:inset-x-auto md:inset-y-0 md:left-0 md:bottom-0 md:mx-0 md:w-22 md:max-w-none md:rounded-none md:border-0 md:border-r md:border-outline-variant md:p-0 md:shadow-none md:chrome-bar ${hideMotionClasses}`
    : `fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant chrome-bar pb-[env(safe-area-inset-bottom)] select-none transition-[transform,opacity] duration-200 md:inset-y-0 md:right-auto md:w-22 md:border-t-0 md:border-r md:pb-0 ${hideMotionClasses}`;

  return (
    <nav aria-label={cs.nav.ariaLabel} className={containerClasses}>
      <div className="mx-auto grid max-w-xl grid-cols-3 md:flex md:h-full md:flex-col md:items-center md:gap-2 md:px-2 md:pt-[calc(env(safe-area-inset-top)+1rem)] md:pl-[calc(env(safe-area-inset-left)+0.5rem)]">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id !== activeSection) {
                  platform.hapticTap();
                }
                onSelectSection(item.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-medium transition-colors duration-150 active:scale-[0.97] md:min-h-14 md:rounded-2xl ${
                isIosGlass && isActive
                  ? 'bg-primary-container text-on-primary-container md:bg-transparent md:text-on-surface'
                  : isActive
                    ? 'text-on-surface'
                    : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <div
                className={`relative flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-150 ${
                  isIosGlass
                    ? isActive
                      ? 'md:bg-primary-container md:text-on-primary-container'
                      : 'md:group-hover:bg-surface-container-high'
                    : isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'group-hover:bg-surface-container-high'
                }`}
              >
                <NavItemIcon id={item.id} active={isActive} />

                {item.badge !== undefined && item.badge > 0 ? (
                  <span
                    className={`absolute -top-0.5 right-2 min-w-[1.15rem] rounded-full px-1 text-center text-[10px] leading-4 font-semibold tabular-nums ${
                      isActive
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-highest text-on-surface'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>

              <span className={isActive ? 'font-semibold' : 'font-medium'}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
