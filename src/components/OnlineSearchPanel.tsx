import { type FormEvent, useRef, useState } from 'react';
import type {
  ProviderSearchStatus,
  ScraperErrorCode,
  SongSearchResult,
} from '../core/types/scraper';
import type { SaveSongInput, SavedSong } from '../core/types/song';
import { useSongSearch } from '../hooks/useSongSearch';
import cs from '../i18n/cs.json';
import { SongPreview } from './SongPreview';

export interface OnlineSearchPanelProps {
  readonly findSavedSong: (sourceUrl?: string | null, id?: string | null) => SavedSong | undefined;
  readonly onSaveSong: (input: SaveSongInput) => Promise<SavedSong>;
  readonly onDeleteSong: (id: string) => Promise<void>;
}

function getErrorMessage(code: ScraperErrorCode): string {
  return cs.search.errors[code];
}

function ProviderStatusPill({ status }: { readonly status: ProviderSearchStatus }) {
  if (status.status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        {status.providerName}: {cs.search.providerStatus.loading}
      </span>
    );
  }

  if (status.status === 'error') {
    return (
      <span
        title={getErrorMessage(status.error.code)}
        className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs text-red-300"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        {status.providerName}: {getErrorMessage(status.error.code)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {status.providerName}: {status.resultCount} {cs.search.providerStatus.resultsSuffix}
    </span>
  );
}

function SearchResultRow({
  result,
  isSaved,
  onSelect,
}: {
  readonly result: SongSearchResult;
  readonly isSaved: boolean;
  readonly onSelect: (item: SongSearchResult) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 px-4 py-3 text-left transition hover:border-neutral-700 hover:bg-neutral-900 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-neutral-100">{result.title}</p>
          {isSaved ? (
            <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              {cs.search.savedBadge}
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm text-neutral-400">{result.artist}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
          {result.providerName}
        </span>
        <span className="text-[11px] text-neutral-500">
          {cs.search.matchType[result.matchType]}
        </span>
      </div>
    </button>
  );
}

export function OnlineSearchPanel({
  findSavedSong,
  onSaveSong,
  onDeleteSong,
}: OnlineSearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    query,
    setQuery,
    canSubmit,
    results,
    providerStatuses,
    isSearching,
    hasSearched,
    selectedSong,
    isLoadingSong,
    songError,
    submitSearch,
    clearSearch,
    openResult,
    clearSelectedSong,
    retrySearch,
    retrySelectedResult,
  } = useSongSearch();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    inputRef.current?.blur();
    submitSearch();
  };

  if (selectedSong) {
    const savedMatch = findSavedSong(selectedSong.sourceUrl);

    const handleSave = async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await onSaveSong({
          chordproContent: selectedSong.chordproContent,
          sourceProvider: selectedSong.providerId,
          sourceUrl: selectedSong.sourceUrl,
        });
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : cs.preview.saveError);
      } finally {
        setIsSaving(false);
      }
    };

    const handleDelete = savedMatch
      ? async () => {
          setIsSaving(true);
          setSaveError(null);
          try {
            await onDeleteSong(savedMatch.id);
          } catch (err) {
            setSaveError(err instanceof Error ? err.message : cs.preview.saveError);
          } finally {
            setIsSaving(false);
          }
        }
      : undefined;

    return (
      <SongPreview
        chordproContent={selectedSong.chordproContent}
        sourceName={selectedSong.providerName}
        fallbackTitle={selectedSong.title}
        fallbackArtist={selectedSong.artist}
        isSaved={Boolean(savedMatch)}
        isSaving={isSaving}
        saveError={saveError}
        onSave={() => {
          void handleSave();
        }}
        onDelete={
          handleDelete
            ? () => {
                void handleDelete();
              }
            : undefined
        }
        onBack={() => {
          setSaveError(null);
          clearSelectedSong();
        }}
      />
    );
  }

  const hasAnyError = providerStatuses.some((item) => item.status === 'error');

  return (
    <section className="flex w-full flex-col">
      <div
        className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/95 px-4 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-2xl items-stretch gap-2"
        >
          <div className="relative flex flex-1 items-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3.5 h-4 w-4 text-neutral-500"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={cs.search.placeholder}
              aria-label={cs.search.placeholder}
              autoComplete="off"
              className={`w-full rounded-xl border border-neutral-700 bg-neutral-900 py-2.5 pl-10 text-base text-white placeholder-neutral-500 outline-none focus:border-amber-500 ${
                query.length > 0 ? 'pr-10' : 'pr-4'
              }`}
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                  inputRef.current?.focus();
                }}
                aria-label={cs.search.clear}
                className="absolute right-2 rounded-lg px-2 py-1 text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              >
                ×
              </button>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {cs.search.submit}
          </button>
        </form>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-4">
        {providerStatuses.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {providerStatuses.map((status) => (
              <ProviderStatusPill key={status.providerId} status={status} />
            ))}
            {hasAnyError && !isSearching ? (
              <button
                type="button"
                onClick={retrySearch}
                className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
              >
                {cs.search.retry}
              </button>
            ) : null}
          </div>
        ) : null}

        {isLoadingSong ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {cs.search.loadingSong}
          </div>
        ) : null}

        {songError ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <span>{getErrorMessage(songError.code)}</span>
            {songError.retryable ? (
              <button
                type="button"
                onClick={retrySelectedResult}
                className="shrink-0 rounded-lg border border-red-400/40 px-3 py-1 text-xs font-medium text-red-100 hover:bg-red-500/20"
              >
                {cs.search.retry}
              </button>
            ) : null}
          </div>
        ) : null}

        {!hasSearched ? (
          <p className="py-10 text-center text-sm text-neutral-500">{cs.search.submitHint}</p>
        ) : results.length > 0 ? (
          <div className="flex flex-col gap-2">
            {results.map((item) => (
              <SearchResultRow
                key={item.id}
                result={item}
                isSaved={Boolean(findSavedSong(item.url))}
                onSelect={(selected) => {
                  setSaveError(null);
                  openResult(selected);
                }}
              />
            ))}
          </div>
        ) : isSearching ? (
          <p className="py-10 text-center text-sm text-neutral-400">{cs.search.searching}</p>
        ) : (
          <p className="py-10 text-center text-sm text-neutral-500">{cs.search.noResults}</p>
        )}
      </div>
    </section>
  );
}
