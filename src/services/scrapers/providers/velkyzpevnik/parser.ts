import {
  chordsOverLyricsToChordPro,
  normalizeChordToken,
} from '../../../../core/chordpro/converter';
import {
  type ScrapedSong,
  ScraperError,
  type SearchMatchType,
  type SongSearchResult,
} from '../../../../core/types/scraper';
import { resolveSafeUrl } from '../../http';

export const VELKYZPEVNIK_ID = 'velkyzpevnik';
export const VELKYZPEVNIK_NAME = 'Velký zpěvník';
export const VELKYZPEVNIK_BASE_URL = 'https://www.velkyzpevnik.cz';

export interface ParsedArtistLink {
  readonly name: string;
  readonly url: string;
}

export interface ParsedSearchPage {
  readonly songs: readonly SongSearchResult[];
  readonly artists: readonly ParsedArtistLink[];
}

function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function resolveMatchType(headingText: string): SearchMatchType | 'artist-section' | null {
  const normalized = headingText.toLowerCase();
  if (normalized.includes('názvu') || normalized.includes('nazvu')) {
    return 'title';
  }
  if (normalized.includes('textu')) {
    return 'lyrics';
  }
  if (normalized.includes('interpreti')) {
    return 'artist-section';
  }
  return null;
}

function findNextBoxesGrid(heading: Element): Element | null {
  let sibling = heading.nextElementSibling;
  while (sibling) {
    if (sibling.matches('h2.section-subtitle')) {
      return null;
    }
    if (sibling.classList.contains('boxes')) {
      return sibling;
    }
    sibling = sibling.nextElementSibling;
  }
  return null;
}

function extractSongBoxes(
  container: Element,
  matchType: SearchMatchType,
  baseUrl: string,
): SongSearchResult[] {
  const items: SongSearchResult[] = [];
  const boxes = container.querySelectorAll('.box');

  for (const box of boxes) {
    const titleAnchor = box.querySelector('a.title');
    if (!titleAnchor) {
      continue;
    }

    const href = titleAnchor.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanText(titleAnchor.textContent);
    if (!url || title.length === 0) {
      continue;
    }

    const artistAnchor = box.querySelector('a.interpret');
    const artist = cleanText(artistAnchor?.textContent) || 'Neznámý interpret';

    items.push({
      id: `${VELKYZPEVNIK_ID}:${url}`,
      providerId: VELKYZPEVNIK_ID,
      providerName: VELKYZPEVNIK_NAME,
      title,
      artist,
      url,
      matchType,
    });
  }

  return items;
}

function extractArtistBoxes(container: Element, baseUrl: string): ParsedArtistLink[] {
  const artists: ParsedArtistLink[] = [];
  const anchors = container.querySelectorAll('a.box');

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const name = cleanText(anchor.querySelector('.title')?.textContent ?? anchor.textContent);
    if (!url || name.length === 0) {
      continue;
    }
    artists.push({ name, url });
  }

  return artists;
}

/**
 * Pure, deterministic parser for `velkyzpevnik.cz/vyhledavani/<query>` HTML.
 */
export function parseSearchHtml(
  html: string,
  baseUrl: string = VELKYZPEVNIK_BASE_URL,
): ParsedSearchPage {
  const doc = parseHtmlDocument(html);
  const songs: SongSearchResult[] = [];
  const artists: ParsedArtistLink[] = [];

  const headings = doc.querySelectorAll('h2.section-subtitle');
  for (const heading of headings) {
    const sectionKind = resolveMatchType(cleanText(heading.textContent));
    if (!sectionKind) {
      continue;
    }

    const grid = findNextBoxesGrid(heading);
    if (!grid) {
      continue;
    }

    if (sectionKind === 'artist-section') {
      artists.push(...extractArtistBoxes(grid, baseUrl));
    } else {
      songs.push(...extractSongBoxes(grid, sectionKind, baseUrl));
    }
  }

  return { songs, artists };
}

/**
 * Pure, deterministic parser for `velkyzpevnik.cz/<artist-slug>` artist song listings.
 */
export function parseArtistSongsHtml(
  html: string,
  artistFallback = '',
  baseUrl: string = VELKYZPEVNIK_BASE_URL,
): SongSearchResult[] {
  const doc = parseHtmlDocument(html);
  const article = doc.querySelector('article.interpret') ?? doc;
  const artistName =
    cleanText(article.querySelector('h1')?.textContent) ||
    cleanText(artistFallback) ||
    'Neznámý interpret';

  const songAnchors = article.querySelectorAll('.songs a.song');
  const results: SongSearchResult[] = [];

  for (const anchor of songAnchors) {
    const href = anchor.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanText(anchor.querySelector('.song-title')?.textContent ?? anchor.textContent);

    if (!url || title.length === 0) {
      continue;
    }

    results.push({
      id: `${VELKYZPEVNIK_ID}:${url}`,
      providerId: VELKYZPEVNIK_ID,
      providerName: VELKYZPEVNIK_NAME,
      title,
      artist: artistName,
      url,
      matchType: 'artist',
    });
  }

  return results;
}

function extractOriginalKey(article: ParentNode, baseUrl: string): string | undefined {
  // Prefer the explicit `tune=` parameter on the print/transpose links.
  const tuneLinks = article.querySelectorAll('a[href*="tune="]');
  for (const link of tuneLinks) {
    const href = link.getAttribute('href');
    if (!href) {
      continue;
    }
    const resolved = resolveSafeUrl(href, baseUrl);
    if (!resolved) {
      continue;
    }
    const tune = new URL(resolved).searchParams.get('tune')?.trim();
    if (tune && tune.length > 0 && tune.length <= 8) {
      return normalizeChordToken(tune);
    }
  }

  // Fallback to the dropdown item marked with `<small class="default">(původní)</small>`.
  const defaultMarker = article.querySelector('small.default');
  const parentText = cleanText(defaultMarker?.parentElement?.textContent);
  const keyMatch = /^([A-H](?:[#b])?)(?:-(?:dur|moll)|mi|m)?\b/i.exec(parentText);
  if (keyMatch) {
    const root = keyMatch[1] ?? '';
    const isMinor = /(?:-moll|mi|m)\b/i.test(keyMatch[0]);
    return isMinor ? `${root}m` : root;
  }

  return undefined;
}

/**
 * Pure, deterministic parser for a `velkyzpevnik.cz` song detail page.
 * Extracts plain text only and converts chords-over-lyrics into canonical ChordPro.
 */
export function parseSongHtml(
  html: string,
  sourceUrl: string,
  baseUrl: string = VELKYZPEVNIK_BASE_URL,
): ScrapedSong {
  const doc = parseHtmlDocument(html);
  const article = doc.querySelector('article.song');

  if (!article) {
    throw new ScraperError('PARSE_ERROR', 'Missing <article class="song"> container.', {
      providerId: VELKYZPEVNIK_ID,
      retryable: false,
    });
  }

  const title = cleanText(article.querySelector('h1')?.textContent);
  const artist =
    cleanText(article.querySelector('h3 a')?.textContent ?? article.querySelector('h3')?.textContent) ||
    'Neznámý interpret';

  const preElement =
    article.querySelector('pre#chordbox') ??
    article.querySelector('pre.format') ??
    article.querySelector('.chordsAndLyrics pre');

  const rawBody = preElement?.textContent ?? '';
  if (title.length === 0 || rawBody.trim().length === 0) {
    throw new ScraperError(
      'PARSE_ERROR',
      'Unable to extract song title or chords/lyrics content from page.',
      {
        providerId: VELKYZPEVNIK_ID,
        retryable: false,
      },
    );
  }

  const key = extractOriginalKey(article, baseUrl);
  const chordproContent = chordsOverLyricsToChordPro(rawBody, {
    title,
    artist,
    ...(key !== undefined ? { key } : {}),
  });

  return {
    providerId: VELKYZPEVNIK_ID,
    providerName: VELKYZPEVNIK_NAME,
    sourceUrl,
    title,
    artist,
    ...(key !== undefined ? { key } : {}),
    chordproContent,
  };
}
