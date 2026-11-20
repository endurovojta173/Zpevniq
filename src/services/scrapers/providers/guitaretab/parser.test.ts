import type { HttpOptions, HttpResponse } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';
import { ScraperError } from '../../../../core/types/scraper';
import type { HttpTransport } from '../../http';
import searchResultsHtml from './__fixtures__/search-results.html?raw';
import songPageHtml from './__fixtures__/song-page.html?raw';
import {
  GUITARETAB_BASE_URL,
  GUITARETAB_ID,
  parseSearchHtml,
  parseSongHtml,
} from './parser';
import { createGuitareTabProvider } from './provider';

describe('guitaretab pure HTML parsers', () => {
  it('filters to chord entries and strips "chords" suffix from titles', () => {
    const results = parseSearchHtml(searchResultsHtml);

    expect(results).toEqual([
      {
        id: `${GUITARETAB_ID}:${GUITARETAB_BASE_URL}/t/traditional/1001.html`,
        providerId: GUITARETAB_ID,
        providerName: 'GuitareTab',
        title: 'Amazing Grace',
        artist: 'Traditional',
        url: `${GUITARETAB_BASE_URL}/t/traditional/1001.html`,
        matchType: 'title',
      },
      {
        id: `${GUITARETAB_ID}:${GUITARETAB_BASE_URL}/a/american-folk/2001.html`,
        providerId: GUITARETAB_ID,
        providerName: 'GuitareTab',
        title: 'Wayfaring Stranger (ver 2)',
        artist: 'American Folk',
        url: `${GUITARETAB_BASE_URL}/a/american-folk/2001.html`,
        matchType: 'title',
      },
    ]);
  });

  it('extracts artist/title and converts js-tab-row lines into ChordPro', () => {
    const song = parseSongHtml(
      songPageHtml,
      `${GUITARETAB_BASE_URL}/t/traditional/1001.html`,
    );

    expect(song.title).toBe('Amazing Grace');
    expect(song.artist).toBe('Traditional');
    expect(song.chordproContent).toBe(
      [
        '{title: Amazing Grace}',
        '{artist: Traditional}',
        '',
        '[C]Amazing Grace,[F] how sweet [C]the sound,',
        'That [C]saved a wretch like [G]me.[G7]',
      ].join('\n'),
    );
  });

  it('throws PARSE_ERROR when pre.js-tab-content is missing', () => {
    expect(() =>
      parseSongHtml('<html><body><h1>Empty</h1></body></html>', `${GUITARETAB_BASE_URL}/x`),
    ).toThrow(ScraperError);
  });
});

describe('guitaretab provider integration', () => {
  it('searches and fetches song detail while validating allowed host', async () => {
    const transport: HttpTransport = {
      canExecute: true,
      get: vi.fn(async (options: HttpOptions): Promise<HttpResponse> => {
        if (options.url.includes('/fetch/')) {
          return { status: 200, url: options.url, headers: {}, data: searchResultsHtml };
        }
        return { status: 200, url: options.url, headers: {}, data: songPageHtml };
      }),
    };

    const provider = createGuitareTabProvider(transport);
    const results = await provider.search('amazing grace');
    expect(results).toHaveLength(2);

    const song = await provider.fetchSong(`${GUITARETAB_BASE_URL}/t/traditional/1001.html`);
    expect(song.title).toBe('Amazing Grace');

    await expect(provider.fetchSong('https://evil.example.com/tab.html')).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
  });
});
