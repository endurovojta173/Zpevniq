import { type ScrapedSong, ScraperError, type SongSearchResult } from '../../../../core/types/scraper';
import { type HttpTransport, assertSafeHttpUrl, httpGet } from '../../http';
import type { FetchSongOptions, SearchOptions, SongProvider } from '../../provider.interface';
import {
  VELKYZPEVNIK_BASE_URL,
  VELKYZPEVNIK_ID,
  VELKYZPEVNIK_NAME,
  parseArtistSongsHtml,
  parseSearchHtml,
  parseSongHtml,
} from './parser';

const MAX_ARTIST_EXPANSIONS = 2;
const DEFAULT_RESULT_LIMIT = 40;
const ALLOWED_HOSTS = new Set(['www.velkyzpevnik.cz', 'velkyzpevnik.cz']);

export function createVelkyZpevnikProvider(transport?: HttpTransport): SongProvider {
  return {
    id: VELKYZPEVNIK_ID,
    name: VELKYZPEVNIK_NAME,
    baseUrl: VELKYZPEVNIK_BASE_URL,
    language: 'cs',
    enabledByDefault: true,

    async search(query: string, options: SearchOptions = {}): Promise<SongSearchResult[]> {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }

      const searchUrl = `${VELKYZPEVNIK_BASE_URL}/vyhledavani/${encodeURIComponent(trimmed)}`;
      const response = await httpGet(
        {
          url: searchUrl,
          signal: options.signal,
          providerId: VELKYZPEVNIK_ID,
        },
        transport,
      );

      const parsed = parseSearchHtml(response.body, VELKYZPEVNIK_BASE_URL);
      const collected: SongSearchResult[] = [...parsed.songs];

      // When the search matches artist entries, expand the top 2 artist pages in parallel
      // so artist-name queries immediately surface playable songs.
      if (parsed.artists.length > 0 && !options.signal?.aborted) {
        const artistTargets = parsed.artists.slice(0, MAX_ARTIST_EXPANSIONS);
        const artistPages = await Promise.allSettled(
          artistTargets.map(async (artist) => {
            const artistRes = await httpGet(
              {
                url: artist.url,
                signal: options.signal,
                providerId: VELKYZPEVNIK_ID,
              },
              transport,
            );
            return parseArtistSongsHtml(artistRes.body, artist.name, VELKYZPEVNIK_BASE_URL);
          }),
        );

        for (const outcome of artistPages) {
          if (outcome.status === 'fulfilled') {
            collected.push(...outcome.value);
          }
        }
      }

      const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
      return collected.slice(0, limit);
    },

    async fetchSong(url: string, options: FetchSongOptions = {}): Promise<ScrapedSong> {
      const parsedUrl = assertSafeHttpUrl(url, VELKYZPEVNIK_ID);
      if (!ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        throw new ScraperError(
          'PARSE_ERROR',
          `URL host "${parsedUrl.hostname}" is not allowed for ${VELKYZPEVNIK_NAME}.`,
          { providerId: VELKYZPEVNIK_ID, retryable: false },
        );
      }

      const response = await httpGet(
        {
          url: parsedUrl.toString(),
          signal: options.signal,
          providerId: VELKYZPEVNIK_ID,
        },
        transport,
      );

      return parseSongHtml(response.body, response.url, VELKYZPEVNIK_BASE_URL);
    },
  };
}

export const velkyZpevnikProvider: SongProvider = createVelkyZpevnikProvider();
