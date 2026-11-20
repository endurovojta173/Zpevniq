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

const SEARCH_DEBOUNCE_MS = 350;

export interface UseSongSearchState {
  readonly query: string;
  readonly setQuery: (value: string) => void;
  readonly results: readonly SongSearchResult[];
  readonly providerStatuses: readonly ProviderSearchStatus[];
  readonly isSearching: boolean;
  readonly hasSearched: boolean;
  readonly selectedSong: ScrapedSong | null;
  readonly isLoadingSong: boolean;
  readonly songError: ScraperError | null;
  readonly openResult: (result: SongSearchResult) => void;
  readonly clearSelectedSong: () => void;
  readonly retrySearch: () => void;
  readonly retrySelectedResult: () => void;
}

export function useSongSearch(): UseSongSearchState {
  const [query, setQuery] = useState('');
  const [searchNonce, setSearchNonce] = useState(0);
  const [results, setResults] = useState<readonly SongSearchResult[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<readonly ProviderSearchStatus[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedSong, setSelectedSong] = useState<ScrapedSong | null>(null);
  const [isLoadingSong, setIsLoadingSong] = useState(false);
  const [songError, setSongError] = useState<ScraperError | null>(null);

  const lastOpenedResultRef = useRef<SongSearchResult | null>(null);
  const songAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!platform.canScrape) {
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setProviderStatuses([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
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
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchNonce]);

  useEffect(() => {
    return () => {
      songAbortRef.current?.abort();
    };
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
    setSearchNonce((prev) => prev + 1);
  }, []);

  const retrySelectedResult = useCallback(() => {
    if (lastOpenedResultRef.current) {
      openResult(lastOpenedResultRef.current);
    }
  }, [openResult]);

  return {
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
  };
}
