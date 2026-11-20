import { chordsOverLyricsToChordPro } from '../../../../core/chordpro/converter';
import {
  type ScrapedSong,
  ScraperError,
  type SearchMatchType,
  type SongSearchResult,
} from '../../../../core/types/scraper';
import { resolveSafeUrl } from '../../http';

export const ZPEVNIKWZ_ID = 'zpevnikwz';
export const ZPEVNIKWZ_NAME = 'Zpěvník.wz.cz';
export const ZPEVNIKWZ_BASE_URL = 'https://zpevnik.wz.cz';

function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function hasValidSongIdParam(url: string): boolean {
  try {
    const songId = new URL(url).searchParams.get('id')?.trim();
    return Boolean(songId && songId.length > 0);
  } catch {
    return false;
  }
}

function extractSongTitle(heading: Element): string {
  const clone = heading.cloneNode(true) as Element;
  for (const anchor of Array.from(clone.querySelectorAll('a'))) {
    anchor.remove();
  }
  const withoutEmptyParens = (clone.textContent ?? '').replace(/\s*\(\s*\)\s*$/, '');
  return cleanText(withoutEmptyParens);
}

/**
 * Pure, deterministic parser for `zpevnik.wz.cz/index.php?pg=vysledky_vyhledavani...` HTML.
 */
export function parseSearchHtml(
  html: string,
  matchType: SearchMatchType = 'title',
  baseUrl: string = ZPEVNIKWZ_BASE_URL,
): SongSearchResult[] {
  const doc = parseHtmlDocument(html);
  const items = doc.querySelectorAll('.songy ul.seznam li, #middle ul.seznam li');
  const results: SongSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    const anchors = Array.from(item.querySelectorAll('a'));
    const songAnchor = anchors[0];
    const artistAnchor = anchors[1];
    if (!songAnchor) {
      continue;
    }

    const href = songAnchor.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanText(songAnchor.textContent);

    if (!url || !hasValidSongIdParam(url) || title.length === 0 || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    const artist = cleanText(artistAnchor?.textContent) || 'Neznámý interpret';

    results.push({
      id: `${ZPEVNIKWZ_ID}:${url}`,
      providerId: ZPEVNIKWZ_ID,
      providerName: ZPEVNIKWZ_NAME,
      title,
      artist,
      url,
      matchType,
    });
  }

  return results;
}

/**
 * Pure, deterministic parser for a `zpevnik.wz.cz/?id=<id>` song detail page.
 * Converts chords-over-lyrics inside `.song` into canonical ChordPro.
 */
export function parseSongHtml(html: string, sourceUrl: string): ScrapedSong {
  const doc = parseHtmlDocument(html);
  const heading = doc.querySelector('#middle h1') ?? doc.querySelector('h1');
  const songContainer = doc.querySelector('#middle .song') ?? doc.querySelector('div.song');

  if (!heading || !songContainer) {
    throw new ScraperError(
      'PARSE_ERROR',
      'Missing song heading or .song container on Zpěvník.wz.cz page.',
      { providerId: ZPEVNIKWZ_ID, retryable: false },
    );
  }

  const artist =
    cleanText(heading.querySelector('a')?.textContent) ||
    cleanText(doc.querySelector('.pisen_links a[href*="id_a="]')?.textContent) ||
    'Neznámý interpret';
  const title = extractSongTitle(heading);
  const rawBody = songContainer.textContent ?? '';

  if (title.length === 0 || rawBody.trim().length === 0) {
    throw new ScraperError(
      'PARSE_ERROR',
      'Unable to extract song title or chords/lyrics content from Zpěvník.wz.cz page.',
      { providerId: ZPEVNIKWZ_ID, retryable: false },
    );
  }

  const chordproContent = chordsOverLyricsToChordPro(rawBody, { title, artist });

  return {
    providerId: ZPEVNIKWZ_ID,
    providerName: ZPEVNIKWZ_NAME,
    sourceUrl,
    title,
    artist,
    chordproContent,
  };
}
