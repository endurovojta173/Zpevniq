import { describe, expect, it } from 'vitest';
import type { SongSearchResult } from '../types/scraper';
import { rankSearchResults } from './searchRanking';

function makeResult(overrides: Partial<SongSearchResult>): SongSearchResult {
  return {
    id: overrides.id ?? 'p1:url',
    providerId: overrides.providerId ?? 'velkyzpevnik',
    providerName: overrides.providerName ?? 'Velký zpěvník',
    title: overrides.title ?? 'Okoř',
    artist: overrides.artist ?? 'Lidové písně',
    url: overrides.url ?? 'https://www.velkyzpevnik.cz/lidove-pisne/okor',
    matchType: overrides.matchType ?? 'title',
  };
}

describe('rankSearchResults', () => {
  it('ranks exact diacritic-insensitive title matches above lyrics and partial matches', () => {
    const ranked = rankSearchResults(
      [
        makeResult({
          id: '1',
          title: 'Cesta kolem',
          url: 'https://example.cz/cesta',
          matchType: 'lyrics',
        }),
        makeResult({
          id: '2',
          title: 'Okoř (parodie)',
          url: 'https://example.cz/okor-parodie',
          matchType: 'title',
        }),
        makeResult({
          id: '3',
          title: 'Okoř',
          url: 'https://example.cz/okor',
          matchType: 'title',
        }),
      ],
      'okor',
    );

    expect(ranked.map((r) => r.id)).toEqual(['3', '2', '1']);
  });

  it('deduplicates identical URLs within the same provider keeping highest matchType', () => {
    const ranked = rankSearchResults(
      [
        makeResult({
          id: 'lyrics-hit',
          url: 'https://example.cz/okor/',
          matchType: 'lyrics',
        }),
        makeResult({
          id: 'title-hit',
          url: 'https://example.cz/okor',
          matchType: 'title',
        }),
      ],
      'okor',
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.matchType).toBe('title');
  });

  it('preserves same song from different providers so musicians can compare chord sources', () => {
    const ranked = rankSearchResults(
      [
        makeResult({
          id: 'p1:okor',
          providerId: 'provider-a',
          providerName: 'Provider A',
          url: 'https://a.example.cz/okor',
        }),
        makeResult({
          id: 'p2:okor',
          providerId: 'provider-b',
          providerName: 'Provider B',
          url: 'https://b.example.cz/okor',
        }),
      ],
      'okor',
    );

    expect(ranked).toHaveLength(2);
  });
});
