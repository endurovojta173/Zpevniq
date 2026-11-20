import { describe, expect, it } from 'vitest';
import { parseChordProPreview } from './preview';
import {
  detectSourceNotation,
  transposeChord,
  transposeChordPro,
  transposePreview,
} from './transposer';

describe('detectSourceNotation', () => {
  it('detects Czech notation when H chords appear', () => {
    expect(detectSourceNotation(['G', 'D', 'Em', 'Hm'], 'intl')).toBe('cs');
    expect(detectSourceNotation(['D/H'], 'intl')).toBe('cs');
  });

  it('detects International notation when Bb chords appear', () => {
    expect(detectSourceNotation(['F', 'C', 'Dm', 'Bb'], 'cs')).toBe('intl');
    expect(detectSourceNotation(['Gm/Bb'], 'cs')).toBe('intl');
  });

  it('uses harmonic context for ambiguous bare B chords and falls back to hint on ties', () => {
    expect(detectSourceNotation(['F', 'C', 'Dm', 'B'], 'intl')).toBe('cs');
    expect(detectSourceNotation(['E', 'A', 'B7'], 'cs')).toBe('intl');
    expect(detectSourceNotation(['B', 'G'], 'intl')).toBe('intl');
    expect(detectSourceNotation(['B', 'G'], 'cs')).toBe('cs');
  });
});

describe('transposeChord', () => {
  it('converts between Czech H/B and International B/Bb at 0 semitones', () => {
    const csToIntl = {
      sourceNotation: 'cs' as const,
      targetNotation: 'intl' as const,
      spellStyle: 'neutral' as const,
    };
    expect(transposeChord('Hm', 0, csToIntl)).toBe('Bm');
    expect(transposeChord('B', 0, csToIntl)).toBe('Bb');
    expect(transposeChord('F#7/H', 0, csToIntl)).toBe('F#7/B');
    expect(transposeChord('Hmi7', 0, csToIntl)).toBe('Bm7');

    const intlToCs = {
      sourceNotation: 'intl' as const,
      targetNotation: 'cs' as const,
      spellStyle: 'neutral' as const,
    };
    expect(transposeChord('Bm', 0, intlToCs)).toBe('Hm');
    expect(transposeChord('Bb', 0, intlToCs)).toBe('B');
    expect(transposeChord('F#7/B', 0, intlToCs)).toBe('F#7/H');
  });

  it('transposes slash chords, wraps octaves, preserves parens and non-chord tokens', () => {
    const ctx = {
      sourceNotation: 'cs' as const,
      targetNotation: 'cs' as const,
      spellStyle: 'sharp' as const,
    };
    expect(transposeChord('D/F#', 2, ctx)).toBe('E/G#');
    expect(transposeChord('(G7)', 2, ctx)).toBe('(A7)');
    expect(transposeChord('C', -1, ctx)).toBe('H');
    expect(transposeChord('H', 1, ctx)).toBe('C');
    expect(transposeChord('N.C.', 5, ctx)).toBe('N.C.');
  });
});

describe('transposePreview and transposeChordPro', () => {
  const kometaSnippet = [
    '{title: Kometa}',
    '{artist: Jaromír Nohavica}',
    '{key: Am}',
    '',
    '1. [Ami]Spatřil jsem kometu, oblohou letěla,',
    '[Dmi]zmizela jako laň [G7]u lesa v remízku,',
    '[C]v očích mi zbylo jen [E7]pár žlutých penízků.',
  ].join('\n');

  it('chooses musically accurate flat vs sharp enharmonic spelling per target key', () => {
    const parsed = parseChordProPreview(kometaSnippet);

    // Am + 1 -> Bbm (flat key: Bm in cs, Bbm in intl, plus Ebm/Ab7/Db/F7)
    const plusOneCs = transposePreview(parsed, {
      semitones: 1,
      targetNotation: 'cs',
      sourceNotationHint: 'cs',
    });
    expect(plusOneCs.key).toBe('Bm');
    expect(plusOneCs.lines[0]).toMatchObject({
      kind: 'lyric',
      segments: [{ lyric: '1. ' }, { chord: 'Bm', lyric: 'Spatřil jsem kometu, oblohou letěla,' }],
    });
    expect(plusOneCs.lines[1]).toMatchObject({
      segments: [
        { chord: 'Ebm', lyric: 'zmizela jako laň ' },
        { chord: 'Ab7', lyric: 'u lesa v remízku,' },
      ],
    });
    expect(plusOneCs.lines[2]).toMatchObject({
      segments: [
        { chord: 'Db', lyric: 'v očích mi zbylo jen ' },
        { chord: 'F7', lyric: 'pár žlutých penízků.' },
      ],
    });

    // Am + 2 -> Hm (sharp key: Hm/Em/A7/D/F#7)
    const plusTwoCs = transposePreview(parsed, {
      semitones: 2,
      targetNotation: 'cs',
      sourceNotationHint: 'cs',
    });
    expect(plusTwoCs.key).toBe('Hm');
    expect(plusTwoCs.lines[2]).toMatchObject({
      segments: [
        { chord: 'D', lyric: 'v očích mi zbylo jen ' },
        { chord: 'F#7', lyric: 'pár žlutých penízků.' },
      ],
    });

    // Original parsed AST stays untouched
    expect(parsed.key).toBe('Am');
  });

  it('rewrites ChordPro text including {key} and {capo} directives cleanly', () => {
    const withCapo = transposeChordPro(kometaSnippet, {
      semitones: -2,
      targetNotation: 'intl',
      sourceNotationHint: 'cs',
      capo: 2,
    });

    expect(withCapo).toBe(
      [
        '{title: Kometa}',
        '{artist: Jaromír Nohavica}',
        '{key: Gm}',
        '{capo: 2}',
        '',
        '1. [Gm]Spatřil jsem kometu, oblohou letěla,',
        '[Cm]zmizela jako laň [F7]u lesa v remízku,',
        '[Bb]v očích mi zbylo jen [D7]pár žlutých penízků.',
      ].join('\n'),
    );

    // Removing capo (capo: 0) strips the {capo: 2} directive cleanly.
    const removedCapo = transposeChordPro(withCapo, {
      semitones: 2,
      targetNotation: 'cs',
      sourceNotationHint: 'intl',
      capo: 0,
    });
    expect(removedCapo).not.toContain('{capo:');
    expect(removedCapo).toContain('{key: Am}');
    expect(removedCapo).toContain('[C]v očích mi zbylo jen');
  });
});
