import {
  buildChordProDocument,
  chordsOverLyricsToChordPro,
  normalizeChordToken,
} from '../../../../core/chordpro/converter';
import {
  type ScrapedSong,
  ScraperError,
  type SongSearchResult,
} from '../../../../core/types/scraper';
import { resolveSafeUrl } from '../../http';

export const BRNKNI_ID = 'brnkni';
export const BRNKNI_NAME = 'Brnkni.cz';
export const BRNKNI_BASE_URL = 'https://www.brnkni.cz';

export interface ParsedBrnkniArtistLink {
  readonly name: string;
  readonly url: string;
}

function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function extractBrnkniTitle(doc: Document): string {
  const h1 = doc.querySelector('h1');
  if (!h1) {
    return '';
  }
  const clone = h1.cloneNode(true) as Element;
  for (const span of Array.from(clone.querySelectorAll('span'))) {
    span.remove();
  }
  return cleanText(clone.textContent);
}

function serializeChordPadNode(node: Node): string {
  if (node.nodeType === 3) {
    return (node.textContent ?? '').replace(/\r\n?/g, '\n');
  }

  if (node.nodeType === 1) {
    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    if (tag === 'span') {
      const rawChord = cleanText(element.textContent).replace(/\s+/g, '');
      if (rawChord.length === 0) {
        return '';
      }
      return `[${normalizeChordToken(rawChord)}]`;
    }

    if (tag === 'br') {
      return '\n';
    }

    let output = '';
    for (const child of Array.from(element.childNodes)) {
      output += serializeChordPadNode(child);
    }
    return output;
  }

  return '';
}

/**
 * Pure, deterministic parser for `brnkni.cz/hledat-pisen/?q=...` HTML.
 */
export function parseSearchSongsHtml(
  html: string,
  baseUrl: string = BRNKNI_BASE_URL,
): SongSearchResult[] {
  const doc = parseHtmlDocument(html);
  const items = doc.querySelectorAll('ul.songs li');
  const results: SongSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    const titleAnchor = item.querySelector('.about h3 a') ?? item.querySelector('h3 a');
    const href = titleAnchor?.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanText(titleAnchor?.textContent);

    if (!url || title.length === 0 || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    const artistEl = item.querySelector('.about p.author a') ?? item.querySelector('p.author');
    const rawArtist = cleanText(artistEl?.textContent).replace(/^-\s*/, '').trim();
    const artist = rawArtist.length > 0 ? rawArtist : 'Neznámý interpret';

    results.push({
      id: `${BRNKNI_ID}:${url}`,
      providerId: BRNKNI_ID,
      providerName: BRNKNI_NAME,
      title,
      artist,
      url,
      matchType: 'title',
    });
  }

  return results;
}

/**
 * Pure, deterministic parser for `brnkni.cz/hledat-interpreta/?q=...` HTML.
 */
export function parseSearchArtistsHtml(
  html: string,
  baseUrl: string = BRNKNI_BASE_URL,
): ParsedBrnkniArtistLink[] {
  const doc = parseHtmlDocument(html);
  const anchors = doc.querySelectorAll('ul.list li h2 a');
  const artists: ParsedBrnkniArtistLink[] = [];
  const seenUrls = new Set<string>();

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const name = cleanText(anchor.textContent);

    if (!url || name.length === 0 || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    artists.push({ name, url });
  }

  return artists;
}

/**
 * Pure, deterministic parser for `brnkni.cz/<letter>/<artist>/` song listings.
 */
export function parseArtistSongsHtml(
  html: string,
  artistFallback = '',
  baseUrl: string = BRNKNI_BASE_URL,
): SongSearchResult[] {
  const doc = parseHtmlDocument(html);
  const artistName =
    cleanText(doc.querySelector('h1 span')?.textContent) ||
    cleanText(artistFallback) ||
    'Neznámý interpret';

  const items = doc.querySelectorAll('ul.songs li');
  const results: SongSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    const titleAnchor = item.querySelector('.about h3 a') ?? item.querySelector('h3 a');
    const href = titleAnchor?.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanText(titleAnchor?.textContent);

    if (!url || title.length === 0 || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    results.push({
      id: `${BRNKNI_ID}:${url}`,
      providerId: BRNKNI_ID,
      providerName: BRNKNI_NAME,
      title,
      artist: artistName,
      url,
      matchType: 'artist',
    });
  }

  return results;
}

/**
 * Pure, deterministic parser for a `brnkni.cz` song detail page.
 * Supports inline `<span>` chord markers in `.chordpad` as well as plain-text lyrics fallback.
 */
export function parseSongHtml(html: string, sourceUrl: string): ScrapedSong {
  const doc = parseHtmlDocument(html);
  const title = extractBrnkniTitle(doc);
  const artist =
    cleanText(doc.querySelector('h2 a')?.textContent ?? doc.querySelector('h2')?.textContent) ||
    'Neznámý interpret';
  const container = doc.querySelector('.chordpad') ?? doc.querySelector('.lyrics');

  if (!container || title.length === 0) {
    throw new ScraperError(
      'PARSE_ERROR',
      'Missing .chordpad/.lyrics container or song title.',
      { providerId: BRNKNI_ID, retryable: false },
    );
  }

  let chordproContent: string;
  if (container.querySelector('span') !== null) {
    const body = serializeChordPadNode(container)
      .split('\n')
      .map((line) => line.replace(/\s+$/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (body.length === 0) {
      throw new ScraperError(
        'PARSE_ERROR',
        'No chord or lyric lines could be extracted from .chordpad container.',
        { providerId: BRNKNI_ID, retryable: false },
      );
    }

    chordproContent = buildChordProDocument({ title, artist }, body);
  } else {
    const rawBody = container.textContent ?? '';
    if (rawBody.trim().length === 0) {
      throw new ScraperError(
        'PARSE_ERROR',
        'Empty song body extracted from Brnkni.cz page.',
        { providerId: BRNKNI_ID, retryable: false },
      );
    }
    chordproContent = chordsOverLyricsToChordPro(rawBody, { title, artist });
  }

  return {
    providerId: BRNKNI_ID,
    providerName: BRNKNI_NAME,
    sourceUrl,
    title,
    artist,
    chordproContent,
  };
}
