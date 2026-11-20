import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SaveSongInput, SavedSong } from '../core/types/song';
import { songRepository } from '../db/repository';

export interface UseSavedSongsState {
  readonly savedSongs: readonly SavedSong[];
  readonly totalSavedCount: number;
  readonly libraryQuery: string;
  readonly setLibraryQuery: (value: string) => void;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly savedSourceUrls: ReadonlySet<string>;
  readonly findSavedSong: (sourceUrl?: string | null, id?: string | null) => SavedSong | undefined;
  readonly saveSong: (input: SaveSongInput) => Promise<SavedSong>;
  readonly deleteSong: (id: string) => Promise<void>;
  readonly refresh: () => Promise<void>;
}

export function useSavedSongs(): UseSavedSongsState {
  const [allSongs, setAllSongs] = useState<readonly SavedSong[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<readonly SavedSong[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const searchSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const songs = await songRepository.list();
      setAllSongs(songs);
      setError(null);
      setRefreshNonce((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    songRepository
      .list()
      .then((songs) => {
        if (!active) {
          return;
        }
        setAllSongs(songs);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = libraryQuery.trim();
    if (trimmed.length === 0) {
      setFilteredSongs(allSongs);
      return;
    }

    const seq = searchSequenceRef.current + 1;
    searchSequenceRef.current = seq;

    let active = true;
    songRepository
      .search(trimmed)
      .then((matches) => {
        if (!active || searchSequenceRef.current !== seq) {
          return;
        }
        setFilteredSongs(matches);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active || searchSequenceRef.current !== seq) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      active = false;
    };
  }, [libraryQuery, allSongs, refreshNonce]);

  const savedByUrl = useMemo(() => {
    const map = new Map<string, SavedSong>();
    for (const song of allSongs) {
      if (song.sourceUrl) {
        map.set(song.sourceUrl, song);
      }
    }
    return map;
  }, [allSongs]);

  const savedById = useMemo(() => {
    const map = new Map<string, SavedSong>();
    for (const song of allSongs) {
      map.set(song.id, song);
    }
    return map;
  }, [allSongs]);

  const savedSourceUrls = useMemo(() => new Set(savedByUrl.keys()), [savedByUrl]);

  const findSavedSong = useCallback(
    (sourceUrl?: string | null, id?: string | null): SavedSong | undefined => {
      if (id) {
        const byId = savedById.get(id);
        if (byId) {
          return byId;
        }
      }
      const trimmedUrl = sourceUrl?.trim();
      if (trimmedUrl) {
        return savedByUrl.get(trimmedUrl);
      }
      return undefined;
    },
    [savedById, savedByUrl],
  );

  const saveSong = useCallback(
    async (input: SaveSongInput): Promise<SavedSong> => {
      const saved = await songRepository.save(input);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const deleteSong = useCallback(
    async (id: string): Promise<void> => {
      await songRepository.softDelete(id);
      await refresh();
    },
    [refresh],
  );

  return {
    savedSongs: libraryQuery.trim().length === 0 ? allSongs : filteredSongs,
    totalSavedCount: allSongs.length,
    libraryQuery,
    setLibraryQuery,
    isLoading,
    error,
    savedSourceUrls,
    findSavedSong,
    saveSong,
    deleteSong,
    refresh,
  };
}
