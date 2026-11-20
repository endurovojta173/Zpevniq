import { useCallback, useEffect, useState } from 'react';
import { platform } from '../services/platform';

export type ThemePreference = 'system' | 'dark' | 'light' | 'stage';
export type ResolvedTheme = 'dark' | 'light' | 'stage';

const THEME_STORAGE_KEY = 'zpevniq:theme';

const THEME_META_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  dark: '#111114',
  light: '#fbf9f6',
  stage: '#000000',
};

function readStoredThemePreference(): ThemePreference {
  try {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'system' || stored === 'dark' || stored === 'light' || stored === 'stage') {
      return stored;
    }
  } catch {
    // Ignore storage access errors in private or sandboxed contexts.
  }
  return 'dark';
}

function getSystemIsLight(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches;
}

export interface UseThemeResult {
  readonly themePreference: ThemePreference;
  readonly setThemePreference: (preference: ThemePreference) => void;
  readonly resolvedTheme: ResolvedTheme;
  readonly isStageMode: boolean;
  readonly stageModeOverride: boolean;
  readonly setStageModeOverride: (enabled: boolean) => void;
  readonly toggleStageMode: () => void;
}

export function useTheme(): UseThemeResult {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    readStoredThemePreference(),
  );
  const [systemIsLight, setSystemIsLight] = useState<boolean>(() => getSystemIsLight());
  const [stageModeOverride, setStageModeOverride] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemIsLight(event.matches);
    };

    setSystemIsLight(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
    if (preference !== 'stage') {
      setStageModeOverride(false);
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore storage persistence errors.
    }
  }, []);

  const resolvedTheme: ResolvedTheme = stageModeOverride
    ? 'stage'
    : themePreference === 'system'
      ? systemIsLight
        ? 'light'
        : 'dark'
      : themePreference;

  const toggleStageMode = useCallback(() => {
    if (themePreference === 'stage') {
      setThemePreference('dark');
      setStageModeOverride(false);
      return;
    }
    setStageModeOverride((prev) => !prev);
  }, [setThemePreference, themePreference]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.platform = platform.os;

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_META_COLORS[resolvedTheme]);
    }
  }, [resolvedTheme]);

  return {
    themePreference,
    setThemePreference,
    resolvedTheme,
    isStageMode: resolvedTheme === 'stage',
    stageModeOverride,
    setStageModeOverride,
    toggleStageMode,
  };
}
