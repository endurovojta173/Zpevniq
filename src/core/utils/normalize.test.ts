import { describe, expect, it } from 'vitest';
import { normalizeSearchText } from './normalize';

describe('normalizeSearchText', () => {
  it('strips Czech diacritics and lowercases text', () => {
    expect(normalizeSearchText('Příliš žluťoučký kůň úpěl ďábelské ódy')).toBe(
      'prilis zlutoucky kun upel dabelske ody',
    );
  });

  it('collapses repeated whitespace and trims edges', () => {
    expect(normalizeSearchText('  Skákal   pes \n  přes oves  ')).toBe(
      'skakal pes pres oves',
    );
  });
});
