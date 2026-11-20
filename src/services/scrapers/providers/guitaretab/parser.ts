import { chordsOverLyricsToChordPro } from '../../../../core/chordpro/converter';
import {
  type ScrapedSong,
  ScraperError,
  type SongSearchResult,
} from '../../../../core/types/scraper';
import { resolveSafeUrl } from '../../http';

export const GUITARETAB_ID = 'guitaretab';
export const GUITARETAB_NAME = 'GuitareTab';
export const GUITARETAB_BASE_URL = 'https://www.guitaretab.com';

function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function cleanSongTitleSuffix(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\bchords\b\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitleAndArtist(doc: Document): { title: string; artist: string } {
  const heading = doc.querySelector('h1.gt-hero__title') ?? doc.querySelector('h1');
  if (!heading) {
    return { title: '', artist: '' };
  }

  const clone = heading.cloneNode(true) as Element;
  const span = clone.querySelector('span');

  if (span) {
    const rawSpan = cleanText(span.textContent).replace(/^[–—-]\s*/, '');
    span.remove();
    const artist = cleanText(clone.textContent) || 'Unknown Artist';
    const title = cleanSongTitleSuffix(rawSpan);
    return { title, artist };
  }

  const fullText = cleanText(clone.textContent);
  const parts = fullText.split(/\s+[–—-]\s+/);
  if (parts.length >= 2) {
    const artist = cleanText(parts[0]) || 'Unknown Artist';
    const title = cleanSongTitleSuffix(parts.slice(1).join(' - '));
    return { title, artist };
  }

  return { title: cleanSongTitleSuffix(fullText), artist: 'Unknown Artist' };
}

/**
 * Pure, deterministic parser for `guitaretab.com/fetch/?type=tab&query=...` HTML.
 * Filters strictly to chord sheets (excluding pure ASCII guitar tabs).
 */
export function parseSearchHtml(
  html: string,
  baseUrl: string = GUITARETAB_BASE_URL,
): SongSearchResult[] {
  const doc = parseHtmlDocument(html);
  const rows = doc.querySelectorAll('.gt-list__row');
  const results: SongSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const row of rows) {
    const primaryLink = row.querySelector('a.gt-link--primary');
    if (!primaryLink) {
      continue;
    }

    const rawTitle = cleanText(primaryLink.textContent);
    if (!/\bchords\b/i.test(rawTitle)) {
      continue;
    }

    const href = primaryLink.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanSongTitleSuffix(rawTitle);

    if (!url || title.length === 0 || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    const secondaryLink = row.querySelector('a.gt-link--secondary');
    const artist = cleanText(secondaryLink?.textContent) || 'Unknown Artist';

    results.push({
      id: `${GUITARETAB_ID}:${url}`,
      providerId: GUITARETAB_ID,
      providerName: GUITARETAB_NAME,
      title,
      artist,
      url,
      matchType: 'title',
    });
  }

  return results;
}

/**
 * Pure, deterministic parser for `guitaretab.com/...` chord pages.
 */
export function parseSongHtml(html: string, sourceUrl: string): ScrapedSong {
  const doc = parseHtmlDocument(html);
  const { title, artist } = extractTitleAndArtist(doc);
  const pre = doc.querySelector('pre.js-tab-content') ?? doc.querySelector('pre');

  if (!pre || title.length === 0) {
    throw new ScraperError(
      'PARSE_ERROR',
      'Missing pre.js-tab-content block or song heading on GuitareTab page.',
      { providerId: GUITARETAB_ID, retryable: false },
    );
  }

  const tabRows = pre.querySelectorAll('.js-tab-row');
  const rawBody =
    tabRows.length > 0
      ? Array.from(tabRows)
          .map((row) => (row.textContent ?? '').replace(/\r?\n/g, ''))
          .join('\n')
      : (pre.textContent ?? '');

  if (rawBody.trim().length === 0) {
    throw new ScraperError('PARSE_ERROR', 'Empty song content on GuitareTab page.', {
      providerId: GUITARETAB_ID,
      retryable: false,
    });
  }

  const chordproContent = chordsOverLyricsToChordPro(rawBody, { title, artist });

  return {
    providerId: GUITARETAB_ID,
    providerName: GUITARETAB_NAME,
    sourceUrl,
    title,
    artist,
    chordproContent,
  };
}
