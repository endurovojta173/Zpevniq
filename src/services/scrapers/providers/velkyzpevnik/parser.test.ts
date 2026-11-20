import type { HttpOptions, HttpResponse } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';
import { ScraperError } from '../../../../core/types/scraper';
import type { HttpTransport } from '../../http';
import artistPageHtml from './__fixtures__/artist-page.html?raw';
import searchResultsHtml from './__fixtures__/search-results.html?raw';
import songPageHtml from './__fixtures__/song-page.html?raw';
import {
  VELKYZPEVNIK_BASE_URL,
  VELKYZPEVNIK_ID,
  parseArtistSongsHtml,
  parseSearchHtml,
  parseSongHtml,
} from './parser';
import { createVelkyZpevnikProvider } from './provider';

describe('velkyzpevnik pure HTML parsers', () => {
  it('parses title matches, lyrics matches, artist links, and drops unsafe URLs', () => {
    const parsed = parseSearchHtml(searchResultsHtml);

    expect(parsed.songs).toEqual([
      {
        id: `${VELKYZPEVNIK_ID}:${VELKYZPEVNIK_BASE_URL}/lidove-pisne/okor`,
        providerId: VELKYZPEVNIK_ID,
        providerName: 'Velký zpěvník',
        title: 'Okoř',
        artist: 'Lidové písně',
        url: `${VELKYZPEVNIK_BASE_URL}/lidove-pisne/okor`,
        matchType: 'title',
      },
      {
        id: `${VELKYZPEVNIK_ID}:${VELKYZPEVNIK_BASE_URL}/lidove-pisne/skakal-pes`,
        providerId: VELKYZPEVNIK_ID,
        providerName: 'Velký zpěvník',
        title: 'Skákal pes',
        artist: 'Lidové písně',
        url: `${VELKYZPEVNIK_BASE_URL}/lidove-pisne/skakal-pes`,
        matchType: 'title',
      },
      {
        id: `${VELKYZPEVNIK_ID}:${VELKYZPEVNIK_BASE_URL}/lidove-pisne/holka-modrooka`,
        providerId: VELKYZPEVNIK_ID,
        providerName: 'Velký zpěvník',
        title: 'Holka modrooká',
        artist: 'Lidové písně',
        url: `${VELKYZPEVNIK_BASE_URL}/lidove-pisne/holka-modrooka`,
        matchType: 'lyrics',
      },
    ]);

    expect(parsed.artists).toEqual([
      {
        name: 'Lidové písně',
        url: `${VELKYZPEVNIK_BASE_URL}/lidove-pisne`,
      },
    ]);
  });

  it('parses artist song listings cleanly', () => {
    const songs = parseArtistSongsHtml(artistPageHtml);

    expect(songs).toHaveLength(2);
    expect(songs[0]).toMatchObject({
      title: 'Pec nám spadla',
      artist: 'Lidové písně',
      url: `${VELKYZPEVNIK_BASE_URL}/lidove-pisne/pec-nam-spadla`,
      matchType: 'artist',
    });
  });

  it('extracts song metadata, original key, and converts chords-over-lyrics into ChordPro', () => {
    const song = parseSongHtml(
      songPageHtml,
      `${VELKYZPEVNIK_BASE_URL}/lidove-pisne/skakal-pes`,
    );

    expect(song.title).toBe('Skákal pes');
    expect(song.artist).toBe('Lidové písně');
    expect(song.key).toBe('G');
    expect(song.chordproContent).toBe(
      [
        '{title: Skákal pes}',
        '{artist: Lidové písně}',
        '{key: G}',
        '',
        '[G]Skákal pes [D]přes oves,',
        '[D7]přes zelenou [G]louku,',
        '[Am]šel za ním [D7]myslivec,',
        '[G]péro na [D7]klobou[G]ku.',
      ].join('\n'),
    );
  });

  it('throws PARSE_ERROR when the song container or chords block is missing', () => {
    expect(() =>
      parseSongHtml('<html><body><div>Empty</div></body></html>', `${VELKYZPEVNIK_BASE_URL}/x`),
    ).toThrow(ScraperError);

    try {
      parseSongHtml(
        '<article class="song"><h1>Bez textu</h1></article>',
        `${VELKYZPEVNIK_BASE_URL}/x`,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ScraperError);
      expect((error as ScraperError).code).toBe('PARSE_ERROR');
    }
  });
});

describe('velkyzpevnik provider integration', () => {
  it('expands matched artist pages during search and fetches song detail', async () => {
    const getMock = vi.fn(async (options: HttpOptions): Promise<HttpResponse> => {
      if (options.url.includes('/vyhledavani/')) {
        return { status: 200, url: options.url, headers: {}, data: searchResultsHtml };
      }
      if (options.url.endsWith('/lidove-pisne')) {
        return { status: 200, url: options.url, headers: {}, data: artistPageHtml };
      }
      if (options.url.endsWith('/lidove-pisne/skakal-pes')) {
        return { status: 200, url: options.url, headers: {}, data: songPageHtml };
      }
      return { status: 404, url: options.url, headers: {}, data: '' };
    });

    const transport: HttpTransport = {
      canExecute: true,
      get: getMock,
    };

    const provider = createVelkyZpevnikProvider(transport);
    const results = await provider.search('lidove');

    expect(results.map((r) => r.title)).toEqual([
      'Okoř',
      'Skákal pes',
      'Holka modrooká',
      'Pec nám spadla',
      'Kočka leze dírou',
    ]);

    const song = await provider.fetchSong(`${VELKYZPEVNIK_BASE_URL}/lidove-pisne/skakal-pes`);
    expect(song.title).toBe('Skákal pes');
    expect(song.chordproContent).toContain('{key: G}');
  });

  it('rejects fetchSong URLs pointing outside velkyzpevnik.cz', async () => {
    const transport: HttpTransport = {
      canExecute: true,
      get: vi.fn(),
    };
    const provider = createVelkyZpevnikProvider(transport);

    await expect(provider.fetchSong('https://evil.example.com/song')).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
    expect(transport.get).not.toHaveBeenCalled();
  });
});
