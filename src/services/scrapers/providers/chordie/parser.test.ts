import type { HttpOptions, HttpResponse } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';
import { ScraperError } from '../../../../core/types/scraper';
import type { HttpTransport } from '../../http';
import searchResultsHtml from './__fixtures__/search-results.html?raw';
import songPageHtml from './__fixtures__/song-page.html?raw';
import {
  CHORDIE_BASE_URL,
  CHORDIE_ID,
  parseSearchHtml,
  parseSongHtml,
} from './parser';
import { createChordieProvider } from './provider';

describe('chordie pure HTML parsers', () => {
  it('parses search links, deduplicates snippet duplicates, and drops unsafe URLs', () => {
    const results = parseSearchHtml(searchResultsHtml);

    expect(results).toEqual([
      {
        id: `${CHORDIE_ID}:${CHORDIE_BASE_URL}/chord.pere/www.example.com/a/amazing-grace.html`,
        providerId: CHORDIE_ID,
        providerName: 'Chordie',
        title: 'Amazing Grace',
        artist: 'Traditional',
        url: `${CHORDIE_BASE_URL}/chord.pere/www.example.com/a/amazing-grace.html`,
        matchType: 'title',
      },
      {
        id: `${CHORDIE_ID}:${CHORDIE_BASE_URL}/chord.pere/www.example.com/w/wayfaring-stranger.html`,
        providerId: CHORDIE_ID,
        providerName: 'Chordie',
        title: 'Wayfaring Stranger',
        artist: 'American Folk',
        url: `${CHORDIE_BASE_URL}/chord.pere/www.example.com/w/wayfaring-stranger.html`,
        matchType: 'title',
      },
    ]);
  });

  it('normalizes inline Chordie {t}/{st} directives and preserves ChordPro body', () => {
    const song = parseSongHtml(
      songPageHtml,
      `${CHORDIE_BASE_URL}/chord.pere/www.example.com/a/amazing-grace.html`,
    );

    expect(song.title).toBe('Amazing Grace');
    expect(song.artist).toBe('Traditional');
    expect(song.key).toBe('G');
    expect(song.chordproContent).toBe(
      [
        '{title: Amazing Grace}',
        '{artist: Traditional}',
        '{key: G}',
        '',
        '[G]Amazing [G7]Grace, how [C]sweet the [G]sound,',
        'That saved a [Em]wretch like [D]me.',
      ].join('\n'),
    );
  });

  it('throws PARSE_ERROR when textarea#chordproContent is missing', () => {
    expect(() =>
      parseSongHtml('<html><body><h1>Empty</h1></body></html>', `${CHORDIE_BASE_URL}/chord.pere/x`),
    ).toThrow(ScraperError);
  });
});

describe('chordie provider integration', () => {
  it('searches and fetches song detail while validating allowed host', async () => {
    const transport: HttpTransport = {
      canExecute: true,
      get: vi.fn(async (options: HttpOptions): Promise<HttpResponse> => {
        if (options.url.includes('/results.php')) {
          return { status: 200, url: options.url, headers: {}, data: searchResultsHtml };
        }
        return { status: 200, url: options.url, headers: {}, data: songPageHtml };
      }),
    };

    const provider = createChordieProvider(transport);
    const results = await provider.search('amazing grace');
    expect(results).toHaveLength(2);

    const song = await provider.fetchSong(
      `${CHORDIE_BASE_URL}/chord.pere/www.example.com/a/amazing-grace.html`,
    );
    expect(song.title).toBe('Amazing Grace');

    await expect(provider.fetchSong('https://evil.example.com/song')).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
  });
});
