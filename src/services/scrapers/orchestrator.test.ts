import { describe, expect, it, vi } from 'vitest';
import {
  type AggregatedSearchSnapshot,
  type ScrapedSong,
  ScraperError,
  type SongSearchResult,
} from '../../core/types/scraper';
import { SearchOrchestrator } from './orchestrator';
import type { SongProvider } from './provider.interface';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeFakeProvider(
  id: string,
  name: string,
  overrides: Partial<SongProvider> = {},
): SongProvider {
  return {
    id,
    name,
    baseUrl: `https://${id}.example.cz`,
    language: 'cs',
    enabledByDefault: true,
    search: vi.fn(async () => []),
    fetchSong: vi.fn(async (url: string): Promise<ScrapedSong> => ({
      providerId: id,
      providerName: name,
      sourceUrl: url,
      title: 'Okoř',
      artist: 'Lidové písně',
      chordproContent: '{title: Okoř}\n\n[D]Na Okoř je cesta',
    })),
    ...overrides,
  };
}

describe('SearchOrchestrator', () => {
  it('streams progressive updates in parallel and isolates failing providers', async () => {
    const fastDeferred = createDeferred<SongSearchResult[]>();
    const failingDeferred = createDeferred<SongSearchResult[]>();

    const fastProvider = makeFakeProvider('fast', 'Fast Source', {
      search: vi.fn(() => fastDeferred.promise),
    });
    const failingProvider = makeFakeProvider('blocked', 'Blocked Source', {
      search: vi.fn(() => failingDeferred.promise),
    });

    const orchestrator = new SearchOrchestrator(() => [fastProvider, failingProvider]);
    const snapshots: AggregatedSearchSnapshot[] = [];

    const searchPromise = orchestrator.searchAllProviders('okor', {
      onUpdate: (snap) => snapshots.push(snap),
    });

    // Initial loading snapshot before either provider settles.
    expect(snapshots[0]?.isComplete).toBe(false);
    expect(snapshots[0]?.providerStatuses.every((s) => s.status === 'loading')).toBe(true);

    fastDeferred.resolve([
      {
        id: 'fast:okor',
        providerId: 'fast',
        providerName: 'Fast Source',
        title: 'Okoř',
        artist: 'Lidové písně',
        url: 'https://fast.example.cz/okor',
        matchType: 'title',
      },
    ]);

    // Flush microtasks so progressive update emits before failingProvider settles.
    await Promise.resolve();
    await Promise.resolve();

    const intermediate = snapshots[snapshots.length - 1];
    expect(intermediate?.results).toHaveLength(1);
    expect(intermediate?.providerStatuses.find((s) => s.providerId === 'fast')?.status).toBe('success');
    expect(intermediate?.providerStatuses.find((s) => s.providerId === 'blocked')?.status).toBe('loading');

    failingDeferred.reject(new ScraperError('BLOCKED', 'Challenge detected', { providerId: 'blocked' }));

    const finalSnapshot = await searchPromise;
    expect(finalSnapshot.isComplete).toBe(true);
    expect(finalSnapshot.results).toHaveLength(1);
    expect(finalSnapshot.providerStatuses.find((s) => s.providerId === 'blocked')).toMatchObject({
      status: 'error',
    });
  });

  it('caches search results and fetched songs within TTL and expires afterwards', async () => {
    let fakeTime = 1_000;
    const provider = makeFakeProvider('p1', 'Provider One', {
      search: vi.fn(async (): Promise<SongSearchResult[]> => [
        {
          id: 'p1:okor',
          providerId: 'p1',
          providerName: 'Provider One',
          title: 'Okoř',
          artist: 'Lidové písně',
          url: 'https://p1.example.cz/okor',
          matchType: 'title',
        },
      ]),
    });

    const orchestrator = new SearchOrchestrator(() => [provider], {
      cacheTtlMs: 5_000,
      now: () => fakeTime,
    });

    await orchestrator.searchAllProviders('Okoř');
    await orchestrator.searchAllProviders('okor'); // normalized cache hit
    expect(provider.search).toHaveBeenCalledTimes(1);

    fakeTime += 6_000;
    await orchestrator.searchAllProviders('okor'); // expired -> refetch
    expect(provider.search).toHaveBeenCalledTimes(2);

    await orchestrator.fetchSong({ providerId: 'p1', url: 'https://p1.example.cz/okor' });
    await orchestrator.fetchSong({ providerId: 'p1', url: 'https://p1.example.cz/okor' });
    expect(provider.fetchSong).toHaveBeenCalledTimes(1);
  });

  it('returns empty results immediately for queries shorter than minQueryLength', async () => {
    const provider = makeFakeProvider('p1', 'Provider One');
    const orchestrator = new SearchOrchestrator(() => [provider]);

    const snapshot = await orchestrator.searchAllProviders('a');
    expect(snapshot.results).toEqual([]);
    expect(snapshot.isComplete).toBe(true);
    expect(provider.search).not.toHaveBeenCalled();
  });
});
