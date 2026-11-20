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
  readonly onToggleSource: (id: string, enabled: boolean) => void;
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-neutral-400">{label}</span>
      <span
        className={`text-right font-medium ${
          highlight ? 'text-emerald-300' : 'text-neutral-100'
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
  onToggleSource,
}: SettingsPanelProps) {
  return (
    <section className="flex w-full flex-col">
      <div
        className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/95 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-white">{cs.settings.title}</h1>
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-400">
            v{cs.settings.versionValue}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            {cs.settings.aboutTitle}
          </h2>
          <div className="mb-3 border-b border-neutral-800/80 pb-3">
            <p className="text-xl font-bold tracking-tight text-white">{cs.app.name}</p>
            <p className="mt-0.5 text-sm text-neutral-400">{cs.app.subtitle}</p>
          </div>
          <div className="divide-y divide-neutral-800/60">
            <InfoRow label={cs.settings.versionLabel} value={cs.settings.versionValue} />
            <InfoRow label={cs.settings.formatLabel} value={cs.settings.formatValue} />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            {cs.settings.environmentTitle}
          </h2>
          <div className="divide-y divide-neutral-800/60">
            <InfoRow
              label={cs.settings.platformLabel}
              value={platform.canScrape ? cs.app.platformMobile : cs.app.platformWeb}
            />
            <InfoRow label={cs.settings.osLabel} value={platform.os.toUpperCase()} />
            <InfoRow
              label={cs.settings.storageLabel}
              value={platform.isNative ? cs.settings.storageNative : cs.settings.storageWeb}
            />
            <InfoRow label={cs.settings.savedSongsLabel} value={String(totalSavedCount)} />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            {cs.settings.sourcesTitle}
          </h2>
          <div className="divide-y divide-neutral-800/60">
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
              <span className="text-xs text-neutral-400">{cs.settings.activeSourcesLabel}</span>
              <div className="flex flex-col gap-2">
                {registeredSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-neutral-100">
                          {source.name}
                        </span>
                        <span className="shrink-0 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
                          {formatLanguageTag(source.language)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-neutral-500">
                        {source.baseUrl.replace(/^https?:\/\/(?:www\.)?/, '')}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={source.enabled}
                      aria-label={source.name}
                      onClick={() => onToggleSource(source.id, !source.enabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        source.enabled ? 'bg-amber-500' : 'bg-neutral-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          source.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs leading-relaxed text-emerald-200/90">
          {cs.settings.offlineNotice}
        </p>
      </div>
    </section>
  );
}
