import { useCallback, useState } from 'react';
import type { ChordNotation } from '../core/chordpro/transposer';

const NOTATION_STORAGE_KEY = 'zpevniq:chordNotation';

function readStoredNotation(): ChordNotation {
  try {
    if (typeof window === 'undefined') {
      return 'cs';
    }
    const stored = window.localStorage.getItem(NOTATION_STORAGE_KEY);
    if (stored === 'cs' || stored === 'intl') {
      return stored;
    }
  } catch {
    // Ignore storage read errors in restricted WebViews.
  }
  return 'cs';
}

export interface UseChordNotationResult {
  readonly chordNotation: ChordNotation;
  readonly setChordNotation: (notation: ChordNotation) => void;
}

export function useChordNotation(): UseChordNotationResult {
  const [chordNotation, setChordNotationState] = useState<ChordNotation>(() =>
    readStoredNotation(),
  );

  const setChordNotation = useCallback((notation: ChordNotation) => {
    setChordNotationState(notation);
    try {
      window.localStorage.setItem(NOTATION_STORAGE_KEY, notation);
    } catch {
      // Ignore storage persistence errors.
    }
  }, []);

  return {
    chordNotation,
    setChordNotation,
  };
}
