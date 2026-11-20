/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { SongRepository, type SongStorageAdapter } from './repository';
import { SCHEMA_VERSION } from './schema';
import { type SqliteExecutor, SqliteSongStorageAdapter } from './sqlite.adapter';
import { InMemorySongStorageAdapter } from './web.adapter';

function createNodeSqliteExecutor(): SqliteExecutor {
  let db: DatabaseSync | null = null;

  const ensureOpen = (): DatabaseSync => {
    if (!db) {
      db = new DatabaseSync(':memory:');
    }
    return db;
  };

  return {
    async open(): Promise<void> {
      ensureOpen();
    },

    async execute(sql: string): Promise<void> {
      ensureOpen().exec(sql);
    },

    async run(sql: string, values: readonly unknown[] = []): Promise<void> {
      const stmt = ensureOpen().prepare(sql);
      stmt.run(...(values as SQLInputValue[]));
    },

    async query<T>(sql: string, values: readonly unknown[] = []): Promise<T[]> {
      const stmt = ensureOpen().prepare(sql);
      return stmt.all(...(values as SQLInputValue[])) as T[];
    },

    async close(): Promise<void> {
      if (db) {
        db.close();
        db = null;
      }
    },
  };
}

function runRepositoryContractSuite(
  adapterName: string,
  createAdapter: () => SongStorageAdapter,
): void {
  describe(`SongRepository contract (${adapterName})`, () => {
    const activeRepos: SongRepository[] = [];

    const createRepo = (): SongRepository => {
      let tick = 0;
      const repo = new SongRepository(createAdapter(), {
        now: () => {
          tick += 1;
          return new Date(1_795_000_000_000 + tick * 1_000).toISOString();
        },
      });
      activeRepos.push(repo);
      return repo;
    };

    afterEach(async () => {
      while (activeRepos.length > 0) {
        const repo = activeRepos.pop();
        await repo?.close();
      }
    });

    it('initializes schema to SCHEMA_VERSION idempotently', async () => {
      const repo = createRepo();
      expect(await repo.getSchemaVersion()).toBe(SCHEMA_VERSION);
      expect(await repo.list()).toEqual([]);
      expect(await repo.getSchemaVersion()).toBe(SCHEMA_VERSION);
    });

    it('derives title, artist, key, capo, and search projections strictly from chordproContent', async () => {
      const repo = createRepo();

      const saved = await repo.save({
        chordproContent: [
          '{title: Skákal pes}',
          '{artist: Lidová píseň}',
          '{key: G}',
          '{capo: 2}',
          '',
          '[G]Skákal pes [D]přes oves,',
          '[D7]přes zelenou [G]louku.',
        ].join('\n'),
        sourceProvider: 'velkyzpevnik',
        sourceUrl: 'https://www.velkyzpevnik.cz/lidove-pisne/skakal-pes',
      });

      expect(saved.id).toBeTruthy();
      expect(saved.title).toBe('Skákal pes');
      expect(saved.artist).toBe('Lidová píseň');
      expect(saved.key).toBe('G');
      expect(saved.capo).toBe(2);
      expect(saved.deletedAt).toBeNull();
      expect(saved.isDirty).toBe(true);

      const loaded = await repo.getById(saved.id);
      expect(loaded).toEqual(saved);
    });

    it('updates existing song in place by sourceUrl without creating duplicates', async () => {
      const repo = createRepo();
      const sourceUrl = 'https://www.velkyzpevnik.cz/lidove-pisne/okor';

      const first = await repo.save({
        chordproContent: '{title: Okoř}\n{artist: Lidové}\n\n[D]Na Okoř je cesta',
        sourceProvider: 'velkyzpevnik',
        sourceUrl,
      });

      const updated = await repo.save({
        chordproContent: '{title: Okoř (upraveno)}\n{artist: Lidové}\n{key: D}\n\n[D]Na Okoř je cesta',
        sourceProvider: 'velkyzpevnik',
        sourceUrl,
      });

      expect(updated.id).toBe(first.id);
      expect(updated.createdAt).toBe(first.createdAt);
      expect(updated.updatedAt > first.updatedAt).toBe(true);
      expect(updated.title).toBe('Okoř (upraveno)');
      expect(updated.key).toBe('D');

      const all = await repo.list();
      expect(all).toHaveLength(1);
    });

    it('performs diacritic- and case-insensitive prefix search and ranks title above lyrics', async () => {
      const repo = createRepo();

      await repo.save({
        chordproContent: [
          '{title: Zelená louka}',
          '{artist: Táborová}',
          '',
          '[G]Příliš žluťoučký kůň úpěl, skákal přes oves.',
        ].join('\n'),
      });

      await repo.save({
        chordproContent: [
          '{title: Skákal pes}',
          '{artist: Lidové písně}',
          '',
          '[G]Přes zelenou louku.',
        ].join('\n'),
      });

      await repo.save({
        chordproContent: [
          '{title: Kometa}',
          '{artist: Jaromír Nohavica}',
          '',
          '[Am]Spatřil jsem kometu, oblohou letěla.',
        ].join('\n'),
      });

      const skakalMatches = await repo.search('skakal');
      expect(skakalMatches.map((song) => song.title)).toEqual([
        'Skákal pes',
        'Zelená louka',
      ]);

      const diacriticMatches = await repo.search('zlutoucky');
      expect(diacriticMatches.map((song) => song.title)).toEqual(['Zelená louka']);

      const multiTokenMatches = await repo.search('nohavica kom');
      expect(multiTokenMatches.map((song) => song.title)).toEqual(['Kometa']);

      // Ensure chord tokens inside brackets (e.g. "[D7]") do not leak into lyrics search.
      const chordLeak = await repo.search('d7');
      expect(chordLeak).toEqual([]);
    });

    it('soft-deletes songs from list/search and restores cleanly when re-saved by sourceUrl', async () => {
      const repo = createRepo();
      const sourceUrl = 'https://www.velkyzpevnik.cz/lidove-pisne/holka-modrooka';

      const saved = await repo.save({
        chordproContent: '{title: Holka modrooká}\n{artist: Lidové}\n\n[Am]Nesedávej u potoka',
        sourceProvider: 'velkyzpevnik',
        sourceUrl,
      });

      expect(await repo.softDelete(saved.id)).toBe(true);
      expect(await repo.softDelete(saved.id)).toBe(false);

      expect(await repo.getById(saved.id)).toBeNull();
      expect(await repo.findBySourceUrl(sourceUrl)).toBeNull();
      expect(await repo.list()).toEqual([]);
      expect(await repo.search('holka')).toEqual([]);

      const restored = await repo.save({
        chordproContent: '{title: Holka modrooká}\n{artist: Lidové}\n\n[Am]Nesedávej u potoka',
        sourceProvider: 'velkyzpevnik',
        sourceUrl,
      });

      expect(restored.id).toBe(saved.id);
      expect(restored.deletedAt).toBeNull();
      expect(await repo.list()).toHaveLength(1);
      expect(await repo.search('holka')).toHaveLength(1);
    });
  });
}

runRepositoryContractSuite(
  'SQLite + FTS5',
  () => new SqliteSongStorageAdapter(createNodeSqliteExecutor()),
);

runRepositoryContractSuite('Web / InMemory', () => new InMemorySongStorageAdapter());
