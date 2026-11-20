import { useEffect, useMemo, useState } from 'react';
import { groupLineIntoWordClusters, parseChordProPreview } from '../core/chordpro/preview';
import {
  type ChordNotation,
  transposeChordPro,
  transposePreview,
} from '../core/chordpro/transposer';
import cs from '../i18n/cs.json';
import { platform } from '../services/platform';

const FONT_SCALE_STORAGE_KEY = 'zpevniq:songFontScale';
const MIN_FONT_SCALE = 80;
const MAX_FONT_SCALE = 160;
const DEFAULT_FONT_SCALE = 100;
const FONT_SCALE_STEP = 10;

const MIN_TRANSPOSE = -11;
const MAX_TRANSPOSE = 11;
const MIN_CAPO = 0;
const MAX_CAPO = 11;

function readInitialFontScale(): number {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_FONT_SCALE;
    }
    const raw = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FONT_SCALE;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= MIN_FONT_SCALE && parsed <= MAX_FONT_SCALE) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors.
  }
  return DEFAULT_FONT_SCALE;
}

function persistFontScale(value: number): void {
  try {
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(value));
  } catch {
    // Ignore storage persistence errors.
  }
}

function formatTransposeOffset(steps: number): string {
  return steps > 0 ? `+${steps}` : String(steps);
}

export interface SongPreviewProps {
  readonly chordproContent: string;
  readonly sourceName: string;
  readonly sourceUrl?: string | null;
  readonly fallbackTitle?: string;
  readonly fallbackArtist?: string;
  readonly isSaved?: boolean;
  readonly isSaving?: boolean;
  readonly saveError?: string | null;
  readonly chordNotation?: ChordNotation;
  readonly sourceNotationHint?: ChordNotation;
  readonly onSave?: (chordproContent?: string) => void;
  readonly onSaveTransposed?: (transposedChordpro: string) => void;
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
  chordNotation = 'cs',
  sourceNotationHint = 'cs',
  onSave,
  onSaveTransposed,
  onDelete,
  onBack,
}: SongPreviewProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [songFontScale, setSongFontScale] = useState<number>(() => readInitialFontScale());

  const parsed = useMemo(() => parseChordProPreview(chordproContent), [chordproContent]);
  const baseCapo = parsed.capo ?? 0;

  const [transposeSteps, setTransposeSteps] = useState(0);
  const [capoFret, setCapoFret] = useState(baseCapo);

  useEffect(() => {
    setTransposeSteps(0);
    setCapoFret(baseCapo);
  }, [chordproContent, baseCapo]);

  const effectiveSemitones = transposeSteps - (capoFret - baseCapo);
  const hasPendingTransform = transposeSteps !== 0 || capoFret !== baseCapo;

  const transposedPreview = useMemo(
    () =>
      transposePreview(parsed, {
        semitones: effectiveSemitones,
        targetNotation: chordNotation,
        sourceNotationHint,
        capo: capoFret,
      }),
    [parsed, effectiveSemitones, chordNotation, sourceNotationHint, capoFret],
  );

  const activeChordPro = useMemo(
    () =>
      transposeChordPro(chordproContent, {
        semitones: effectiveSemitones,
        targetNotation: chordNotation,
        sourceNotationHint,
        capo: capoFret,
      }),
    [chordproContent, effectiveSemitones, chordNotation, sourceNotationHint, capoFret],
  );

  const displayTitle = transposedPreview.title ?? fallbackTitle ?? cs.preview.untitled;
  const displayArtist = transposedPreview.artist ?? fallbackArtist;
  const safeSourceUrl =
    sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null;

  useEffect(() => {
    if (!isSheetOpen) {
      setConfirmingDelete(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSheetOpen]);

  const updateFontScale = (next: number) => {
    const clamped = Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, next));
    if (clamped !== songFontScale) {
      platform.hapticTap();
      setSongFontScale(clamped);
      persistFontScale(clamped);
    }
  };

  const updateTransposeSteps = (next: number) => {
    const clamped = Math.min(MAX_TRANSPOSE, Math.max(MIN_TRANSPOSE, next));
    if (clamped !== transposeSteps) {
      platform.hapticTap();
      setTransposeSteps(clamped);
    }
  };

  const updateCapoFret = (next: number) => {
    const clamped = Math.min(MAX_CAPO, Math.max(MIN_CAPO, next));
    if (clamped !== capoFret) {
      platform.hapticTap();
      setCapoFret(clamped);
    }
  };

  return (
    <section className="flex w-full min-w-0 flex-col overflow-x-clip">
      <div className="sticky top-0 z-20 border-b border-outline-variant chrome-bar pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2.5 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)] select-none">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              platform.hapticTap();
              onBack();
            }}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-4 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-high active:scale-[0.98]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>{cs.preview.back}</span>
          </button>

          <div className="flex items-center gap-2">
            {!isSaved && onSave ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  platform.hapticTap();
                  onSave(hasPendingTransform ? activeChordPro : chordproContent);
                }}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary transition-transform duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                <span>{isSaving ? cs.preview.saving : cs.preview.saveToSongbook}</span>
              </button>
            ) : null}

            {isSaved ? (
              <span className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-success/40 bg-success-container px-3.5 text-xs font-semibold text-on-success-container">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>{cs.preview.savedBadge}</span>
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => {
                platform.hapticTap();
                setIsSheetOpen(true);
              }}
              aria-label={cs.preview.displayTools}
              aria-expanded={isSheetOpen}
              className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3.5 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-high active:scale-[0.98]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 21v-7" />
                <path d="M4 10V3" />
                <path d="M12 21v-9" />
                <path d="M12 8V3" />
                <path d="M20 21v-5" />
                <path d="M20 12V3" />
                <path d="M2 14h4" />
                <path d="M10 8h4" />
                <path d="M18 16h4" />
              </svg>
              <span className="hidden sm:inline">{cs.preview.displayTools}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]">
        {saveError ? (
          <div
            role="alert"
            className="rounded-2xl border border-error/40 bg-error-container px-4 py-3 text-xs font-medium text-on-error-container"
          >
            {cs.preview.saveError}
          </div>
        ) : null}

        <header className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-on-surface break-words">
            {displayTitle}
          </h1>
          {displayArtist ? (
            <p className="text-sm font-medium text-on-surface-variant break-words">
              {displayArtist}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {transposedPreview.key ? (
              <span className="inline-flex items-center rounded-full border border-primary/35 bg-primary-container px-3 py-1 font-semibold text-on-primary-container">
                {cs.preview.keyLabel}: {transposedPreview.key}
              </span>
            ) : null}
            {capoFret > 0 ? (
              <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container px-3 py-1 font-medium text-on-surface tabular-nums">
                {cs.preview.capoLabel}: {capoFret}
              </span>
            ) : null}
            {transposeSteps !== 0 ? (
              <button
                type="button"
                onClick={() => {
                  platform.hapticTap();
                  setIsSheetOpen(true);
                }}
                className="inline-flex items-center rounded-full border border-primary/35 bg-primary-container px-3 py-1 font-semibold text-on-primary-container tabular-nums"
              >
                {cs.preview.transposeLabel}: {formatTransposeOffset(transposeSteps)}
              </button>
            ) : null}
            {safeSourceUrl ? (
              <a
                href={safeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-outline-variant bg-surface-container px-3 py-1 text-on-surface-variant underline decoration-outline underline-offset-2 transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <span>
                  {cs.preview.sourceLabel}: {sourceName}
                </span>
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container px-3 py-1 text-on-surface-variant">
                {cs.preview.sourceLabel}: {sourceName}
              </span>
            )}
          </div>
        </header>

        <div
          style={{ fontSize: `${songFontScale / 100}rem` }}
          className="select-text w-full min-w-0 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low p-4 font-sans leading-relaxed text-on-surface sm:p-6"
        >
          {transposedPreview.lines.map((line, lineIdx) => {
            if (line.kind === 'empty') {
              return <div key={lineIdx} className="h-3.5" />;
            }

            if (line.kind === 'comment') {
              return (
                <p
                  key={lineIdx}
                  className="mt-4 mb-1 text-xs font-bold tracking-wider text-chord uppercase break-words"
                >
                  {line.text}
                </p>
              );
            }

            if (!line.hasChords) {
              const plainLine = line.segments
                .map((segment) => segment.lyric)
                .join('')
                .trimStart();
              return (
                <p key={lineIdx} className="mt-1 leading-snug text-on-surface break-words">
                  {plainLine.length > 0 ? plainLine : '\u00A0'}
                </p>
              );
            }

            const clusters = groupLineIntoWordClusters(line.segments);
            return (
              <div
                key={lineIdx}
                className="mt-3 flex flex-wrap items-end gap-y-1.5 leading-snug"
              >
                {clusters.map((cluster, clusterIdx) => (
                  <span
                    key={clusterIdx}
                    className={`inline-flex max-w-full flex-wrap items-end ${
                      cluster.trailingSpace ? 'mr-[0.38em]' : ''
                    }`}
                  >
                    {cluster.parts.map((part, partIdx) => (
                      <span key={partIdx} className="inline-flex max-w-full flex-col">
                        <span
                          className={`min-h-[1.25em] text-[0.82em] leading-tight font-bold text-chord ${
                            part.chord ? 'pr-1' : ''
                          }`}
                        >
                          {part.chord ?? '\u00A0'}
                        </span>
                        <span className="break-words">
                          {part.lyric.length > 0 ? part.lyric : '\u00A0'}
                        </span>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {isSheetOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/55"
          onClick={() => setIsSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="song-sheet-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border-t border-outline-variant bg-surface-container-high px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-on-surface shadow-2xl select-none"
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-outline/60" aria-hidden="true" />

            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="song-sheet-title" className="text-base font-bold tracking-tight">
                {cs.preview.sheetTitle}
              </h2>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                aria-label={cs.preview.close}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-on-surface">
                    {cs.preview.transposeLabel}
                  </p>
                  {transposedPreview.key ? (
                    <p className="text-xs text-on-surface-variant">
                      {cs.preview.keyLabel}: {transposedPreview.key}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={transposeSteps <= MIN_TRANSPOSE}
                    onClick={() => updateTransposeSteps(transposeSteps - 1)}
                    aria-label={cs.preview.transposeDown}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-base font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTransposeSteps(0)}
                    title={cs.preview.transposeReset}
                    className="inline-flex min-h-12 min-w-14 items-center justify-center rounded-xl px-2 text-sm font-semibold text-on-surface tabular-nums hover:bg-surface-container-highest"
                  >
                    {formatTransposeOffset(transposeSteps)}
                  </button>
                  <button
                    type="button"
                    disabled={transposeSteps >= MAX_TRANSPOSE}
                    onClick={() => updateTransposeSteps(transposeSteps + 1)}
                    aria-label={cs.preview.transposeUp}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-base font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl bg-surface-container p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-on-surface">
                    {cs.preview.capoLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={capoFret <= MIN_CAPO}
                      onClick={() => updateCapoFret(capoFret - 1)}
                      aria-label={cs.preview.capoDown}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-base font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCapoFret(baseCapo)}
                      title={cs.preview.capoNone}
                      className="inline-flex min-h-12 min-w-20 items-center justify-center rounded-xl px-2 text-sm font-semibold text-on-surface tabular-nums hover:bg-surface-container-highest"
                    >
                      {capoFret === 0
                        ? cs.preview.capoNone
                        : `${capoFret}${cs.preview.capoFretSuffix}`}
                    </button>
                    <button
                      type="button"
                      disabled={capoFret >= MAX_CAPO}
                      onClick={() => updateCapoFret(capoFret + 1)}
                      aria-label={cs.preview.capoUp}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-base font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant">{cs.preview.capoHint}</p>
              </div>

              {isSaved && onSaveTransposed && hasPendingTransform ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    platform.hapticTap();
                    setIsSheetOpen(false);
                    onSaveTransposed(activeChordPro);
                  }}
                  className="min-h-12 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-transform duration-150 hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                >
                  {isSaving ? cs.preview.saving : cs.preview.saveTransposition}
                </button>
              ) : null}

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container p-3.5">
                <span className="text-sm font-medium text-on-surface">
                  {cs.preview.fontSizeLabel}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={songFontScale <= MIN_FONT_SCALE}
                    onClick={() => updateFontScale(songFontScale - FONT_SCALE_STEP)}
                    aria-label={cs.preview.fontDecrease}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-base font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFontScale(DEFAULT_FONT_SCALE)}
                    title={cs.preview.fontReset}
                    className="inline-flex min-h-12 min-w-14 items-center justify-center rounded-xl px-2 text-sm font-semibold text-on-surface tabular-nums hover:bg-surface-container-highest"
                  >
                    {songFontScale}%
                  </button>
                  <button
                    type="button"
                    disabled={songFontScale >= MAX_FONT_SCALE}
                    onClick={() => updateFontScale(songFontScale + FONT_SCALE_STEP)}
                    aria-label={cs.preview.fontIncrease}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-base font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              {isSaved && onDelete ? (
                <div className="rounded-2xl bg-surface-container p-3.5">
                  {confirmingDelete ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-on-error-container">
                        {cs.preview.confirmRemove}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(false)}
                          className="min-h-12 rounded-xl border border-outline-variant bg-surface-container-low px-4 text-sm font-medium text-on-surface hover:bg-surface-container-highest"
                        >
                          {cs.preview.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            platform.hapticTap();
                            setIsSheetOpen(false);
                            onDelete();
                          }}
                          className="min-h-12 rounded-xl bg-error-container px-4 text-sm font-semibold text-on-error-container transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {cs.preview.removeFromSongbook}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        platform.hapticTap();
                        setConfirmingDelete(true);
                      }}
                      className="min-h-12 w-full rounded-xl border border-error/40 bg-error-container px-4 text-sm font-semibold text-on-error-container transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {cs.preview.removeFromSongbook}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
