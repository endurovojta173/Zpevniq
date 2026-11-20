import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ProviderSearchStatus,
  type ScrapedSong,
  ScraperError,
  type SongSearchResult,
  isScraperError,
} from '../core/types/scraper';
import { platform } from '../services/platform';
import { searchOrchestrator } from '../services/scrapers/registry';

const MIN_QUERY_LENGTH = 2;

export interface UseSongSearchState {
  readonly query: string;
  readonly setQuery: (value: string) => void;
  readonly submittedQuery: string;
  readonly canSubmit: boolean;
  readonly results: readonly SongSearchResult[];
  readonly providerStatuses: readonly ProviderSearchStatus[];
  readonly isSearching: boolean;
  readonly hasSearched: boolean;
  readonly selectedSong: ScrapedSong | null;
  readonly isLoadingSong: boolean;
  readonly songError: ScraperError | null;
  readonly submitSearch: (overrideQuery?: string) => void;
  readonly clearSearch: () => void;
  readonly openResult: (result: SongSearchResult) => void;
  readonly clearSelectedSong: () => void;
  readonly retrySearch: () => void;
  readonly retrySelectedResult: () => void;
}

export function useSongSearch(): UseSongSearchState {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<readonly SongSearchResult[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<readonly ProviderSearchStatus[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedSong, setSelectedSong] = useState<ScrapedSong | null>(null);
  const [isLoadingSong, setIsLoadingSong] = useState(false);
  const [songError, setSongError] = useState<ScraperError | null>(null);

  const lastOpenedResultRef = useRef<SongSearchResult | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const songAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      songAbortRef.current?.abort();
    };
  }, []);

  const executeSearch = useCallback((rawQuery: string) => {
    if (!platform.canScrape) {
      return;
    }

    const trimmed = rawQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSubmittedQuery(trimmed);
    setResults([]);
    setProviderStatuses([]);
    setSongError(null);
    setIsSearching(true);
    setHasSearched(true);

    void searchOrchestrator
      .searchAllProviders(trimmed, {
        signal: controller.signal,
        onUpdate: (snapshot) => {
          if (controller.signal.aborted) {
            return;
          }
          setResults(snapshot.results);
          setProviderStatuses(snapshot.providerStatuses);
          setIsSearching(!snapshot.isComplete);
        },
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });
  }, []);

  const submitSearch = useCallback(
    (overrideQuery?: string) => {
      executeSearch(overrideQuery ?? query);
    },
    [executeSearch, query],
  );

  const clearSearch = useCallback(() => {
    searchAbortRef.current?.abort();
    setQuery('');
    setSubmittedQuery('');
    setResults([]);
    setProviderStatuses([]);
    setIsSearching(false);
    setHasSearched(false);
    setSongError(null);
  }, []);

  const openResult = useCallback((result: SongSearchResult) => {
    if (!platform.canScrape) {
      return;
    }

    songAbortRef.current?.abort();
    const controller = new AbortController();
    songAbortRef.current = controller;
    lastOpenedResultRef.current = result;

    setSelectedSong(null);
    setSongError(null);
    setIsLoadingSong(true);

    void searchOrchestrator
      .fetchSong(result, { signal: controller.signal })
      .then((song) => {
        if (controller.signal.aborted) {
          return;
        }
        setSelectedSong(song);
        setIsLoadingSong(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const typedError = isScraperError(error)
          ? error
          : new ScraperError('NETWORK_ERROR', String(error), {
              providerId: result.providerId,
            });
        if (typedError.code === 'ABORTED') {
          return;
        }
        setSongError(typedError);
        setIsLoadingSong(false);
      });
  }, []);

  const clearSelectedSong = useCallback(() => {
    songAbortRef.current?.abort();
    lastOpenedResultRef.current = null;
    setSelectedSong(null);
    setSongError(null);
    setIsLoadingSong(false);
  }, []);

  const retrySearch = useCallback(() => {
    searchOrchestrator.clearCache();
    const target = query.trim().length >= MIN_QUERY_LENGTH ? query : submittedQuery;
    if (target.trim().length >= MIN_QUERY_LENGTH) {
      executeSearch(target);
    }
  }, [executeSearch, query, submittedQuery]);

  const retrySelectedResult = useCallback(() => {
    if (lastOpenedResultRef.current) {
      openResult(lastOpenedResultRef.current);
    }
  }, [openResult]);

  return {
    query,
    setQuery,
    submittedQuery,
    canSubmit: query.trim().length >= MIN_QUERY_LENGTH,
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
  };
}
