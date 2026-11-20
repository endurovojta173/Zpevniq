import { type ScrapedSong, ScraperError, type SongSearchResult } from '../../../../core/types/scraper';
import { type HttpTransport, assertSafeHttpUrl, httpGet } from '../../http';
import type { FetchSongOptions, SearchOptions, SongProvider } from '../../provider.interface';
import {
  GUITARETAB_BASE_URL,
  GUITARETAB_ID,
  GUITARETAB_NAME,
  parseSearchHtml,
  parseSongHtml,
} from './parser';

const DEFAULT_RESULT_LIMIT = 30;
const ALLOWED_HOSTS = new Set(['www.guitaretab.com', 'guitaretab.com']);

export function createGuitareTabProvider(transport?: HttpTransport): SongProvider {
  return {
    id: GUITARETAB_ID,
    name: GUITARETAB_NAME,
    baseUrl: GUITARETAB_BASE_URL,
    language: 'en',
    enabledByDefault: true,

    async search(query: string, options: SearchOptions = {}): Promise<SongSearchResult[]> {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }

      const searchUrl = `${GUITARETAB_BASE_URL}/fetch/?type=tab&query=${encodeURIComponent(trimmed)}`;
      const response = await httpGet(
        {
          url: searchUrl,
          signal: options.signal,
          providerId: GUITARETAB_ID,
        },
        transport,
      );

      const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
      return parseSearchHtml(response.body, GUITARETAB_BASE_URL).slice(0, limit);
    },

    async fetchSong(url: string, options: FetchSongOptions = {}): Promise<ScrapedSong> {
      const parsedUrl = assertSafeHttpUrl(url, GUITARETAB_ID);
      if (!ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        throw new ScraperError(
          'PARSE_ERROR',
          `URL host "${parsedUrl.hostname}" is not allowed for ${GUITARETAB_NAME}.`,
          { providerId: GUITARETAB_ID, retryable: false },
        );
      }

      const response = await httpGet(
        {
          url: parsedUrl.toString(),
          signal: options.signal,
          providerId: GUITARETAB_ID,
        },
        transport,
      );

      return parseSongHtml(response.body, response.url);
    },
  };
}

export const guitareTabProvider: SongProvider = createGuitareTabProvider();
