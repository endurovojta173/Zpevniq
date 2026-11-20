import { useMemo, useState } from 'react';
import { parseChordProPreview } from '../core/chordpro/preview';
import cs from '../i18n/cs.json';

export interface SongPreviewProps {
  readonly chordproContent: string;
  readonly sourceName: string;
  readonly sourceUrl?: string | null;
  readonly fallbackTitle?: string;
  readonly fallbackArtist?: string;
  readonly isSaved?: boolean;
  readonly isSaving?: boolean;
  readonly saveError?: string | null;
  readonly onSave?: () => void;
  readonly onDelete?: () => void;
  readonly onBack: () => void;
}

export function SongPreview({
  chordproContent,
  sourceName,
  sourceUrl = null,
  fallbackTitle,
  fallbackArtist,
  isSaved = false,
  isSaving = false,
  saveError = null,
  onSave,
  onDelete,
  onBack,
}: SongPreviewProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  const parsed = useMemo(() => parseChordProPreview(chordproContent), [chordproContent]);
  const displayTitle = parsed.title ?? fallbackTitle ?? 'Bez názvu';
  const displayArtist = parsed.artist ?? fallbackArtist;
  const safeSourceUrl =
    sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null;

  return (
    <section className="flex w-full flex-col">
      <div
        className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/95 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
          >
            ← {cs.preview.back}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {!isSaved && onSave ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={onSave}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? cs.preview.saving : cs.preview.saveToSongbook}
              </button>
            ) : null}

            {isSaved ? (
              <div className="flex items-center gap-1.5">
                <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300">
                  {cs.preview.savedBadge}
                </span>
                {onDelete ? (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={onDelete}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cs.preview.removeFromSongbook}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  viewMode === 'formatted'
                    ? 'bg-amber-500 text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {cs.preview.formattedView}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  viewMode === 'raw'
                    ? 'bg-amber-500 text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {cs.preview.rawChordPro}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4">
        {saveError ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
            {cs.preview.saveError}
          </div>
        ) : null}

        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">{displayTitle}</h2>
          {displayArtist ? <p className="text-sm text-neutral-400">{displayArtist}</p> : null}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {parsed.key ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-medium text-amber-300">
                {cs.preview.keyLabel}: {parsed.key}
              </span>
            ) : null}
            {parsed.capo ? (
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-neutral-300">
                {cs.preview.capoLabel}: {parsed.capo}
              </span>
            ) : null}
            {safeSourceUrl ? (
              <a
                href={safeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-neutral-300 underline decoration-neutral-600 underline-offset-2 transition hover:border-neutral-700 hover:text-white"
              >
                <span>
                  {cs.preview.sourceLabel}: {sourceName}
                </span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-neutral-400">
                {cs.preview.sourceLabel}: {sourceName}
              </span>
            )}
          </div>
        </header>

        {viewMode === 'raw' ? (
          <pre className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 font-mono text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap">
            {chordproContent}
          </pre>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 font-mono text-sm leading-relaxed text-neutral-100">
            {parsed.lines.map((line, lineIdx) => {
              if (line.kind === 'empty') {
                return <div key={lineIdx} className="h-4" />;
              }

              if (line.kind === 'comment') {
                return (
                  <p
                    key={lineIdx}
                    className="my-2 text-xs font-semibold tracking-wider text-amber-400 uppercase"
                  >
                    {line.text}
                  </p>
                );
              }

              return (
                <div
                  key={lineIdx}
                  className={`flex flex-wrap items-end ${line.hasChords ? 'mt-2' : 'mt-0.5'}`}
                >
                  {line.segments.map((segment, segIdx) => (
                    <span key={segIdx} className="inline-flex flex-col whitespace-pre">
                      {line.hasChords ? (
                        <span className="min-h-[1.15em] pr-1.5 text-xs font-bold text-amber-400">
                          {segment.chord ?? ''}
                        </span>
                      ) : null}
                      <span>{segment.lyric.length > 0 ? segment.lyric : ' '}</span>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
