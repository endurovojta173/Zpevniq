import type { HttpOptions, HttpResponse } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';
import { ScraperError } from '../../../../core/types/scraper';
import type { HttpTransport } from '../../http';
import artistPageHtml from './__fixtures__/artist-page.html?raw';
import searchArtistsHtml from './__fixtures__/search-artists.html?raw';
import searchSongsHtml from './__fixtures__/search-songs.html?raw';
import songPageHtml from './__fixtures__/song-page.html?raw';
import {
  BRNKNI_BASE_URL,
  BRNKNI_ID,
  parseArtistSongsHtml,
  parseSearchArtistsHtml,
  parseSearchSongsHtml,
  parseSongHtml,
} from './parser';
import { createBrnkniProvider } from './provider';

describe('brnkni pure HTML parsers', () => {
  it('parses song search rows, strips artist dash, deduplicates, and rejects unsafe URLs', () => {
    const results = parseSearchSongsHtml(searchSongsHtml);

    expect(results).toEqual([
      {
        id: `${BRNKNI_ID}:${BRNKNI_BASE_URL}/t/taborova/okor/`,
        providerId: BRNKNI_ID,
        providerName: 'Brnkni.cz',
        title: 'Okoř',
        artist: 'Táborová',
        url: `${BRNKNI_BASE_URL}/t/taborova/okor/`,
        matchType: 'title',
      },
      {
        id: `${BRNKNI_ID}:${BRNKNI_BASE_URL}/l/lidove-pisne/skakal-pes/`,
        providerId: BRNKNI_ID,
        providerName: 'Brnkni.cz',
        title: 'Skákal pes',
        artist: 'Lidové písně',
        url: `${BRNKNI_BASE_URL}/l/lidove-pisne/skakal-pes/`,
        matchType: 'title',
      },
    ]);
  });

  it('parses artist search links and artist song listings', () => {
    const artists = parseSearchArtistsHtml(searchArtistsHtml);
    expect(artists).toEqual([
      {
        name: 'Lidové písně',
        url: `${BRNKNI_BASE_URL}/l/lidove-pisne/`,
      },
    ]);

    const artistSongs = parseArtistSongsHtml(artistPageHtml);
    expect(artistSongs).toEqual([
      {
        id: `${BRNKNI_ID}:${BRNKNI_BASE_URL}/l/lidove-pisne/pec-nam-spadla/`,
        providerId: BRNKNI_ID,
        providerName: 'Brnkni.cz',
        title: 'Pec nám spadla',
        artist: 'Lidové písně',
        url: `${BRNKNI_BASE_URL}/l/lidove-pisne/pec-nam-spadla/`,
        matchType: 'artist',
      },
      {
        id: `${BRNKNI_ID}:${BRNKNI_BASE_URL}/l/lidove-pisne/skakal-pes/`,
        providerId: BRNKNI_ID,
        providerName: 'Brnkni.cz',
        title: 'Skákal pes',
        artist: 'Lidové písně',
        url: `${BRNKNI_BASE_URL}/l/lidove-pisne/skakal-pes/`,
        matchType: 'artist',
      },
    ]);
  });

  it('converts inline .chordpad spans into canonical ChordPro and strips h1 span suffix', () => {
    const song = parseSongHtml(songPageHtml, `${BRNKNI_BASE_URL}/t/taborova/okor/`);

    expect(song.title).toBe('Okoř');
    expect(song.artist).toBe('Táborová');
    expect(song.chordproContent).toBe(
      [
        '{title: Okoř}',
        '{artist: Táborová}',
        '',
        '1. [C]Na Okoř je cesta jako žádná ze sta,',
        '[G7]roubená je stroma[C]ma.',
        '',
        'Ref: [C]Na hradě Okoři [G7]světla už nehoří,',
        '[G7]bílá paní šla už [C]spát.',
      ].join('\n'),
    );
  });

  it('supports plain-text fallback inside .lyrics and throws PARSE_ERROR when missing', () => {
    const plainHtml = `
      <html><body>
        <h1>Skákal pes <span>Akordy</span></h1>
        <h2>Lidové písně</h2>
        <div class="lyrics">C          G7
Skákal pes přes oves</div>
      </body></html>
    `;
    const fallbackSong = parseSongHtml(plainHtml, `${BRNKNI_BASE_URL}/l/lidove/skakal-pes/`);
    expect(fallbackSong.chordproContent).toContain('[C]Skákal pes');

    expect(() =>
      parseSongHtml('<html><body><h1>Test</h1></body></html>', `${BRNKNI_BASE_URL}/x/`),
    ).toThrow(ScraperError);
  });
});

describe('brnkni provider integration', () => {
  it('runs song and artist search with artist expansion, deduplicates, and validates host', async () => {
    const transport: HttpTransport = {
      canExecute: true,
      get: vi.fn(async (options: HttpOptions): Promise<HttpResponse> => {
        if (options.url.includes('/hledat-pisen/')) {
          return { status: 200, url: options.url, headers: {}, data: searchSongsHtml };
        }
        if (options.url.includes('/hledat-interpreta/')) {
          return { status: 200, url: options.url, headers: {}, data: searchArtistsHtml };
        }
        if (options.url === `${BRNKNI_BASE_URL}/l/lidove-pisne/`) {
          return { status: 200, url: options.url, headers: {}, data: artistPageHtml };
        }
        return { status: 200, url: options.url, headers: {}, data: songPageHtml };
      }),
    };

    const provider = createBrnkniProvider(transport);
    const results = await provider.search('okor');

    // Title search gave Okoř + Skákal pes; artist expansion added Pec nám spadla (Skákal pes deduplicated).
    expect(results.map((item) => item.title)).toEqual(['Okoř', 'Skákal pes', 'Pec nám spadla']);

    const song = await provider.fetchSong(`${BRNKNI_BASE_URL}/t/taborova/okor/`);
    expect(song.title).toBe('Okoř');

    await expect(provider.fetchSong('https://evil.example.com/t/taborova/okor/')).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
  });
});
