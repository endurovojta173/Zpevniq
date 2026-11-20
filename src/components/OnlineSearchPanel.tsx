import { type FormEvent, useEffect, useRef, useState } from 'react';
import type {
  ProviderSearchStatus,
  ScraperErrorCode,
  SongSearchResult,
} from '../core/types/scraper';
import type { SaveSongInput, SavedSong } from '../core/types/song';
import { useSongSearch } from '../hooks/useSongSearch';
import cs from '../i18n/cs.json';
import { platform } from '../services/platform';
import { SongPreview } from './SongPreview';

export interface OnlineSearchPanelProps {
  readonly findSavedSong: (sourceUrl?: string | null, id?: string | null) => SavedSong | undefined;
  readonly isStageMode?: boolean;
  readonly onToggleStageMode?: () => void;
  readonly onSongOpenChange?: (isOpen: boolean) => void;
  readonly onSaveSong: (input: SaveSongInput) => Promise<SavedSong>;
  readonly onDeleteSong: (id: string) => Promise<void>;
}

function getErrorMessage(code: ScraperErrorCode): string {
  return cs.search.errors[code];
}

function ProviderStatusPill({ status }: { readonly status: ProviderSearchStatus }) {
  if (status.status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3 py-1 text-xs text-on-surface-variant">
        <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
        {status.providerName}: {cs.search.providerStatus.loading}
      </span>
    );
  }

  if (status.status === 'error') {
    return (
      <span
        title={getErrorMessage(status.error.code)}
        className="inline-flex items-center gap-1.5 rounded-full border border-error/40 bg-error-container px-3 py-1 text-xs text-on-error-container"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-error" />
        {status.providerName}: {getErrorMessage(status.error.code)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-container px-3 py-1 text-xs text-on-success-container tabular-nums">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
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
      onClick={() => {
        platform.hapticTap();
        onSelect(result);
      }}
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-left select-none transition-colors duration-150 hover:bg-surface-container active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-on-surface">{result.title}</p>
          {isSaved ? (
            <span className="shrink-0 rounded-full border border-success/40 bg-success-container px-2 py-0.5 text-[10px] font-semibold text-on-success-container">
              {cs.search.savedBadge}
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm text-on-surface-variant">{result.artist}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-lg border border-outline-variant bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
          {result.providerName}
        </span>
        <span className="text-[11px] text-on-surface-variant">
          {cs.search.matchType[result.matchType]}
        </span>
      </div>
    </button>
  );
}

function SearchResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label={cs.search.searching} className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((idx) => (
        <div
          key={idx}
          className="h-16 w-full rounded-2xl border border-outline-variant bg-surface-container-low motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

export function OnlineSearchPanel({
  findSavedSong,
  isStageMode = false,
  onToggleStageMode,
  onSongOpenChange,
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

  useEffect(() => {
    onSongOpenChange?.(Boolean(selectedSong));
    return () => onSongOpenChange?.(false);
  }, [selectedSong, onSongOpenChange]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    platform.hapticTap();
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
        sourceUrl={selectedSong.sourceUrl}
        fallbackTitle={selectedSong.title}
        fallbackArtist={selectedSong.artist}
        isSaved={Boolean(savedMatch)}
        isSaving={isSaving}
        saveError={saveError}
        isStageMode={isStageMode}
        onToggleStageMode={onToggleStageMode}
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
      <div className="sticky top-0 z-20 border-b border-outline-variant chrome-bar pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]">
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
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={cs.search.placeholder}
              aria-label={cs.search.placeholder}
              autoComplete="off"
              className={`min-h-12 w-full rounded-full border border-outline-variant bg-surface-container py-2.5 pl-11 text-base text-on-surface placeholder-on-surface-variant outline-none transition-colors focus:border-primary ${
                query.length > 0 ? 'pr-12' : 'pr-4'
              }`}
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  platform.hapticTap();
                  clearSearch();
                  inputRef.current?.focus();
                }}
                aria-label={cs.search.clear}
                className="absolute right-0 inline-flex h-12 w-12 items-center justify-center rounded-full text-lg font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                ×
              </button>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="min-h-12 shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition-transform duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-on-surface-variant"
          >
            {cs.search.submit}
          </button>
        </form>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pt-4 pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)]">
        {providerStatuses.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {providerStatuses.map((status) => (
              <ProviderStatusPill key={status.providerId} status={status} />
            ))}
            {hasAnyError && !isSearching ? (
              <button
                type="button"
                onClick={() => {
                  platform.hapticTap();
                  retrySearch();
                }}
                className="inline-flex min-h-12 items-center rounded-full border border-outline-variant bg-surface-container px-4 text-xs font-medium text-on-surface hover:bg-surface-container-high"
              >
                {cs.search.retry}
              </button>
            ) : null}
          </div>
        ) : null}

        {isLoadingSong ? (
          <div
            role="status"
            className="rounded-2xl border border-primary/35 bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container"
          >
            {cs.search.loadingSong}
          </div>
        ) : null}

        {songError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-error/40 bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            <span>{getErrorMessage(songError.code)}</span>
            {songError.retryable ? (
              <button
                type="button"
                onClick={() => {
                  platform.hapticTap();
                  retrySelectedResult();
                }}
                className="inline-flex min-h-12 shrink-0 items-center rounded-xl border border-error/40 bg-surface-container-low px-4 text-xs font-semibold text-on-surface hover:bg-surface-container"
              >
                {cs.search.retry}
              </button>
            ) : null}
          </div>
        ) : null}

        {!hasSearched ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            {cs.search.submitHint}
          </p>
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
          <SearchResultsSkeleton />
        ) : (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            {cs.search.noResults}
          </p>
        )}
      </div>
    </section>
  );
}
