import type {
  ProviderSearchStatus,
  ScraperErrorCode,
  SongSearchResult,
} from '../core/types/scraper';
import { useSongSearch } from '../hooks/useSongSearch';
import cs from '../i18n/cs.json';
import { SongPreview } from './SongPreview';

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
  onSelect,
}: {
  readonly result: SongSearchResult;
  readonly onSelect: (item: SongSearchResult) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 px-4 py-3 text-left transition hover:border-neutral-700 hover:bg-neutral-900 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-100">{result.title}</p>
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

export function OnlineSearchPanel() {
  const {
    query,
    setQuery,
    results,
    providerStatuses,
    isSearching,
    hasSearched,
    selectedSong,
    isLoadingSong,
    songError,
    openResult,
    clearSelectedSong,
    retrySearch,
    retrySelectedResult,
  } = useSongSearch();

  if (selectedSong) {
    return (
      <SongPreview
        chordproContent={selectedSong.chordproContent}
        sourceName={selectedSong.providerName}
        fallbackTitle={selectedSong.title}
        fallbackArtist={selectedSong.artist}
        onBack={clearSelectedSong}
      />
    );
  }

  const hasAnyError = providerStatuses.some((item) => item.status === 'error');

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4">
      <div className="relative flex items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={cs.search.placeholder}
          aria-label={cs.search.placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 pr-20 text-base text-white placeholder-neutral-500 outline-none focus:border-amber-500"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            {cs.search.clear}
          </button>
        ) : null}
      </div>

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
        <p className="py-6 text-center text-sm text-neutral-500">{cs.search.minCharsHint}</p>
      ) : results.length > 0 ? (
        <div className="flex flex-col gap-2">
          {results.map((item) => (
            <SearchResultRow key={item.id} result={item} onSelect={openResult} />
          ))}
        </div>
      ) : isSearching ? (
        <p className="py-6 text-center text-sm text-neutral-400">{cs.search.searching}</p>
      ) : (
        <p className="py-6 text-center text-sm text-neutral-500">{cs.search.noResults}</p>
      )}
    </section>
  );
}
