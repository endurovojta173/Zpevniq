import { useEffect, useRef, useState } from 'react';
import type { ChordNotation } from '../core/chordpro/transposer';
import type { SaveSongInput, SavedSong } from '../core/types/song';
import cs from '../i18n/cs.json';
import { platform } from '../services/platform';
import { getProviderById } from '../services/scrapers/registry';
import { SongPreview } from './SongPreview';

export interface SavedSongsPanelProps {
  readonly savedSongs: readonly SavedSong[];
  readonly totalSavedCount: number;
  readonly libraryQuery: string;
  readonly onLibraryQueryChange: (value: string) => void;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly discoverLabel: string;
  readonly chordNotation?: ChordNotation;
  readonly onSongOpenChange?: (isOpen: boolean) => void;
  readonly onSaveSong?: (input: SaveSongInput) => Promise<SavedSong>;
  readonly onDeleteSong: (id: string) => Promise<void>;
  readonly onSwitchToDiscover: () => void;
}

function formatSourceLabel(sourceProvider: string | null): string {
  if (!sourceProvider || sourceProvider === 'local-file') {
    return cs.library.localSource;
  }
  return getProviderById(sourceProvider)?.name ?? sourceProvider;
}

function LibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label={cs.library.loading} className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="h-16 w-full rounded-2xl border border-outline-variant bg-surface-container-low motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

export function SavedSongsPanel({
  savedSongs,
  totalSavedCount,
  libraryQuery,
  onLibraryQueryChange,
  isLoading,
  error,
  discoverLabel,
  chordNotation = 'cs',
  onSongOpenChange,
  onSaveSong,
  onDeleteSong,
  onSwitchToDiscover,
}: SavedSongsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedSong = selectedSongId
    ? savedSongs.find((song) => song.id === selectedSongId) ?? null
    : null;

  useEffect(() => {
    onSongOpenChange?.(Boolean(selectedSong));
    return () => onSongOpenChange?.(false);
  }, [selectedSong, onSongOpenChange]);

  const handleSaveTransposed = async (transposedChordpro: string) => {
    if (!selectedSong || !onSaveSong) {
      return;
    }
    setIsMutating(true);
    setActionError(null);
    try {
      await onSaveSong({
        id: selectedSong.id,
        chordproContent: transposedChordpro,
        sourceProvider: selectedSong.sourceProvider,
        sourceUrl: selectedSong.sourceUrl,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : cs.preview.saveError);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedSong) {
      return;
    }
    setIsMutating(true);
    setActionError(null);
    try {
      await onDeleteSong(selectedSong.id);
      setSelectedSongId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : cs.library.deleteError);
    } finally {
      setIsMutating(false);
    }
  };

  if (selectedSong) {
    const providerLanguage = selectedSong.sourceProvider
      ? getProviderById(selectedSong.sourceProvider)?.language
      : undefined;
    const sourceNotationHint: ChordNotation = providerLanguage === 'en' ? 'intl' : 'cs';

    return (
      <SongPreview
        chordproContent={selectedSong.chordproContent}
        sourceName={formatSourceLabel(selectedSong.sourceProvider)}
        sourceUrl={selectedSong.sourceUrl}
        fallbackTitle={selectedSong.title}
        fallbackArtist={selectedSong.artist || undefined}
        isSaved
        isSaving={isMutating}
        saveError={actionError}
        chordNotation={chordNotation}
        sourceNotationHint={sourceNotationHint}
        onSaveTransposed={
          onSaveSong
            ? (updated) => {
                void handleSaveTransposed(updated);
              }
            : undefined
        }
        onDelete={() => {
          void handleDeleteSelected();
        }}
        onBack={() => {
          setActionError(null);
          setSelectedSongId(null);
        }}
      />
    );
  }

  return (
    <section className="flex w-full flex-col">
      <div className="sticky top-0 z-20 border-b border-outline-variant chrome-bar pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]">
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative flex items-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-4 h-4 w-4 text-on-surface-variant"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={libraryQuery}
              onChange={(event) => onLibraryQueryChange(event.target.value)}
              placeholder={cs.library.searchPlaceholder}
              aria-label={cs.library.searchPlaceholder}
              autoComplete="off"
              className={`min-h-12 w-full rounded-full border border-outline-variant bg-surface-container py-2.5 pl-11 text-base text-on-surface placeholder-on-surface-variant outline-none transition-colors focus:border-primary ${
                libraryQuery.length > 0 ? 'pr-12' : 'pr-4'
              }`}
            />
            {libraryQuery.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  platform.hapticTap();
                  onLibraryQueryChange('');
                  inputRef.current?.focus();
                }}
                aria-label={cs.search.clear}
                className="absolute right-0 inline-flex h-12 w-12 items-center justify-center rounded-full text-lg font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pt-4 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]">
        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-error/40 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container"
          >
            {cs.library.loadError}
          </div>
        ) : null}

        {isLoading && totalSavedCount === 0 ? (
          <LibrarySkeleton />
        ) : totalSavedCount === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-6 text-center">
            <h2 className="text-lg font-semibold text-on-surface">{cs.library.emptyTitle}</h2>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {cs.library.emptyDescription}
            </p>
            <button
              type="button"
              onClick={() => {
                platform.hapticTap();
                onSwitchToDiscover();
              }}
              className="mt-1 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-on-primary transition-transform duration-150 hover:brightness-110 active:scale-[0.98]"
            >
              {discoverLabel}
            </button>
          </div>
        ) : savedSongs.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            {cs.library.noMatches}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {savedSongs.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => {
                  platform.hapticTap();
                  setActionError(null);
                  setSelectedSongId(song.id);
                }}
                className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-left select-none transition-colors duration-150 hover:bg-surface-container active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-on-surface">{song.title}</p>
                  {song.artist ? (
                    <p className="truncate text-sm text-on-surface-variant">{song.artist}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {song.key ? (
                    <span className="rounded-lg border border-primary/35 bg-primary-container px-2 py-0.5 text-[11px] font-semibold text-on-primary-container">
                      {song.key}
                    </span>
                  ) : null}
                  <span className="rounded-lg border border-outline-variant bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
                    {formatSourceLabel(song.sourceProvider)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
