import { describe, expect, it } from 'vitest';
import {
  type ChordProPreviewLine,
  groupLineIntoWordClusters,
  parseChordProPreview,
} from './preview';

function getFirstLyricLine(chordpro: string) {
  const parsed = parseChordProPreview(chordpro);
  const line = parsed.lines.find(
    (entry): entry is Extract<ChordProPreviewLine, { kind: 'lyric' }> => entry.kind === 'lyric',
  );
  if (!line) {
    throw new Error('Expected lyric line');
  }
  return line;
}

describe('groupLineIntoWordClusters', () => {
  it('splits leading verse prefix and long chorded line into wrappable word clusters', () => {
    const line = getFirstLyricLine('1. [Am]Spatřil jsem kometu, oblohou letěla,');
    const clusters = groupLineIntoWordClusters(line.segments);

    expect(clusters).toEqual([
      { parts: [{ lyric: '1.' }], trailingSpace: true },
      { parts: [{ chord: 'Am', lyric: 'Spatřil' }], trailingSpace: true },
      { parts: [{ lyric: 'jsem' }], trailingSpace: true },
      { parts: [{ lyric: 'kometu,' }], trailingSpace: true },
      { parts: [{ lyric: 'oblohou' }], trailingSpace: true },
      { parts: [{ lyric: 'letěla,' }], trailingSpace: false },
    ]);
  });

  it('keeps mid-word chords inside a single unbroken word cluster', () => {
    const line = getFirstLyricLine('roubená je stroma[C]ma.');
    const clusters = groupLineIntoWordClusters(line.segments);

    expect(clusters).toEqual([
      { parts: [{ lyric: 'roubená' }], trailingSpace: true },
      { parts: [{ lyric: 'je' }], trailingSpace: true },
      { parts: [{ lyric: 'stroma' }, { chord: 'C', lyric: 'ma.' }], trailingSpace: false },
    ]);
  });

  it('keeps multiple chords within the same word grouped together', () => {
    const line = getFirstLyricLine('[C]a[G]b');
    const clusters = groupLineIntoWordClusters(line.segments);

    expect(clusters).toEqual([
      {
        parts: [
          { chord: 'C', lyric: 'a' },
          { chord: 'G', lyric: 'b' },
        ],
        trailingSpace: false,
      },
    ]);
  });

  it('handles standalone chord lines and trailing chords cleanly without leading space clutter', () => {
    const standalone = getFirstLyricLine('   [C] [G] [Am] [F]');
    expect(groupLineIntoWordClusters(standalone.segments)).toEqual([
      { parts: [{ chord: 'C', lyric: '' }], trailingSpace: true },
      { parts: [{ chord: 'G', lyric: '' }], trailingSpace: true },
      { parts: [{ chord: 'Am', lyric: '' }], trailingSpace: true },
      { parts: [{ chord: 'F', lyric: '' }], trailingSpace: false },
    ]);

    const trailing = getFirstLyricLine('text [G7]');
    expect(groupLineIntoWordClusters(trailing.segments)).toEqual([
      { parts: [{ lyric: 'text' }], trailingSpace: true },
      { parts: [{ chord: 'G7', lyric: '' }], trailingSpace: false },
    ]);
  });
});
