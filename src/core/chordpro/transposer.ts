import type { ChordProPreview, ChordProPreviewLine } from './preview';
import { parseChordProPreview } from './preview';

export type ChordNotation = 'cs' | 'intl';
export type AccidentalPreference = 'auto' | 'sharp' | 'flat';
export type SpellStyle = 'sharp' | 'flat' | 'neutral';

export interface TransposeOptions {
  readonly semitones: number;
  readonly targetNotation: ChordNotation;
  readonly sourceNotation?: ChordNotation;
  readonly sourceNotationHint?: ChordNotation;
  readonly accidentalPreference?: AccidentalPreference;
  readonly capo?: number;
}

export interface TransposeChordContext {
  readonly sourceNotation: ChordNotation;
  readonly targetNotation: ChordNotation;
  readonly spellStyle: SpellStyle;
}

const CHORD_TOKEN_REGEX =
  /^([A-H](?:[#b♯♭])?)((?:mi|min|maj|dim|aug|sus|add|m|M|[+°ø])?(?:[0-9]{1,2})?(?:(?:sus|add|maj|min|dim|aug|no)?[0-9]{1,2})?(?:[#b+-][0-9]{1,2})?(?:[#b+-])?)(?:\/([A-H](?:[#b♯♭])?))?$/;

const KEY_WORD_REGEX = /^([A-H](?:[#b♯♭])?)\s*-?\s*(dur|moll|mi|min|m)?$/i;
const DIRECTIVE_REGEX = /^\s*\{([a-zA-Z_]+)(?:\s*:\s*(.*?))?\}\s*$/;
const INLINE_CHORD_REGEX = /\[([^\]]+)\]/g;

const SHARP_CS: readonly string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
const FLAT_CS: readonly string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'B', 'H'];
const NEUTRAL_CS: readonly string[] = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B', 'H'];

const SHARP_INTL: readonly string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_INTL: readonly string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NEUTRAL_INTL: readonly string[] = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1]);
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3]);
const SHARP_MAJOR_TONICS = new Set([7, 2, 9, 4, 11, 6]);
const SHARP_MINOR_TONICS = new Set([4, 11, 6, 1, 8, 3]);

const CS_FLAT_CONTEXT_ROOTS = new Set(['F', 'Eb', 'Ab', 'Db']);
const CS_FLAT_MINOR_ROOTS = new Set(['D', 'G', 'C', 'F']);
const INTL_SHARP_CONTEXT_ROOTS = new Set(['E', 'F#', 'C#', 'G#', 'D#']);

function normalizeAccidentals(note: string): string {
  return note.replace(/♯/g, '#').replace(/♭/g, 'b');
}

function wrapSemitone(value: number): number {
  return ((value % 12) + 12) % 12;
}

function noteToSemitone(rawNote: string, sourceNotation: ChordNotation): number | null {
  const note = normalizeAccidentals(rawNote.trim());
  switch (note) {
    case 'C':
    case 'B#':
    case 'H#':
      return 0;
    case 'C#':
    case 'Db':
      return 1;
    case 'D':
      return 2;
    case 'D#':
    case 'Eb':
      return 3;
    case 'E':
    case 'Fb':
      return 4;
    case 'F':
    case 'E#':
      return 5;
    case 'F#':
    case 'Gb':
      return 6;
    case 'G':
      return 7;
    case 'G#':
    case 'Ab':
      return 8;
    case 'A':
      return 9;
    case 'A#':
    case 'Bb':
    case 'Hb':
      return 10;
    case 'H':
    case 'Cb':
      return 11;
    case 'B':
      return sourceNotation === 'cs' ? 10 : 11;
    default:
      return null;
  }
}

function formatSemitoneNote(
  semitone: number,
  targetNotation: ChordNotation,
  spellStyle: SpellStyle,
): string {
  const index = wrapSemitone(semitone);
  if (targetNotation === 'cs') {
    if (spellStyle === 'sharp') {
      return SHARP_CS[index] ?? 'C';
    }
    if (spellStyle === 'flat') {
      return FLAT_CS[index] ?? 'C';
    }
    return NEUTRAL_CS[index] ?? 'C';
  }

  if (spellStyle === 'sharp') {
    return SHARP_INTL[index] ?? 'C';
  }
  if (spellStyle === 'flat') {
    return FLAT_INTL[index] ?? 'C';
  }
  return NEUTRAL_INTL[index] ?? 'C';
}

function isMinorQuality(suffix: string): boolean {
  return /^(?:mi|min|m)(?![a-zA-Z])/i.test(suffix.trim());
}

function normalizeSuffix(suffix: string): string {
  return suffix.replace(/^mi(?=$|[^a-zA-Z])/, 'm');
}

function stripParens(token: string): { readonly inner: string; readonly hasParens: boolean } {
  const trimmed = token.trim();
  if (trimmed.length >= 3 && trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return { inner: trimmed.slice(1, -1).trim(), hasParens: true };
  }
  return { inner: trimmed, hasParens: false };
}

function parseChordParts(rawToken: string): {
  readonly root: string;
  readonly suffix: string;
  readonly bass?: string;
  readonly hasParens: boolean;
} | null {
  const { inner, hasParens } = stripParens(rawToken);
  const match = CHORD_TOKEN_REGEX.exec(inner);
  if (!match) {
    return null;
  }

  const root = normalizeAccidentals(match[1] ?? '');
  const suffix = match[2] ?? '';
  const bass = match[3] ? normalizeAccidentals(match[3]) : undefined;
  return {
    root,
    suffix,
    ...(bass !== undefined ? { bass } : {}),
    hasParens,
  };
}

/**
 * Infers whether a chord list uses Czech (`H`/`B`) or International (`B`/`Bb`) notation.
 */
export function detectSourceNotation(
  chords: readonly string[],
  hint: ChordNotation = 'cs',
): ChordNotation {
  let hasBareB = false;
  let csScore = 0;
  let intlScore = 0;

  for (const rawChord of chords) {
    const parsed = parseChordParts(rawChord);
    if (!parsed) {
      continue;
    }

    const rootsToCheck = parsed.bass ? [parsed.root, parsed.bass] : [parsed.root];
    for (const note of rootsToCheck) {
      if (note.startsWith('H')) {
        return 'cs';
      }
      if (note === 'Bb') {
        return 'intl';
      }
      if (note === 'B') {
        hasBareB = true;
      }
    }

    if (
      CS_FLAT_CONTEXT_ROOTS.has(parsed.root) ||
      (isMinorQuality(parsed.suffix) && CS_FLAT_MINOR_ROOTS.has(parsed.root))
    ) {
      csScore += 1;
    }
    if (INTL_SHARP_CONTEXT_ROOTS.has(parsed.root)) {
      intlScore += 1;
    }
  }

  if (!hasBareB) {
    return hint;
  }
  if (csScore > intlScore) {
    return 'cs';
  }
  if (intlScore > csScore) {
    return 'intl';
  }
  return hint;
}

function resolveSpellStyle(
  chords: readonly string[],
  semitones: number,
  sourceNotation: ChordNotation,
  accidentalPreference: AccidentalPreference = 'auto',
): SpellStyle {
  if (accidentalPreference === 'sharp') {
    return 'sharp';
  }
  if (accidentalPreference === 'flat') {
    return 'flat';
  }

  for (const rawChord of chords) {
    const parsed = parseChordParts(rawChord);
    if (parsed) {
      const tonic = noteToSemitone(parsed.root, sourceNotation);
      if (tonic === null) {
        continue;
      }
      const targetTonic = wrapSemitone(tonic + semitones);
      const minor = isMinorQuality(parsed.suffix);

      if (minor) {
        if (FLAT_MINOR_TONICS.has(targetTonic)) {
          return 'flat';
        }
        if (SHARP_MINOR_TONICS.has(targetTonic)) {
          return 'sharp';
        }
        return 'neutral';
      }

      if (FLAT_MAJOR_TONICS.has(targetTonic)) {
        return 'flat';
      }
      if (SHARP_MAJOR_TONICS.has(targetTonic)) {
        return 'sharp';
      }
      return 'neutral';
    }

    const keyMatch = KEY_WORD_REGEX.exec(rawChord.trim());
    if (keyMatch) {
      const tonic = noteToSemitone(keyMatch[1] ?? '', sourceNotation);
      if (tonic === null) {
        continue;
      }
      const targetTonic = wrapSemitone(tonic + semitones);
      const minor = isMinorQuality(keyMatch[2] ?? '');
      if (minor) {
        if (FLAT_MINOR_TONICS.has(targetTonic)) {
          return 'flat';
        }
        if (SHARP_MINOR_TONICS.has(targetTonic)) {
          return 'sharp';
        }
        return 'neutral';
      }
      if (FLAT_MAJOR_TONICS.has(targetTonic)) {
        return 'flat';
      }
      if (SHARP_MAJOR_TONICS.has(targetTonic)) {
        return 'sharp';
      }
      return 'neutral';
    }
  }

  return 'neutral';
}

/**
 * Transposes a single chord token (including slash bass and optional parentheses)
 * while converting between Czech (`H`/`B`) and International (`B`/`Bb`) notation.
 * Non-chord markers such as `N.C.` are returned unchanged.
 */
export function transposeChord(
  rawToken: string,
  semitones: number,
  context: TransposeChordContext,
): string {
  const parsed = parseChordParts(rawToken);
  if (!parsed) {
    return rawToken;
  }

  const rootSemitone = noteToSemitone(parsed.root, context.sourceNotation);
  if (rootSemitone === null) {
    return rawToken;
  }

  const newRoot = formatSemitoneNote(
    rootSemitone + semitones,
    context.targetNotation,
    context.spellStyle,
  );
  const suffix = normalizeSuffix(parsed.suffix);

  let transposedBass = '';
  if (parsed.bass !== undefined) {
    const bassSemitone = noteToSemitone(parsed.bass, context.sourceNotation);
    if (bassSemitone !== null) {
      transposedBass = `/${formatSemitoneNote(
        bassSemitone + semitones,
        context.targetNotation,
        context.spellStyle,
      )}`;
    }
  }

  const formatted = `${newRoot}${suffix}${transposedBass}`;
  return parsed.hasParens ? `(${formatted})` : formatted;
}

function transposeKeyDirectiveValue(
  rawKey: string,
  semitones: number,
  context: TransposeChordContext,
): string {
  const trimmed = rawKey.trim();
  if (trimmed.length === 0) {
    return rawKey;
  }

  if (parseChordParts(trimmed)) {
    return transposeChord(trimmed, semitones, context);
  }

  const keyMatch = KEY_WORD_REGEX.exec(trimmed);
  if (!keyMatch) {
    return trimmed;
  }

  const note = keyMatch[1] ?? '';
  const suffix = keyMatch[2] ?? '';
  const semitone = noteToSemitone(note, context.sourceNotation);
  if (semitone === null) {
    return trimmed;
  }

  const newNote = formatSemitoneNote(
    semitone + semitones,
    context.targetNotation,
    context.spellStyle,
  );
  if (suffix.length === 0) {
    return newNote;
  }
  const normalizedSuffix = /^moll$/i.test(suffix)
    ? 'm'
    : /^dur$/i.test(suffix)
      ? ''
      : normalizeSuffix(suffix);
  return `${newNote}${normalizedSuffix}`;
}

/**
 * Extracts all chord tokens (and optional song key) from a parsed ChordPro preview AST.
 */
export function extractChordsFromPreview(preview: ChordProPreview): string[] {
  const chords: string[] = [];
  if (preview.key) {
    chords.push(preview.key);
  }
  for (const line of preview.lines) {
    if (line.kind !== 'lyric') {
      continue;
    }
    for (const segment of line.segments) {
      if (segment.chord) {
        chords.push(segment.chord);
      }
    }
  }
  return chords;
}

function buildTransposeContext(
  chords: readonly string[],
  options: TransposeOptions,
): TransposeChordContext {
  const sourceNotation =
    options.sourceNotation ??
    detectSourceNotation(chords, options.sourceNotationHint ?? 'cs');
  const spellStyle = resolveSpellStyle(
    chords,
    options.semitones,
    sourceNotation,
    options.accidentalPreference ?? 'auto',
  );
  return {
    sourceNotation,
    targetNotation: options.targetNotation,
    spellStyle,
  };
}

/**
 * Pure AST transposition for UI rendering without re-parsing raw ChordPro text.
 */
export function transposePreview(
  preview: ChordProPreview,
  options: TransposeOptions,
): ChordProPreview {
  const chords = extractChordsFromPreview(preview);
  const context = buildTransposeContext(chords, options);

  const lines: ChordProPreviewLine[] = preview.lines.map((line) => {
    if (line.kind !== 'lyric') {
      return line;
    }
    return {
      kind: 'lyric',
      hasChords: line.hasChords,
      segments: line.segments.map((segment) =>
        segment.chord !== undefined
          ? {
              chord: transposeChord(segment.chord, options.semitones, context),
              lyric: segment.lyric,
            }
          : segment,
      ),
    };
  });

  const transposedKey = preview.key
    ? transposeKeyDirectiveValue(preview.key, options.semitones, context)
    : undefined;

  const nextCapo =
    options.capo !== undefined
      ? options.capo > 0
        ? options.capo
        : undefined
      : preview.capo;

  return {
    ...(preview.title !== undefined ? { title: preview.title } : {}),
    ...(preview.artist !== undefined ? { artist: preview.artist } : {}),
    ...(transposedKey !== undefined ? { key: transposedKey } : {}),
    ...(nextCapo !== undefined ? { capo: nextCapo } : {}),
    lines,
  };
}

const HEADER_DIRECTIVES = new Set(['title', 't', 'artist', 'subtitle', 'st', 'key', 'capo']);

/**
 * Transposes a full canonical ChordPro document string, updating inline chords,
 * `{key: ...}`, and optionally `{capo: ...}` directives cleanly.
 */
export function transposeChordPro(
  chordproContent: string,
  options: TransposeOptions,
): string {
  const preview = parseChordProPreview(chordproContent);
  const chords = extractChordsFromPreview(preview);
  const context = buildTransposeContext(chords, options);

  const inputLines = chordproContent.replace(/\r\n?/g, '\n').split('\n');
  const outputLines: string[] = [];
  let capoHandled = false;

  for (const line of inputLines) {
    const directiveMatch = DIRECTIVE_REGEX.exec(line);
    if (directiveMatch) {
      const name = (directiveMatch[1] ?? '').toLowerCase();
      const value = (directiveMatch[2] ?? '').trim();

      if (name === 'key' && value.length > 0) {
        outputLines.push(
          `{key: ${transposeKeyDirectiveValue(value, options.semitones, context)}}`,
        );
        continue;
      }

      if (name === 'capo' && options.capo !== undefined) {
        capoHandled = true;
        if (options.capo > 0) {
          outputLines.push(`{capo: ${options.capo}}`);
        }
        continue;
      }

      outputLines.push(line);
      continue;
    }

    const transformed = line.replace(INLINE_CHORD_REGEX, (_full, inner: string) => {
      return `[${transposeChord(inner, options.semitones, context)}]`;
    });
    outputLines.push(transformed);
  }

  if (options.capo !== undefined && options.capo > 0 && !capoHandled) {
    let insertIndex = 0;
    while (insertIndex < outputLines.length) {
      const match = DIRECTIVE_REGEX.exec(outputLines[insertIndex] ?? '');
      if (match && HEADER_DIRECTIVES.has((match[1] ?? '').toLowerCase())) {
        insertIndex += 1;
      } else {
        break;
      }
    }

    const capoLine = `{capo: ${options.capo}}`;
    if (insertIndex === 0) {
      outputLines.unshift(capoLine, '');
    } else {
      outputLines.splice(insertIndex, 0, capoLine);
    }
  }

  return outputLines.join('\n');
}
