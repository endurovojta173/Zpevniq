import {
  buildChordProDocument,
  chordsOverLyricsToChordPro,
  isAlreadyChordPro,
} from '../../../../core/chordpro/converter';
import { parseChordProPreview } from '../../../../core/chordpro/preview';
import {
  type ScrapedSong,
  ScraperError,
  type SongSearchResult,
} from '../../../../core/types/scraper';
import { resolveSafeUrl } from '../../http';

export const CHORDIE_ID = 'chordie';
export const CHORDIE_NAME = 'Chordie';
export const CHORDIE_BASE_URL = 'https://www.chordie.com';

function cleanText(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function parseHtmlDocument(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function extractHeadingFallback(doc: Document): { title: string; artist: string } {
  const heading = doc.querySelector('h1.titleLeft') ?? doc.querySelector('h1');
  if (!heading) {
    return { title: '', artist: '' };
  }

  const clone = heading.cloneNode(true) as Element;
  const artistAnchor = clone.querySelector('a');
  const artist = cleanText(artistAnchor?.textContent);
  artistAnchor?.remove();
  const title = cleanText(clone.textContent);

  return { title, artist };
}

/**
 * Pure, deterministic parser for `chordie.com/results.php?q=...` HTML.
 */
export function parseSearchHtml(
  html: string,
  baseUrl: string = CHORDIE_BASE_URL,
): SongSearchResult[] {
  const doc = parseHtmlDocument(html);
  const anchors = doc.querySelectorAll('a[href*="/chord.pere/"]');
  const results: SongSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const anchor of anchors) {
    const spans = anchor.querySelectorAll('span');
    if (spans.length === 0) {
      // Chordie renders a second plain-text snippet anchor with the same href; skip it.
      continue;
    }

    const href = anchor.getAttribute('href');
    const url = href ? resolveSafeUrl(href, baseUrl) : null;
    const title = cleanText(spans[0]?.textContent);
    if (!url || title.length === 0 || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    const artist = cleanText(spans[1]?.textContent) || 'Unknown Artist';

    results.push({
      id: `${CHORDIE_ID}:${url}`,
      providerId: CHORDIE_ID,
      providerName: CHORDIE_NAME,
      title,
      artist,
      url,
      matchType: 'title',
    });
  }

  return results;
}

/**
 * Pure, deterministic parser for `chordie.com/chord.pere/...` song detail pages.
 */
export function parseSongHtml(html: string, sourceUrl: string): ScrapedSong {
  const doc = parseHtmlDocument(html);
  const textarea =
    doc.querySelector('textarea#chordproContent') ??
    doc.querySelector('textarea[name="chopro"]');

  const rawTextarea = (textarea?.textContent ?? '').replace(/\r\n?/g, '\n');
  if (rawTextarea.trim().length === 0) {
    throw new ScraperError(
      'PARSE_ERROR',
      'Missing #chordproContent textarea on Chordie page.',
      { providerId: CHORDIE_ID, retryable: false },
    );
  }

  // Chordie occasionally puts multiple directives on one line (e.g. `{t:...} {st:...}`).
  const expandedDirectives = rawTextarea.replace(/\}\s*\{/g, '}\n{');
  const parsedMeta = parseChordProPreview(expandedDirectives);
  const headingFallback = extractHeadingFallback(doc);

  const title = parsedMeta.title?.trim() || headingFallback.title;
  const artist = parsedMeta.artist?.trim() || headingFallback.artist || 'Unknown Artist';

  if (title.length === 0) {
    throw new ScraperError('PARSE_ERROR', 'Unable to determine song title.', {
      providerId: CHORDIE_ID,
      retryable: false,
    });
  }

  const strippedBody = expandedDirectives
    .replace(/\{(?:t|title|st|subtitle|artist|key|capo)\s*:[^}]*\}/gi, '')
    .trim();

  const metadata = {
    title,
    artist,
    ...(parsedMeta.key !== undefined ? { key: parsedMeta.key } : {}),
    ...(parsedMeta.capo !== undefined ? { capo: parsedMeta.capo } : {}),
  };

  let chordproContent: string;
  if (isAlreadyChordPro(strippedBody)) {
    const cleanBody = strippedBody
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    chordproContent = buildChordProDocument(metadata, cleanBody);
  } else {
    chordproContent = chordsOverLyricsToChordPro(strippedBody, metadata);
  }

  return {
    providerId: CHORDIE_ID,
    providerName: CHORDIE_NAME,
    sourceUrl,
    title,
    artist,
    ...(parsedMeta.key !== undefined ? { key: parsedMeta.key } : {}),
    ...(parsedMeta.capo !== undefined ? { capo: parsedMeta.capo } : {}),
    chordproContent,
  };
}
