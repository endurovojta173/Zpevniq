import type { ThemePreference } from '../hooks/useTheme';
import cs from '../i18n/cs.json';
import { platform } from '../services/platform';
import type { ProviderLanguage } from '../services/scrapers/provider.interface';

export interface RegisteredSourceInfo {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly language: ProviderLanguage;
  readonly enabled: boolean;
}

export interface SettingsPanelProps {
  readonly totalSavedCount: number;
  readonly registeredSources: readonly RegisteredSourceInfo[];
  readonly themePreference: ThemePreference;
  readonly onThemePreferenceChange: (preference: ThemePreference) => void;
  readonly onToggleSource: (id: string, enabled: boolean) => void;
}

const THEME_OPTIONS: readonly { readonly id: ThemePreference; readonly label: string }[] = [
  { id: 'system', label: cs.settings.themes.system },
  { id: 'dark', label: cs.settings.themes.dark },
  { id: 'light', label: cs.settings.themes.light },
  { id: 'stage', label: cs.settings.themes.stage },
];

function InfoRow({
  label,
  value,
  highlight = false,
  numeric = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
  readonly numeric?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span
        className={`text-right font-medium ${numeric ? 'tabular-nums' : ''} ${
          highlight ? 'text-success' : 'text-on-surface'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function formatLanguageTag(language: ProviderLanguage): string {
  if (language === 'cs') {
    return 'CZ';
  }
  if (language === 'en') {
    return 'EN';
  }
  return 'INT';
}

export function SettingsPanel({
  totalSavedCount,
  registeredSources,
  themePreference,
  onThemePreferenceChange,
  onToggleSource,
}: SettingsPanelProps) {
  return (
    <section className="flex w-full flex-col">
      <div className="sticky top-0 z-20 border-b border-outline-variant chrome-bar pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)] select-none">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-on-surface">
            {cs.settings.title}
          </h1>
          <span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant tabular-nums">
            v{cs.settings.versionValue}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pt-4 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]">
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h2 className="mb-3 text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
            {cs.settings.appearanceTitle}
          </h2>
          <p className="mb-2 text-sm text-on-surface-variant">{cs.settings.themeLabel}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEME_OPTIONS.map((option) => {
              const isSelected = themePreference === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    platform.hapticTap();
                    onThemePreferenceChange(option.id);
                  }}
                  className={`min-h-12 rounded-xl border px-3 text-sm font-semibold select-none transition-colors duration-150 ${
                    isSelected
                      ? 'border-primary/50 bg-primary-container text-on-primary-container'
                      : 'border-outline-variant bg-surface-container text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {themePreference === 'stage' ? (
            <p className="mt-2.5 text-xs text-on-surface-variant">{cs.settings.stageHint}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
            {cs.settings.aboutTitle}
          </h2>
          <div className="mb-3 border-b border-outline-variant pb-3">
            <p className="text-xl font-bold tracking-tight text-on-surface">{cs.app.name}</p>
            <p className="mt-0.5 text-sm text-on-surface-variant">{cs.app.subtitle}</p>
          </div>
          <div className="divide-y divide-outline-variant">
            <InfoRow
              label={cs.settings.versionLabel}
              value={cs.settings.versionValue}
              numeric
            />
            <InfoRow label={cs.settings.formatLabel} value={cs.settings.formatValue} />
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
            {cs.settings.environmentTitle}
          </h2>
          <div className="divide-y divide-outline-variant">
            <InfoRow
              label={cs.settings.platformLabel}
              value={platform.canScrape ? cs.app.platformMobile : cs.app.platformWeb}
            />
            <InfoRow label={cs.settings.osLabel} value={platform.os.toUpperCase()} />
            <InfoRow
              label={cs.settings.storageLabel}
              value={platform.isNative ? cs.settings.storageNative : cs.settings.storageWeb}
            />
            <InfoRow
              label={cs.settings.savedSongsLabel}
              value={String(totalSavedCount)}
              numeric
            />
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
            {cs.settings.sourcesTitle}
          </h2>
          <div className="divide-y divide-outline-variant">
            <InfoRow
              label={cs.settings.sourcesStatusLabel}
              value={
                platform.canScrape
                  ? cs.settings.sourcesEnabled
                  : cs.settings.sourcesDisabledWeb
              }
              highlight={platform.canScrape}
            />
            <div className="flex flex-col gap-2.5 pt-3">
              <span className="text-xs text-on-surface-variant">
                {cs.settings.activeSourcesLabel}
              </span>
              <div className="flex flex-col gap-2">
                {registeredSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container px-3.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-on-surface">
                          {source.name}
                        </span>
                        <span className="shrink-0 rounded border border-outline-variant bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                          {formatLanguageTag(source.language)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-on-surface-variant">
                        {source.baseUrl.replace(/^https?:\/\/(?:www\.)?/, '')}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={source.enabled}
                      aria-label={source.name}
                      onClick={() => {
                        platform.hapticTap();
                        onToggleSource(source.id, !source.enabled);
                      }}
                      className="inline-flex min-h-12 min-w-14 shrink-0 cursor-pointer items-center justify-end"
                    >
                      <span
                        className={`relative inline-flex h-8 w-[52px] items-center rounded-full border transition-colors ${
                          source.enabled
                            ? 'border-primary bg-primary'
                            : 'border-outline bg-surface-container-highest'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 rounded-full transition-transform duration-150 ${
                            source.enabled
                              ? 'translate-x-6 bg-on-primary'
                              : 'translate-x-1 bg-on-surface-variant'
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="rounded-2xl border border-success/30 bg-success-container px-4 py-3 text-xs leading-relaxed text-on-success-container">
          {cs.settings.offlineNotice}
        </p>
      </div>
    </section>
  );
}
