import type { HttpOptions, HttpResponse } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';
import { ScraperError } from '../../../../core/types/scraper';
import type { HttpTransport } from '../../http';
import searchResultsHtml from './__fixtures__/search-results.html?raw';
import songPageHtml from './__fixtures__/song-page.html?raw';
import {
  ZPEVNIKWZ_BASE_URL,
  ZPEVNIKWZ_ID,
  parseSearchHtml,
  parseSongHtml,
} from './parser';
import { createZpevnikWzProvider } from './provider';

describe('zpevnikwz pure HTML parsers', () => {
  it('parses search rows, requires valid id query param, deduplicates, and rejects unsafe URLs', () => {
    const results = parseSearchHtml(searchResultsHtml, 'title');

    expect(results).toEqual([
      {
        id: `${ZPEVNIKWZ_ID}:${ZPEVNIKWZ_BASE_URL}/?id=1001`,
        providerId: ZPEVNIKWZ_ID,
        providerName: 'Zpěvník.wz.cz',
        title: 'Okoř',
        artist: 'Táborová',
        url: `${ZPEVNIKWZ_BASE_URL}/?id=1001`,
        matchType: 'title',
      },
      {
        id: `${ZPEVNIKWZ_ID}:${ZPEVNIKWZ_BASE_URL}/?id=1002`,
        providerId: ZPEVNIKWZ_ID,
        providerName: 'Zpěvník.wz.cz',
        title: 'Skákal pes',
        artist: 'Lidové písně',
        url: `${ZPEVNIKWZ_BASE_URL}/?id=1002`,
        matchType: 'title',
      },
    ]);
  });

  it('extracts title/artist from h1 and converts .song chords-over-lyrics into ChordPro', () => {
    const song = parseSongHtml(songPageHtml, `${ZPEVNIKWZ_BASE_URL}/?id=1001`);

    expect(song.title).toBe('Okoř');
    expect(song.artist).toBe('Táborová');
    expect(song.chordproContent).toContain('{title: Okoř}');
    expect(song.chordproContent).toContain('{artist: Táborová}');
    expect(song.chordproContent).toContain('[C]Na Okoř je cesta');
    expect(song.chordproContent).toContain('[Gm]světla už nehoří');
  });

  it('throws PARSE_ERROR when .song container is missing', () => {
    expect(() =>
      parseSongHtml('<html><body><div id="middle"><h1>Test</h1></div></body></html>', `${ZPEVNIKWZ_BASE_URL}/?id=999`),
    ).toThrow(ScraperError);
  });
});

describe('zpevnikwz provider integration', () => {
  it('runs title and artist search in parallel, prioritizes title matchType, and validates host', async () => {
    const artistOnlyHtml = `
      <div id="middle">
        <div class="songy">
          <ul class="seznam">
            <li><a href="?id=1001">Okoř</a> (<a href="?id_a=42">Táborová</a>)</li>
            <li><a href="?id=1003">Pec nám spadla</a> (<a href="?id_a=43">Lidové písně</a>)</li>
          </ul>
        </div>
      </div>
    `;

    const transport: HttpTransport = {
      canExecute: true,
      get: vi.fn(async (options: HttpOptions): Promise<HttpResponse> => {
        if (options.url.includes('nazev=okor')) {
          return { status: 200, url: options.url, headers: {}, data: searchResultsHtml };
        }
        if (options.url.includes('autor=okor')) {
          return { status: 200, url: options.url, headers: {}, data: artistOnlyHtml };
        }
        return { status: 200, url: options.url, headers: {}, data: songPageHtml };
      }),
    };

    const provider = createZpevnikWzProvider(transport);
    const results = await provider.search('okor');

    expect(results).toHaveLength(3);
    expect(results.map((item) => [item.title, item.matchType])).toEqual([
      ['Okoř', 'title'],
      ['Skákal pes', 'title'],
      ['Pec nám spadla', 'artist'],
    ]);

    const song = await provider.fetchSong(`${ZPEVNIKWZ_BASE_URL}/?id=1001`);
    expect(song.title).toBe('Okoř');

    await expect(provider.fetchSong('https://evil.example.com/?id=1001')).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
  });
});
