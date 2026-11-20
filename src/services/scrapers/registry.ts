import { SearchOrchestrator } from './orchestrator';
import type { SongProvider } from './provider.interface';
import { velkyZpevnikProvider } from './providers/velkyzpevnik/provider';

const registeredProviders: SongProvider[] = [velkyZpevnikProvider];

export function getAllProviders(): readonly SongProvider[] {
  return [...registeredProviders];
}

export function getEnabledProviders(disabledIds?: ReadonlySet<string>): readonly SongProvider[] {
  return registeredProviders.filter(
    (provider) => provider.enabledByDefault && !disabledIds?.has(provider.id),
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
export const searchOrchestrator = new SearchOrchestrator(getAllProviders);
