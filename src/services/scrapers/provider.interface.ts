import type { ScrapedSong, SongSearchResult } from '../../core/types/scraper';

export interface SearchOptions {
  readonly signal?: AbortSignal;
  readonly limit?: number;
}

export interface FetchSongOptions {
  readonly signal?: AbortSignal;
}

export type ProviderLanguage = 'cs' | 'en' | 'multi';

/**
 * Contract that every client-side external song source adapter must implement.
 * Providers must delegate network calls to `src/services/scrapers/http.ts` and
 * keep HTML parsing in pure, deterministic functions using `DOMParser`.
 */
export interface SongProvider {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly language: ProviderLanguage;
  readonly enabledByDefault: boolean;
  search(query: string, options?: SearchOptions): Promise<SongSearchResult[]>;
  fetchSong(url: string, options?: FetchSongOptions): Promise<ScrapedSong>;
}
