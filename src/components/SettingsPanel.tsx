import cs from '../i18n/cs.json';
import { platform } from '../services/platform';

export interface RegisteredSourceInfo {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
}

export interface SettingsPanelProps {
  readonly totalSavedCount: number;
  readonly registeredSources: readonly RegisteredSourceInfo[];
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

export function SettingsPanel({
  totalSavedCount,
  registeredSources,
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
            <div className="flex flex-col gap-2 pt-3">
              <span className="text-xs text-neutral-400">{cs.settings.activeSourcesLabel}</span>
              <div className="flex flex-wrap gap-2">
                {registeredSources.map((source) => (
                  <span
                    key={source.id}
                    className="rounded-lg border border-neutral-700/80 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200"
                  >
                    {source.name}{' '}
                    <span className="text-neutral-500">
                      ({source.baseUrl.replace(/^https?:\/\/(?:www\.)?/, '')})
                    </span>
                  </span>
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
