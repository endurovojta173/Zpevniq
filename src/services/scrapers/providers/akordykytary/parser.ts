import {
  buildChordProDocument,
  normalizeChordToken,
} from '../../../../core/chordpro/converter';
import {
  type ScrapedSong,
  ScraperError,
  type SongSearchResult,
} from '../../../../core/types/scraper';
import { resolveSafeUrl } from '../../http';

export const AKORDYKYTARY_ID = 'akordykytary';
export const AKORDYKYTARY_NAME = 'Akordy Kytary.cz';
export const AKORDYKYTARY_BASE_URL = 'https://akordy.kytary.cz';

function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function serializeSmartChordNode(node: Node): string {
  if (node.nodeType === 3) {
    return (node.textContent ?? '').replace(/\r?\n/g, ' ');
  }

  if (node.nodeType === 1) {
    const element = node as Element;
    if (element.classList.contains('scs-chord')) {
      const rawChord = cleanText(element.textContent).replace(/\s+/g, '');
      if (rawChord.length === 0) {
        return '';
      }
      return `[${normalizeChordToken(rawChord)}]`;
    }

    let output = '';
    for (const child of Array.from(element.childNodes)) {
      output += serializeSmartChordNode(child);
    }
    return output;
  }

  return '';
}

/**
 * Pure, deterministic parser for `akordy.kytary.cz/songs?query=...` HTML.
 */
export function parseSearchHtml(
  html: string,
  baseUrl: string = AKORDYKYTARY_BASE_URL,
): SongSearchResult[] {
  const doc = parseHtmlDocument(html);
  const cards = doc.querySelectorAll('a.song-card');
  const results: SongSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const card of cards) {
    const href = card.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanText(card.querySelector('.song-card-name')?.textContent);

    if (!url || title.length === 0 || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    const artist = cleanText(card.querySelector('.song-card-author')?.textContent) || 'Neznámý interpret';
    const matchType = card.classList.contains('lyrics-hit') ? 'lyrics' : 'title';

    results.push({
      id: `${AKORDYKYTARY_ID}:${url}`,
      providerId: AKORDYKYTARY_ID,
      providerName: AKORDYKYTARY_NAME,
      title,
      artist,
      url,
      matchType,
    });
  }

  return results;
}

/**
 * Pure, deterministic parser for `akordy.kytary.cz/song/...` HTML.
 * Converts inline `.scs-chord` spans directly into canonical ChordPro.
 */
export function parseSongHtml(html: string, sourceUrl: string): ScrapedSong {
  const doc = parseHtmlDocument(html);
  const title = cleanText((doc.querySelector('h1.sheet-title') ?? doc.querySelector('h1'))?.textContent);
  const artist =
    cleanText(doc.querySelector('h2.sheet-author')?.textContent) || 'Neznámý interpret';
  const sheet = doc.querySelector('.smartchordsheet');

  if (!sheet || title.length === 0) {
    throw new ScraperError(
      'PARSE_ERROR',
      'Missing .smartchordsheet container or song title.',
      { providerId: AKORDYKYTARY_ID, retryable: false },
    );
  }

  const sectionElements = Array.from(sheet.querySelectorAll('.scs-section'));
  const targets = sectionElements.length > 0 ? sectionElements : [sheet];
  const outputSections: string[] = [];

  for (const section of targets) {
    const sectionLines: string[] = [];
    const sectionType = section.getAttribute('data-type')?.toLowerCase();
    if (sectionType === 'chorus') {
      sectionLines.push('{comment: Refrén}');
    }

    const lineDivs = Array.from(section.children).filter(
      (child) => child.tagName.toLowerCase() === 'div' && !child.id.startsWith('snippet--'),
    );
    const linesSource =
      lineDivs.length > 0
        ? lineDivs
        : Array.from(section.querySelectorAll('div')).filter(
            (div) => div.querySelector('div') === null,
          );

    for (const lineEl of linesSource) {
      let serialized = '';
      for (const child of Array.from(lineEl.childNodes)) {
        serialized += serializeSmartChordNode(child);
      }
      const trimmed = serialized.replace(/\s+$/g, '').replace(/^\s+(?=\[)/, '');
      if (trimmed.length > 0) {
        sectionLines.push(trimmed);
      }
    }

    if (sectionLines.length > 0) {
      outputSections.push(sectionLines.join('\n'));
    }
  }

  const body = outputSections.join('\n\n').trim();
  if (body.length === 0) {
    throw new ScraperError(
      'PARSE_ERROR',
      'No chord or lyric lines could be extracted from smartchordsheet.',
      { providerId: AKORDYKYTARY_ID, retryable: false },
    );
  }

  return {
    providerId: AKORDYKYTARY_ID,
    providerName: AKORDYKYTARY_NAME,
    sourceUrl,
    title,
    artist,
    chordproContent: buildChordProDocument({ title, artist }, body),
  };
}
