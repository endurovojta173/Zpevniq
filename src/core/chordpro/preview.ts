export interface ChordProSegment {
  readonly chord?: string;
  readonly lyric: string;
}

export type ChordProPreviewLine =
  | { readonly kind: 'empty' }
  | { readonly kind: 'comment'; readonly text: string }
  | {
      readonly kind: 'lyric';
      readonly segments: readonly ChordProSegment[];
      readonly hasChords: boolean;
    };

export interface ChordProPreview {
  readonly title?: string;
  readonly artist?: string;
  readonly key?: string;
  readonly capo?: number;
  readonly lines: readonly ChordProPreviewLine[];
}

const DIRECTIVE_REGEX = /^\s*\{([a-zA-Z_]+)(?:\s*:\s*(.*?))?\}\s*$/;
const INLINE_CHORD_REGEX = /\[([^\]]+)\]/g;

/**
 * Lightweight pure parser for previewing ChordPro documents in UI components.
 * Produces structured lines without relying on DOM APIs or innerHTML.
 */
export function parseChordProPreview(chordpro: string): ChordProPreview {
  let title: string | undefined;
  let artist: string | undefined;
  let key: string | undefined;
  let capo: number | undefined;
  const lines: ChordProPreviewLine[] = [];

  const rawLines = chordpro.replace(/\r\n?/g, '\n').split('\n');

  for (const rawLine of rawLines) {
    if (rawLine.trim().length === 0) {
      if (lines.length > 0 && lines[lines.length - 1]?.kind !== 'empty') {
        lines.push({ kind: 'empty' });
      }
      continue;
    }

    const directiveMatch = DIRECTIVE_REGEX.exec(rawLine);
    if (directiveMatch) {
      const name = (directiveMatch[1] ?? '').toLowerCase();
      const value = (directiveMatch[2] ?? '').trim();

      if ((name === 'title' || name === 't') && value) {
        title = value;
      } else if ((name === 'artist' || name === 'subtitle' || name === 'st') && value) {
        artist = value;
      } else if (name === 'key' && value) {
        key = value;
      } else if (name === 'capo' && value) {
        const parsedCapo = Number.parseInt(value, 10);
        if (!Number.isNaN(parsedCapo) && parsedCapo > 0) {
          capo = parsedCapo;
        }
      } else if ((name === 'comment' || name === 'c') && value) {
        lines.push({ kind: 'comment', text: value });
      }
      continue;
    }

    const segments: ChordProSegment[] = [];
    let hasChords = false;
    let lastIndex = 0;
    let pendingChord: string | undefined;

    INLINE_CHORD_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null = INLINE_CHORD_REGEX.exec(rawLine);

    while (match !== null) {
      const lyricBefore = rawLine.slice(lastIndex, match.index);
      if (pendingChord !== undefined || lyricBefore.length > 0) {
        segments.push(
          pendingChord !== undefined
            ? { chord: pendingChord, lyric: lyricBefore }
            : { lyric: lyricBefore },
        );
      }
      pendingChord = (match[1] ?? '').trim();
      hasChords = true;
      lastIndex = match.index + match[0].length;
      match = INLINE_CHORD_REGEX.exec(rawLine);
    }

    const remainder = rawLine.slice(lastIndex);
    if (pendingChord !== undefined || remainder.length > 0 || segments.length === 0) {
      segments.push(
        pendingChord !== undefined
          ? { chord: pendingChord, lyric: remainder }
          : { lyric: remainder },
      );
    }

    lines.push({ kind: 'lyric', segments, hasChords });
  }

  while (lines.length > 0 && lines[lines.length - 1]?.kind === 'empty') {
    lines.pop();
  }

  return {
    ...(title !== undefined ? { title } : {}),
    ...(artist !== undefined ? { artist } : {}),
    ...(key !== undefined ? { key } : {}),
    ...(capo !== undefined ? { capo } : {}),
    lines,
  };
}
