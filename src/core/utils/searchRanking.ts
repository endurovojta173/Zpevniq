import type { SearchMatchType, SongSearchResult } from '../types/scraper';
import { normalizeSearchText } from './normalize';

const MATCH_TYPE_BASE_SCORE: Readonly<Record<SearchMatchType, number>> = {
  title: 300,
  artist: 200,
  lyrics: 100,
};

function canonicalizeUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '').toLowerCase();
}

function scoreResult(result: SongSearchResult, normalizedQuery: string): number {
  let score = MATCH_TYPE_BASE_SCORE[result.matchType];
  if (normalizedQuery.length === 0) {
    return score;
  }

  const title = normalizeSearchText(result.title);
  const artist = normalizeSearchText(result.artist);
  const combined = `${artist} ${title}`.trim();

  if (title === normalizedQuery) {
    score += 500;
  } else if (title.startsWith(normalizedQuery)) {
    score += 320;
  } else if (title.includes(normalizedQuery)) {
    score += 180;
  }

  if (artist === normalizedQuery) {
    score += 260;
  } else if (artist.startsWith(normalizedQuery)) {
    score += 160;
  } else if (artist.includes(normalizedQuery)) {
    score += 110;
  }

  const tokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
  if (tokens.length > 1 && tokens.every((token) => combined.includes(token))) {
    score += 220;
  }

  return score;
}

/**
 * Deduplicates results within each provider (by canonical URL) and ranks across providers
 * using diacritic-insensitive matching. Same songs from different providers are intentionally
 * preserved so musicians can choose the best chord transcription.
 */
export function rankSearchResults(
  results: readonly SongSearchResult[],
  query: string,
): SongSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  const byProviderAndUrl = new Map<string, SongSearchResult>();

  for (const item of results) {
    const dedupeKey = `${item.providerId}::${canonicalizeUrl(item.url)}`;
    const existing = byProviderAndUrl.get(dedupeKey);

    if (!existing || MATCH_TYPE_BASE_SCORE[item.matchType] > MATCH_TYPE_BASE_SCORE[existing.matchType]) {
      byProviderAndUrl.set(dedupeKey, item);
    }
  }

  return [...byProviderAndUrl.values()]
    .map((item) => ({ item, score: scoreResult(item, normalizedQuery) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const titleCmp = a.item.title.localeCompare(b.item.title, 'cs');
      if (titleCmp !== 0) {
        return titleCmp;
      }
      return a.item.artist.localeCompare(b.item.artist, 'cs');
    })
    .map((entry) => entry.item);
}
