import {
  type AggregatedSearchSnapshot,
  type ProviderSearchStatus,
  type ScrapedSong,
  ScraperError,
  type SongSearchResult,
  isScraperError,
} from '../../core/types/scraper';
import { normalizeSearchText } from '../../core/utils/normalize';
import { rankSearchResults } from '../../core/utils/searchRanking';
import type { SongProvider } from './provider.interface';

export interface OrchestratorSearchOptions {
  readonly signal?: AbortSignal;
  readonly providerIds?: readonly string[];
  readonly limitPerProvider?: number;
  readonly onUpdate?: (snapshot: AggregatedSearchSnapshot) => void;
}

export interface OrchestratorFetchOptions {
  readonly signal?: AbortSignal;
}

export interface SearchOrchestratorConfig {
  readonly cacheTtlMs?: number;
  readonly maxCacheEntries?: number;
  readonly minQueryLength?: number;
  readonly now?: () => number;
  readonly isProviderEnabled?: (provider: SongProvider) => boolean;
}

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000;
const DEFAULT_MAX_CACHE_ENTRIES = 50;
const DEFAULT_MIN_QUERY_LENGTH = 2;

class BoundedTtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(ttlMs: number, maxEntries: number, now: () => number) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (this.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency for simple LRU eviction.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }
}

function toProviderError(error: unknown, providerId: string): ScraperError {
  if (isScraperError(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ScraperError('NETWORK_ERROR', message, {
    providerId,
    cause: error,
  });
}

/**
 * Coordinates parallel multi-provider song searches and song fetches with
 * progressive updates, per-provider fault isolation, AbortSignal cancellation,
 * and bounded in-memory TTL caching.
 */
export class SearchOrchestrator {
  private readonly getProviders: () => readonly SongProvider[];
  private readonly searchCache: BoundedTtlCache<readonly SongSearchResult[]>;
  private readonly songCache: BoundedTtlCache<ScrapedSong>;
  private readonly minQueryLength: number;
  private readonly now: () => number;
  private readonly isProviderEnabled: (provider: SongProvider) => boolean;

  constructor(
    getProviders: () => readonly SongProvider[],
    config: SearchOrchestratorConfig = {},
  ) {
    this.getProviders = getProviders;
    this.now = config.now ?? (() => Date.now());
    this.minQueryLength = config.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
    this.isProviderEnabled =
      config.isProviderEnabled ?? ((provider) => provider.enabledByDefault);
    const ttlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    const maxEntries = config.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
    this.searchCache = new BoundedTtlCache(ttlMs, maxEntries, this.now);
    this.songCache = new BoundedTtlCache(ttlMs, maxEntries, this.now);
  }

  private resolveTargetProviders(providerIds?: readonly string[]): readonly SongProvider[] {
    const all = this.getProviders();
    if (!providerIds || providerIds.length === 0) {
      return all.filter((provider) => this.isProviderEnabled(provider));
    }
    const allowed = new Set(providerIds);
    return all.filter((provider) => allowed.has(provider.id));
  }

  async searchAllProviders(
    rawQuery: string,
    options: OrchestratorSearchOptions = {},
  ): Promise<AggregatedSearchSnapshot> {
    const query = rawQuery.trim();
    const normalizedQuery = normalizeSearchText(query);

    if (normalizedQuery.length < this.minQueryLength) {
      const emptySnapshot: AggregatedSearchSnapshot = {
        query,
        results: [],
        providerStatuses: [],
        isComplete: true,
      };
      options.onUpdate?.(emptySnapshot);
      return emptySnapshot;
    }

    const providers = this.resolveTargetProviders(options.providerIds);
    const statusMap = new Map<string, ProviderSearchStatus>();
    const resultsByProvider = new Map<string, readonly SongSearchResult[]>();

    for (const provider of providers) {
      statusMap.set(provider.id, {
        providerId: provider.id,
        providerName: provider.name,
        status: 'loading',
      });
    }

    const buildSnapshot = (isComplete: boolean): AggregatedSearchSnapshot => {
      const merged: SongSearchResult[] = [];
      for (const providerResults of resultsByProvider.values()) {
        merged.push(...providerResults);
      }

      return {
        query,
        results: rankSearchResults(merged, query),
        providerStatuses: providers.map(
          (provider) =>
            statusMap.get(provider.id) ?? {
              providerId: provider.id,
              providerName: provider.name,
              status: 'loading',
            },
        ),
        isComplete,
      };
    };

    const emitUpdate = (isComplete: boolean) => {
      if (options.signal?.aborted) {
        return;
      }
      options.onUpdate?.(buildSnapshot(isComplete));
    };

    if (providers.length === 0) {
      const empty = buildSnapshot(true);
      emitUpdate(true);
      return empty;
    }

    emitUpdate(false);

    const tasks = providers.map(async (provider) => {
      const cacheKey = `${provider.id}::${normalizedQuery}`;
      const cached = this.searchCache.get(cacheKey);
      const startedAt = this.now();

      if (cached !== undefined) {
        resultsByProvider.set(provider.id, cached);
        statusMap.set(provider.id, {
          providerId: provider.id,
          providerName: provider.name,
          status: 'success',
          resultCount: cached.length,
          durationMs: 0,
        });
        emitUpdate(false);
        return;
      }

      try {
        const providerResults = await provider.search(query, {
          signal: options.signal,
          limit: options.limitPerProvider,
        });

        if (options.signal?.aborted) {
          return;
        }

        this.searchCache.set(cacheKey, providerResults);
        resultsByProvider.set(provider.id, providerResults);
        statusMap.set(provider.id, {
          providerId: provider.id,
          providerName: provider.name,
          status: 'success',
          resultCount: providerResults.length,
          durationMs: Math.max(0, this.now() - startedAt),
        });
        emitUpdate(false);
      } catch (error) {
        const scraperError = toProviderError(error, provider.id);
        if (scraperError.code === 'ABORTED' || options.signal?.aborted) {
          return;
        }

        statusMap.set(provider.id, {
          providerId: provider.id,
          providerName: provider.name,
          status: 'error',
          error: scraperError,
        });
        emitUpdate(false);
      }
    });

    await Promise.allSettled(tasks);

    const finalSnapshot = buildSnapshot(true);
    emitUpdate(true);
    return finalSnapshot;
  }

  async fetchSong(
    result: Pick<SongSearchResult, 'providerId' | 'url'>,
    options: OrchestratorFetchOptions = {},
  ): Promise<ScrapedSong> {
    const provider = this.getProviders().find((item) => item.id === result.providerId);
    if (!provider) {
      throw new ScraperError('NOT_FOUND', `Unknown song provider: ${result.providerId}`, {
        providerId: result.providerId,
        retryable: false,
      });
    }

    const cacheKey = `${provider.id}::${result.url.trim()}`;
    const cached = this.songCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const song = await provider.fetchSong(result.url, { signal: options.signal });
      if (!options.signal?.aborted) {
        this.songCache.set(cacheKey, song);
      }
      return song;
    } catch (error) {
      throw toProviderError(error, provider.id);
    }
  }

  clearCache(): void {
    this.searchCache.clear();
    this.songCache.clear();
  }
}
