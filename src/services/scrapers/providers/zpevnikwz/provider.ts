import { type ScrapedSong, ScraperError, type SongSearchResult } from '../../../../core/types/scraper';
import { type HttpTransport, assertSafeHttpUrl, httpGet } from '../../http';
import type { FetchSongOptions, SearchOptions, SongProvider } from '../../provider.interface';
import {
  ZPEVNIKWZ_BASE_URL,
  ZPEVNIKWZ_ID,
  ZPEVNIKWZ_NAME,
  parseSearchHtml,
  parseSongHtml,
} from './parser';

const DEFAULT_RESULT_LIMIT = 40;
const ALLOWED_HOSTS = new Set(['zpevnik.wz.cz', 'www.zpevnik.wz.cz']);

export function createZpevnikWzProvider(transport?: HttpTransport): SongProvider {
  return {
    id: ZPEVNIKWZ_ID,
    name: ZPEVNIKWZ_NAME,
    baseUrl: ZPEVNIKWZ_BASE_URL,
    language: 'cs',
    enabledByDefault: true,

    async search(query: string, options: SearchOptions = {}): Promise<SongSearchResult[]> {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }

      const encodedQuery = encodeURIComponent(trimmed);
      const titleSearchUrl = `${ZPEVNIKWZ_BASE_URL}/index.php?pg=vysledky_vyhledavani&nazev=${encodedQuery}&slova=&autor=`;
      const artistSearchUrl = `${ZPEVNIKWZ_BASE_URL}/index.php?pg=vysledky_vyhledavani&nazev=&slova=&autor=${encodedQuery}`;

      const [titleOutcome, artistOutcome] = await Promise.allSettled([
        httpGet(
          {
            url: titleSearchUrl,
            signal: options.signal,
            providerId: ZPEVNIKWZ_ID,
          },
          transport,
        ),
        httpGet(
          {
            url: artistSearchUrl,
            signal: options.signal,
            providerId: ZPEVNIKWZ_ID,
          },
          transport,
        ),
      ]);

      if (titleOutcome.status === 'rejected' && artistOutcome.status === 'rejected') {
        throw titleOutcome.reason;
      }

      const merged: SongSearchResult[] = [];
      const seenUrls = new Set<string>();
      const pushUnique = (items: readonly SongSearchResult[]) => {
        for (const item of items) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            merged.push(item);
          }
        }
      };

      if (titleOutcome.status === 'fulfilled') {
        pushUnique(parseSearchHtml(titleOutcome.value.body, 'title', ZPEVNIKWZ_BASE_URL));
      }

      if (artistOutcome.status === 'fulfilled') {
        pushUnique(parseSearchHtml(artistOutcome.value.body, 'artist', ZPEVNIKWZ_BASE_URL));
      }

      const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
      return merged.slice(0, limit);
    },

    async fetchSong(url: string, options: FetchSongOptions = {}): Promise<ScrapedSong> {
      const parsedUrl = assertSafeHttpUrl(url, ZPEVNIKWZ_ID);
      if (!ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        throw new ScraperError(
          'PARSE_ERROR',
          `URL host "${parsedUrl.hostname}" is not allowed for ${ZPEVNIKWZ_NAME}.`,
          { providerId: ZPEVNIKWZ_ID, retryable: false },
        );
      }

      const response = await httpGet(
        {
          url: parsedUrl.toString(),
          signal: options.signal,
          providerId: ZPEVNIKWZ_ID,
        },
        transport,
      );

      return parseSongHtml(response.body, response.url);
    },
  };
}

export const zpevnikWzProvider: SongProvider = createZpevnikWzProvider();
