import { type ScrapedSong, ScraperError, type SongSearchResult } from '../../../../core/types/scraper';
import { type HttpTransport, assertSafeHttpUrl, httpGet } from '../../http';
import type { FetchSongOptions, SearchOptions, SongProvider } from '../../provider.interface';
import {
  BRNKNI_BASE_URL,
  BRNKNI_ID,
  BRNKNI_NAME,
  parseArtistSongsHtml,
  parseSearchArtistsHtml,
  parseSearchSongsHtml,
  parseSongHtml,
} from './parser';

const MAX_ARTIST_EXPANSIONS = 2;
const DEFAULT_RESULT_LIMIT = 40;
const ALLOWED_HOSTS = new Set(['www.brnkni.cz', 'brnkni.cz']);

export function createBrnkniProvider(transport?: HttpTransport): SongProvider {
  return {
    id: BRNKNI_ID,
    name: BRNKNI_NAME,
    baseUrl: BRNKNI_BASE_URL,
    language: 'cs',
    enabledByDefault: true,

    async search(query: string, options: SearchOptions = {}): Promise<SongSearchResult[]> {
      const trimmed = query.trim();
      if (trimmed.length === 0) {
        return [];
      }

      const encodedQuery = encodeURIComponent(trimmed);
      const songSearchUrl = `${BRNKNI_BASE_URL}/hledat-pisen/?q=${encodedQuery}`;
      const artistSearchUrl = `${BRNKNI_BASE_URL}/hledat-interpreta/?q=${encodedQuery}`;

      const [songOutcome, artistOutcome] = await Promise.allSettled([
        httpGet(
          {
            url: songSearchUrl,
            signal: options.signal,
            providerId: BRNKNI_ID,
          },
          transport,
        ),
        httpGet(
          {
            url: artistSearchUrl,
            signal: options.signal,
            providerId: BRNKNI_ID,
          },
          transport,
        ),
      ]);

      if (songOutcome.status === 'rejected' && artistOutcome.status === 'rejected') {
        throw songOutcome.reason;
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

      if (songOutcome.status === 'fulfilled') {
        pushUnique(parseSearchSongsHtml(songOutcome.value.body, BRNKNI_BASE_URL));
      }

      if (artistOutcome.status === 'fulfilled' && !options.signal?.aborted) {
        const artists = parseSearchArtistsHtml(artistOutcome.value.body, BRNKNI_BASE_URL);
        if (artists.length > 0) {
          const artistTargets = artists.slice(0, MAX_ARTIST_EXPANSIONS);
          const artistPages = await Promise.allSettled(
            artistTargets.map(async (artist) => {
              const artistRes = await httpGet(
                {
                  url: artist.url,
                  signal: options.signal,
                  providerId: BRNKNI_ID,
                },
                transport,
              );
              return parseArtistSongsHtml(artistRes.body, artist.name, BRNKNI_BASE_URL);
            }),
          );

          for (const pageOutcome of artistPages) {
            if (pageOutcome.status === 'fulfilled') {
              pushUnique(pageOutcome.value);
            }
          }
        }
      }

      const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
      return merged.slice(0, limit);
    },

    async fetchSong(url: string, options: FetchSongOptions = {}): Promise<ScrapedSong> {
      const parsedUrl = assertSafeHttpUrl(url, BRNKNI_ID);
      if (!ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        throw new ScraperError(
          'PARSE_ERROR',
          `URL host "${parsedUrl.hostname}" is not allowed for ${BRNKNI_NAME}.`,
          { providerId: BRNKNI_ID, retryable: false },
        );
      }

      const response = await httpGet(
        {
          url: parsedUrl.toString(),
          signal: options.signal,
          providerId: BRNKNI_ID,
        },
        transport,
      );

      return parseSongHtml(response.body, response.url);
    },
  };
}

export const brnkniProvider: SongProvider = createBrnkniProvider();
