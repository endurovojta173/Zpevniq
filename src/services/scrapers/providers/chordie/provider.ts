import { type ScrapedSong, ScraperError, type SongSearchResult } from '../../../../core/types/scraper';
import { type HttpTransport, assertSafeHttpUrl, httpGet } from '../../http';
import type { FetchSongOptions, SearchOptions, SongProvider } from '../../provider.interface';
import {
  CHORDIE_BASE_URL,
  CHORDIE_ID,
  CHORDIE_NAME,
  parseSearchHtml,
  parseSongHtml,
} from './parser';

const DEFAULT_RESULT_LIMIT = 30;
const ALLOWED_HOSTS = new Set(['www.chordie.com', 'chordie.com']);

export function createChordieProvider(transport?: HttpTransport): SongProvider {
  return {
    id: CHORDIE_ID,
    name: CHORDIE_NAME,
    baseUrl: CHORDIE_BASE_URL,
    language: 'en',
    enabledByDefault: true,

    async search(query: string, options: SearchOptions = {}): Promise<SongSearchResult[]> {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }

      const searchUrl = `${CHORDIE_BASE_URL}/results.php?q=${encodeURIComponent(trimmed)}`;
      const response = await httpGet(
        {
          url: searchUrl,
          signal: options.signal,
          providerId: CHORDIE_ID,
        },
        transport,
      );

      const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
      return parseSearchHtml(response.body, CHORDIE_BASE_URL).slice(0, limit);
    },

    async fetchSong(url: string, options: FetchSongOptions = {}): Promise<ScrapedSong> {
      const parsedUrl = assertSafeHttpUrl(url, CHORDIE_ID);
      if (!ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        throw new ScraperError(
          'PARSE_ERROR',
          `URL host "${parsedUrl.hostname}" is not allowed for ${CHORDIE_NAME}.`,
          { providerId: CHORDIE_ID, retryable: false },
        );
      }

      const response = await httpGet(
        {
          url: parsedUrl.toString(),
          signal: options.signal,
          providerId: CHORDIE_ID,
        },
        transport,
      );

      return parseSongHtml(response.body, response.url);
    },
  };
}

export const chordieProvider: SongProvider = createChordieProvider();
