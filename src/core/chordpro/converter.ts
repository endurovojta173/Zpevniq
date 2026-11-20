import type { ChordProMetadata } from '../types/scraper';

/**
 * Matches standard Czech (H/B, Ami/Hmi) and International (B/Bb, Am/Bm) chord tokens.
 * Root note must be uppercase A-H to avoid matching lowercase lyrics words (e.g. Czech "a").
 */
const CHORD_TOKEN_REGEX =
  /^([A-H](?:[#b♯♭])?)((?:mi|min|maj|dim|aug|sus|add|m|M|[+°ø])?(?:[0-9]{1,2})?(?:(?:sus|add|maj|min|dim|aug|no)?[0-9]{1,2})?(?:[#b+-][0-9]{1,2})?(?:[#b+-])?)(?:\/([A-H](?:[#b♯♭])?))?$/;

const IGNORABLE_CHORD_LINE_TOKENS = new Set(['|', '||', '/', '-', '–', '—']);
const REPEAT_TOKEN_REGEX = /^(?:\(?\d+x\)?|\(?x\d+\)?)$/i;
const LEADING_SECTION_PREFIX_REGEX =
  /^(\s*(?:intro|outro|solo|sólo|bridge|mezihra|dohra|předehra|ref|refrén|r|sloka|\d+\.)\s*:\s*)(.*)$/i;

export interface PositionedChord {
  readonly chord: string;
  readonly column: number;
}

function stripOptionalParens(token: string): string {
  if (token.length >= 3 && token.startsWith('(') && token.endsWith(')')) {
    return token.slice(1, -1);
  }
  return token;
}

/**
 * Checks whether a single whitespace-delimited token is a valid chord symbol.
 */
export function isChordToken(rawToken: string): boolean {
  const token = stripOptionalParens(rawToken.trim());
  if (token.length === 0) {
    return false;
  }
  return CHORD_TOKEN_REGEX.test(token);
}

/**
 * Normalizes Czech minor suffix (`mi` -> `m`, e.g. `Ami` -> `Am`, `Hmi7` -> `Hm7`)
 * while preserving the original root note (`H` vs `B`) for later transposition.
 */
export function normalizeChordToken(rawToken: string): string {
  const token = stripOptionalParens(rawToken.trim());
  const match = CHORD_TOKEN_REGEX.exec(token);
  if (!match) {
    return token;
  }

  const root = match[1] ?? '';
  const rawSuffix = match[2] ?? '';
  const bass = match[3];

  const normalizedSuffix = rawSuffix.replace(/^mi(?=$|[^a-zA-Z])/, 'm');
  return bass ? `${root}${normalizedSuffix}/${bass}` : `${root}${normalizedSuffix}`;
}

function expandTabs(line: string, tabWidth = 4): string {
  if (!line.includes('\t')) {
    return line;
  }

  let output = '';
  for (const ch of line) {
    if (ch === '\t') {
      const spaces = tabWidth - (output.length % tabWidth);
      output += ' '.repeat(spaces);
    } else {
      output += ch;
    }
  }
  return output;
}

function extractChordTokens(line: string): PositionedChord[] | null {
  const expanded = expandTabs(line);
  const tokens: PositionedChord[] = [];
  let chordCount = 0;

  const regex = /\S+/g;
  let match: RegExpExecArray | null = regex.exec(expanded);
  while (match !== null) {
    const raw = match[0];
    const column = match.index;

    if (IGNORABLE_CHORD_LINE_TOKENS.has(raw) || REPEAT_TOKEN_REGEX.test(raw)) {
      match = regex.exec(expanded);
      continue;
    }

    if (!isChordToken(raw)) {
      return null;
    }

    chordCount += 1;
    tokens.push({
      chord: normalizeChordToken(raw),
      column,
    });
    match = regex.exec(expanded);
  }

  return chordCount > 0 ? tokens : null;
}

/**
 * Determines whether a line contains exclusively chord symbols (and optional bar/repeat markers).
 */
export function isChordLine(line: string): boolean {
  return extractChordTokens(line) !== null;
}

function formatStandaloneChordLine(tokens: readonly PositionedChord[]): string {
  return tokens.map((entry) => `[${entry.chord}]`).join(' ');
}

/**
 * Merges a monospaced chord line into the lyric line directly beneath it,
 * inserting `[Chord]` markers at matching character columns.
 */
export function mergeChordLineWithLyrics(chordLine: string, lyricLine: string): string {
  const positioned = extractChordTokens(chordLine);
  if (!positioned || positioned.length === 0) {
    return lyricLine.trimEnd();
  }

  const expandedLyric = expandTabs(lyricLine).trimEnd();
  if (expandedLyric.length === 0) {
    return formatStandaloneChordLine(positioned);
  }

  const inlineChords: PositionedChord[] = [];
  const trailingChords: PositionedChord[] = [];

  for (const entry of positioned) {
    if (entry.column <= expandedLyric.length) {
      inlineChords.push(entry);
    } else {
      trailingChords.push(entry);
    }
  }

  let result = '';
  let cursor = 0;

  for (const entry of inlineChords) {
    const targetCol = Math.max(cursor, Math.min(entry.column, expandedLyric.length));
    result += expandedLyric.slice(cursor, targetCol);
    result += `[${entry.chord}]`;
    cursor = targetCol;
  }

  result += expandedLyric.slice(cursor);

  if (trailingChords.length > 0) {
    const suffix = trailingChords.map((entry) => `[${entry.chord}]`).join(' ');
    result = `${result} ${suffix}`;
  }

  return result;
}

function sanitizeDirectiveValue(value: string): string {
  return value.replace(/[\r\n{}]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Builds a canonical ChordPro document with sanitized header directives.
 */
export function buildChordProDocument(
  metadata: ChordProMetadata,
  body: string,
): string {
  const directives: string[] = [];

  const title = sanitizeDirectiveValue(metadata.title);
  if (title.length > 0) {
    directives.push(`{title: ${title}}`);
  }

  if (metadata.artist !== undefined) {
    const artist = sanitizeDirectiveValue(metadata.artist);
    if (artist.length > 0) {
      directives.push(`{artist: ${artist}}`);
    }
  }

  if (metadata.key !== undefined) {
    const key = sanitizeDirectiveValue(metadata.key);
    if (key.length > 0) {
      directives.push(`{key: ${key}}`);
    }
  }

  if (metadata.capo !== undefined && Number.isInteger(metadata.capo) && metadata.capo > 0) {
    directives.push(`{capo: ${metadata.capo}}`);
  }

  const cleanBody = body.replace(/\r\n?/g, '\n').trim();
  if (directives.length === 0) {
    return cleanBody;
  }
  if (cleanBody.length === 0) {
    return directives.join('\n');
  }
  return `${directives.join('\n')}\n\n${cleanBody}`;
}

/**
 * Detects whether text is already formatted in ChordPro (directives or inline bracketed chords).
 */
export function isAlreadyChordPro(text: string): boolean {
  const hasDirective = /^\s*\{(?:title|t|artist|subtitle|st|key|capo|comment|c|soc|start_of_chorus)\b/im.test(
    text,
  );
  if (hasDirective) {
    return true;
  }

  const inlineChords = text.match(/\[([A-H][^\]\s]{0,12})\]/g);
  if (!inlineChords) {
    return false;
  }

  return inlineChords.some((match) => isChordToken(match.slice(1, -1)));
}

/**
 * Central converter from chords-over-lyrics plain text into canonical ChordPro.
 * Shared across all external scrapers and plain-text file imports.
 */
export function chordsOverLyricsToChordPro(
  rawText: string,
  metadata?: ChordProMetadata,
): string {
  const normalizedInput = rawText.replace(/\r\n?/g, '\n');
  const rawLines = normalizedInput.split('\n');
  const outputLines: string[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const currentLine = rawLines[i] ?? '';

    if (currentLine.trim().length === 0) {
      // Collapse excessive blank lines to at most one empty separator line.
      if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
        outputLines.push('');
      }
      i += 1;
      continue;
    }

    const chordTokens = extractChordTokens(currentLine);
    if (chordTokens) {
      const nextLine = rawLines[i + 1];
      const hasLyricsBelow =
        nextLine !== undefined &&
        nextLine.trim().length > 0 &&
        !isChordLine(nextLine);

      if (hasLyricsBelow) {
        outputLines.push(mergeChordLineWithLyrics(currentLine, nextLine));
        i += 2;
        continue;
      }

      outputLines.push(formatStandaloneChordLine(chordTokens));
      i += 1;
      continue;
    }

    // Handle labeled instrumental lines such as "Intro: G D Em C".
    const prefixMatch = LEADING_SECTION_PREFIX_REGEX.exec(currentLine);
    if (prefixMatch) {
      const prefix = prefixMatch[1] ?? '';
      const remainder = prefixMatch[2] ?? '';
      const remainderChords = extractChordTokens(remainder);
      if (remainderChords) {
        outputLines.push(`${prefix.trim()} ${formatStandaloneChordLine(remainderChords)}`);
        i += 1;
        continue;
      }
    }

    outputLines.push(currentLine.trimEnd());
    i += 1;
  }

  // Trim trailing empty lines.
  while (outputLines.length > 0 && outputLines[outputLines.length - 1] === '') {
    outputLines.pop();
  }

  const body = outputLines.join('\n');
  return metadata ? buildChordProDocument(metadata, body) : body;
}
