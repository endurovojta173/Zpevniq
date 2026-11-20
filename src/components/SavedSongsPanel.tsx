import { useRef, useState } from 'react';
import type { SavedSong } from '../core/types/song';
import cs from '../i18n/cs.json';
import { SongPreview } from './SongPreview';

export interface SavedSongsPanelProps {
  readonly savedSongs: readonly SavedSong[];
  readonly totalSavedCount: number;
  readonly libraryQuery: string;
  readonly onLibraryQueryChange: (value: string) => void;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly discoverLabel: string;
  readonly onDeleteSong: (id: string) => Promise<void>;
  readonly onSwitchToDiscover: () => void;
}

const PROVIDER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  velkyzpevnik: 'Velký zpěvník',
  'local-file': cs.library.localSource,
};

function formatSourceLabel(sourceProvider: string | null): string {
  if (!sourceProvider) {
    return cs.library.localSource;
  }
  return PROVIDER_DISPLAY_NAMES[sourceProvider] ?? sourceProvider;
}

export function SavedSongsPanel({
  savedSongs,
  totalSavedCount,
  libraryQuery,
  onLibraryQueryChange,
  isLoading,
  error,
  discoverLabel,
  onDeleteSong,
  onSwitchToDiscover,
}: SavedSongsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectedSong = selectedSongId
    ? savedSongs.find((song) => song.id === selectedSongId) ?? null
    : null;

  const handleDeleteSelected = async () => {
    if (!selectedSong) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteSong(selectedSong.id);
      setSelectedSongId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : cs.library.deleteError);
    } finally {
      setIsDeleting(false);
    }
  };

  if (selectedSong) {
    return (
      <SongPreview
        chordproContent={selectedSong.chordproContent}
        sourceName={formatSourceLabel(selectedSong.sourceProvider)}
        fallbackTitle={selectedSong.title}
        fallbackArtist={selectedSong.artist || undefined}
        isSaved
        isSaving={isDeleting}
        saveError={deleteError}
        onDelete={() => {
          void handleDeleteSelected();
        }}
        onBack={() => {
          setDeleteError(null);
          setSelectedSongId(null);
        }}
      />
    );
  }

  if (isLoading && totalSavedCount === 0) {
    return (
      <section className="flex w-full max-w-2xl flex-col items-center py-10 text-sm text-neutral-400">
        {cs.library.loading}
      </section>
    );
  }

  if (totalSavedCount === 0) {
    return (
      <section className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-center">
        <h2 className="text-lg font-semibold text-white">{cs.library.emptyTitle}</h2>
        <p className="text-sm leading-relaxed text-neutral-400">{cs.library.emptyDescription}</p>
        {error ? <p className="text-xs text-red-400">{cs.library.loadError}</p> : null}
        <button
          type="button"
          onClick={onSwitchToDiscover}
          className="mt-1 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400"
        >
          {discoverLabel}
        </button>
      </section>
    );
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          value={libraryQuery}
          onChange={(event) => onLibraryQueryChange(event.target.value)}
          placeholder={cs.library.searchPlaceholder}
          aria-label={cs.library.searchPlaceholder}
          autoComplete="off"
          className={`w-full rounded-xl border border-neutral-700 bg-neutral-900 py-3 pl-4 text-base text-white placeholder-neutral-500 outline-none focus:border-amber-500 ${
            libraryQuery.length > 0 ? 'pr-10' : 'pr-4'
          }`}
        />
        {libraryQuery.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              onLibraryQueryChange('');
              inputRef.current?.focus();
            }}
            aria-label={cs.search.clear}
            className="absolute right-2 rounded-lg px-2 py-1 text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            ×
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {cs.library.loadError}
        </div>
      ) : null}

      {savedSongs.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">{cs.library.noMatches}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {savedSongs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => {
                setDeleteError(null);
                setSelectedSongId(song.id);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 px-4 py-3 text-left transition hover:border-neutral-700 hover:bg-neutral-900 active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-neutral-100">{song.title}</p>
                {song.artist ? (
                  <p className="truncate text-sm text-neutral-400">{song.artist}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {song.key ? (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    {song.key}
                  </span>
                ) : null}
                <span className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                  {formatSourceLabel(song.sourceProvider)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
