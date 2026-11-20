import { describe, expect, it } from 'vitest';
import {
  buildChordProDocument,
  chordsOverLyricsToChordPro,
  isAlreadyChordPro,
  isChordLine,
  isChordToken,
  mergeChordLineWithLyrics,
  normalizeChordToken,
} from './converter';
import { parseChordProPreview } from './preview';

describe('chordpro converter', () => {
  it('recognizes Czech and International chord tokens and rejects prose words', () => {
    expect(isChordToken('Ami')).toBe(true);
    expect(isChordToken('Hmi7')).toBe(true);
    expect(isChordToken('F#m/C#')).toBe(true);
    expect(isChordToken('Bb7')).toBe(true);
    expect(isChordToken('Cmaj7')).toBe(true);
    expect(isChordToken('Gsus4')).toBe(true);
    expect(isChordToken('(D)')).toBe(true);

    expect(isChordToken('a')).toBe(false);
    expect(isChordToken('Na')).toBe(false);
    expect(isChordToken('Okoř')).toBe(false);
    expect(isChordToken('Be')).toBe(false);
    expect(isChordToken('A.')).toBe(false);
  });

  it('normalizes Czech mi suffix to m while preserving root note H/B', () => {
    expect(normalizeChordToken('Ami')).toBe('Am');
    expect(normalizeChordToken('Hmi7')).toBe('Hm7');
    expect(normalizeChordToken('Dmi/F')).toBe('Dm/F');
    expect(normalizeChordToken('Cmaj7')).toBe('Cmaj7');
    expect(normalizeChordToken('H')).toBe('H');
    expect(normalizeChordToken('Bb')).toBe('Bb');
    expect(normalizeChordToken('(Emi)')).toBe('Em');
  });

  it('distinguishes chord lines from lyric lines starting with uppercase A', () => {
    expect(isChordLine('Ami      G      Ami        E ')).toBe(true);
    expect(isChordLine('   D   ')).toBe(true);
    expect(isChordLine('A')).toBe(true);
    expect(isChordLine('| G | D | Em | C | (2x)')).toBe(true);

    expect(isChordLine('A pak jsme šli domů.')).toBe(false);
    expect(isChordLine('1. Na Okoř je cesta, jako žádná ze sta,')).toBe(false);
    expect(isChordLine('   ')).toBe(false);
  });

  it('merges chords into lyrics at exact character columns including Czech diacritics', () => {
    const merged = mergeChordLineWithLyrics(
      'A                D',
      'roubená je stromama.',
    );
    expect(merged).toBe('[A]roubená je stroma[D]ma.');
  });

  it('appends trailing chords that appear beyond the end of the lyric line', () => {
    const merged = mergeChordLineWithLyrics(
      'Ami        E   Ami',
      'zelená se.',
    );
    expect(merged).toBe('[Am]zelená se. [E] [Am]');
  });

  it('converts a full chords-over-lyrics folk song with metadata directives', () => {
    const raw = [
      'Intro: D  A  D',
      '',
      'D',
      '1. Na Okoř je cesta, jako žádná ze sta,',
      'A                D',
      'roubená je stromama.',
      '',
      'Ami     Dmi     Ami E  Ami',
      'zelená, zelená, zelená se.',
    ].join('\n');

    const chordpro = chordsOverLyricsToChordPro(raw, {
      title: 'Okoř',
      artist: 'Lidové písně',
      key: 'D',
    });

    expect(chordpro).toBe(
      [
        '{title: Okoř}',
        '{artist: Lidové písně}',
        '{key: D}',
        '',
        'Intro: [D] [A] [D]',
        '',
        '[D]1. Na Okoř je cesta, jako žádná ze sta,',
        '[A]roubená je stroma[D]ma.',
        '',
        '[Am]zelená, [Dm]zelená, [Am]zele[E]ná [Am]se.',
      ].join('\n'),
    );
  });

  it('handles standalone chord-only lines followed by blank lines or EOF', () => {
    const chordpro = chordsOverLyricsToChordPro('G   D   Em   C\n\nG   D   G');
    expect(chordpro).toBe('[G] [D] [Em] [C]\n\n[G] [D] [G]');
  });

  it('sanitizes control characters and braces in ChordPro metadata directives', () => {
    const doc = buildChordProDocument(
      { title: 'Skákal {pes}\nPřes oves', artist: 'Lidová}píseň', capo: 2 },
      '[G]Skákal pes',
    );
    expect(doc).toBe(
      '{title: Skákal pes Přes oves}\n{artist: Lidová píseň}\n{capo: 2}\n\n[G]Skákal pes',
    );
  });

  it('detects existing ChordPro input cleanly', () => {
    expect(isAlreadyChordPro('{title: Skákal pes}\n[G]Skákal pes')).toBe(true);
    expect(isAlreadyChordPro('[Am]Holka modro[E7]oká')).toBe(true);
    expect(isAlreadyChordPro('G        D\nSkákal pes přes oves')).toBe(false);
  });
});

describe('parseChordProPreview', () => {
  it('extracts directives and parses inline chords into lyric segments', () => {
    const preview = parseChordProPreview(
      [
        '{title: Skákal pes}',
        '{artist: Lidová}',
        '{key: G}',
        '{capo: 2}',
        '{comment: Refrén}',
        '[G]Skákal pes [D]přes oves',
        '',
        'přes zelenou [G]louku.',
      ].join('\n'),
    );

    expect(preview.title).toBe('Skákal pes');
    expect(preview.artist).toBe('Lidová');
    expect(preview.key).toBe('G');
    expect(preview.capo).toBe(2);
    expect(preview.lines).toEqual([
      { kind: 'comment', text: 'Refrén' },
      {
        kind: 'lyric',
        hasChords: true,
        segments: [
          { chord: 'G', lyric: 'Skákal pes ' },
          { chord: 'D', lyric: 'přes oves' },
        ],
      },
      { kind: 'empty' },
      {
        kind: 'lyric',
        hasChords: true,
        segments: [
          { lyric: 'přes zelenou ' },
          { chord: 'G', lyric: 'louku.' },
        ],
      },
    ]);
  });
});
