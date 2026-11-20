import { SearchOrchestrator } from './orchestrator';
import type { SongProvider } from './provider.interface';
import { akordyKytaryProvider } from './providers/akordykytary/provider';
import { chordieProvider } from './providers/chordie/provider';
import { guitareTabProvider } from './providers/guitaretab/provider';
import { velkyZpevnikProvider } from './providers/velkyzpevnik/provider';

const DISABLED_PROVIDERS_STORAGE_KEY = 'zpevniq.disabledProviders';

const registeredProviders: SongProvider[] = [
  velkyZpevnikProvider,
  akordyKytaryProvider,
  chordieProvider,
  guitareTabProvider,
];

function readDisabledProviderIds(): Set<string> {
  if (typeof localStorage === 'undefined') {
    return new Set();
  }
  try {
    const raw = localStorage.getItem(DISABLED_PROVIDERS_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

function writeDisabledProviderIds(ids: ReadonlySet<string>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(DISABLED_PROVIDERS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage quota or restricted WebView errors cleanly.
  }
}

export function getAllProviders(): readonly SongProvider[] {
  return [...registeredProviders];
}

export function isProviderEnabled(id: string): boolean {
  const provider = registeredProviders.find((item) => item.id === id);
  if (!provider) {
    return false;
  }
  return provider.enabledByDefault && !readDisabledProviderIds().has(id);
}

export function setProviderEnabled(id: string, enabled: boolean): void {
  const disabled = readDisabledProviderIds();
  if (enabled) {
    disabled.delete(id);
  } else {
    disabled.add(id);
  }
  writeDisabledProviderIds(disabled);
}

export function getEnabledProviders(disabledIds?: ReadonlySet<string>): readonly SongProvider[] {
  const effectiveDisabled = disabledIds ?? readDisabledProviderIds();
  return registeredProviders.filter(
    (provider) => provider.enabledByDefault && !effectiveDisabled.has(provider.id),
  );
}

export function getProviderById(id: string): SongProvider | undefined {
  return registeredProviders.find((provider) => provider.id === id);
}

export function registerProvider(provider: SongProvider): void {
  const existingIndex = registeredProviders.findIndex((item) => item.id === provider.id);
  if (existingIndex >= 0) {
    registeredProviders[existingIndex] = provider;
  } else {
    registeredProviders.push(provider);
  }
}

/**
 * Default shared orchestrator wired to the global provider registry.
 */
export const searchOrchestrator = new SearchOrchestrator(getAllProviders, {
  isProviderEnabled: (provider) => isProviderEnabled(provider.id),
});
