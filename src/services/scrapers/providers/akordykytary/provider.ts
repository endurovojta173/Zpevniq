import { type ScrapedSong, ScraperError, type SongSearchResult } from '../../../../core/types/scraper';
import { type HttpTransport, assertSafeHttpUrl, httpGet } from '../../http';
import type { FetchSongOptions, SearchOptions, SongProvider } from '../../provider.interface';
import {
  AKORDYKYTARY_BASE_URL,
  AKORDYKYTARY_ID,
  AKORDYKYTARY_NAME,
  parseSearchHtml,
  parseSongHtml,
} from './parser';

const DEFAULT_RESULT_LIMIT = 30;
const ALLOWED_HOSTS = new Set(['akordy.kytary.cz']);

export function createAkordyKytaryProvider(transport?: HttpTransport): SongProvider {
  return {
    id: AKORDYKYTARY_ID,
    name: AKORDYKYTARY_NAME,
    baseUrl: AKORDYKYTARY_BASE_URL,
    language: 'cs',
    enabledByDefault: true,

    async search(query: string, options: SearchOptions = {}): Promise<SongSearchResult[]> {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }

      const searchUrl = `${AKORDYKYTARY_BASE_URL}/songs?query=${encodeURIComponent(trimmed)}`;
      const response = await httpGet(
        {
          url: searchUrl,
          signal: options.signal,
          providerId: AKORDYKYTARY_ID,
        },
        transport,
      );

      const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
      return parseSearchHtml(response.body, AKORDYKYTARY_BASE_URL).slice(0, limit);
    },

    async fetchSong(url: string, options: FetchSongOptions = {}): Promise<ScrapedSong> {
      const parsedUrl = assertSafeHttpUrl(url, AKORDYKYTARY_ID);
      if (!ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        throw new ScraperError(
          'PARSE_ERROR',
          `URL host "${parsedUrl.hostname}" is not allowed for ${AKORDYKYTARY_NAME}.`,
          { providerId: AKORDYKYTARY_ID, retryable: false },
        );
      }

      const response = await httpGet(
        {
          url: parsedUrl.toString(),
          signal: options.signal,
          providerId: AKORDYKYTARY_ID,
        },
        transport,
      );

      return parseSongHtml(response.body, response.url);
    },
  };
}

export const akordyKytaryProvider: SongProvider = createAkordyKytaryProvider();
