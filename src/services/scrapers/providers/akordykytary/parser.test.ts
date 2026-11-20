import type { HttpOptions, HttpResponse } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';
import { ScraperError } from '../../../../core/types/scraper';
import type { HttpTransport } from '../../http';
import searchResultsHtml from './__fixtures__/search-results.html?raw';
import songPageHtml from './__fixtures__/song-page.html?raw';
import {
  AKORDYKYTARY_BASE_URL,
  AKORDYKYTARY_ID,
  parseSearchHtml,
  parseSongHtml,
} from './parser';
import { createAkordyKytaryProvider } from './provider';

describe('akordykytary pure HTML parsers', () => {
  it('parses title and lyrics-hit song cards while rejecting unsafe URLs', () => {
    const results = parseSearchHtml(searchResultsHtml);

    expect(results).toEqual([
      {
        id: `${AKORDYKYTARY_ID}:${AKORDYKYTARY_BASE_URL}/song/okor`,
        providerId: AKORDYKYTARY_ID,
        providerName: 'Akordy Kytary.cz',
        title: 'Okoř',
        artist: 'Táborová',
        url: `${AKORDYKYTARY_BASE_URL}/song/okor`,
        matchType: 'title',
      },
      {
        id: `${AKORDYKYTARY_ID}:${AKORDYKYTARY_BASE_URL}/song/skakal-pes`,
        providerId: AKORDYKYTARY_ID,
        providerName: 'Akordy Kytary.cz',
        title: 'Skákal pes (v2)',
        artist: 'Lidové písně',
        url: `${AKORDYKYTARY_BASE_URL}/song/skakal-pes`,
        matchType: 'lyrics',
      },
    ]);
  });

  it('converts smartchordsheet inline chords and chorus sections to ChordPro', () => {
    const song = parseSongHtml(songPageHtml, `${AKORDYKYTARY_BASE_URL}/song/okor`);

    expect(song.title).toBe('Okoř');
    expect(song.artist).toBe('Táborová');
    expect(song.chordproContent).toBe(
      [
        '{title: Okoř}',
        '{artist: Táborová}',
        '',
        '[C]Na Okoř je cesta jako žádná ze sta,',
        '[G7]roubená je stroma[C]ma.',
        '',
        '{comment: Refrén}',
        '[C]Na hradě Okoři [G7]světla už nehoří,',
      ].join('\n'),
    );
  });

  it('throws PARSE_ERROR when smartchordsheet container is missing', () => {
    expect(() =>
      parseSongHtml('<html><body><h1 class="sheet-title">Test</h1></body></html>', `${AKORDYKYTARY_BASE_URL}/song/x`),
    ).toThrow(ScraperError);
  });
});

describe('akordykytary provider integration', () => {
  it('searches and fetches song detail while validating allowed host', async () => {
    const transport: HttpTransport = {
      canExecute: true,
      get: vi.fn(async (options: HttpOptions): Promise<HttpResponse> => {
        if (options.url.includes('/songs?query=')) {
          return { status: 200, url: options.url, headers: {}, data: searchResultsHtml };
        }
        return { status: 200, url: options.url, headers: {}, data: songPageHtml };
      }),
    };

    const provider = createAkordyKytaryProvider(transport);
    const results = await provider.search('okor');
    expect(results).toHaveLength(2);

    const song = await provider.fetchSong(`${AKORDYKYTARY_BASE_URL}/song/okor`);
    expect(song.title).toBe('Okoř');

    await expect(provider.fetchSong('https://evil.example.com/song/okor')).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
  });
});
