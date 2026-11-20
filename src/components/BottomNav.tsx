import cs from '../i18n/cs.json';

export type AppSection = 'library' | 'search' | 'settings';

export interface BottomNavProps {
  readonly activeSection: AppSection;
  readonly savedCount: number;
  readonly onSelectSection: (section: AppSection) => void;
}

function SongbookIcon({ active }: { readonly active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M9 10h6" />
      <path d="M9 7h6" />
    </svg>
  );
}

function SearchIcon({ active }: { readonly active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
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
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
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

export function BottomNav({
  activeSection,
  savedCount,
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

  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800/90 bg-neutral-950/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-xl grid-cols-3">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition ${
                isActive ? 'text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-0.5 w-10 rounded-full bg-amber-400"
                />
              ) : null}

              <div className="relative">
                {item.id === 'library' ? (
                  <SongbookIcon active={isActive} />
                ) : item.id === 'search' ? (
                  <SearchIcon active={isActive} />
                ) : (
                  <SettingsIcon active={isActive} />
                )}

                {item.badge !== undefined && item.badge > 0 ? (
                  <span
                    className={`absolute -top-1.5 -right-3 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] leading-4 font-semibold ${
                      isActive
                        ? 'bg-amber-400 text-neutral-950'
                        : 'bg-neutral-800 text-neutral-200'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>

              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
