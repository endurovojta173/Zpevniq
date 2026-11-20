import { Dexie, type EntityTable } from 'dexie';
import { normalizeSearchText } from '../core/utils/normalize';
import type { SongStorageAdapter } from './repository';
import { DB_NAME, SCHEMA_VERSION, type SongRow } from './schema';

interface MetaRow {
  readonly key: string;
  readonly value: string;
}

type ZpevniqDexieInstance = Dexie & {
  songs: EntityTable<SongRow, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
};

function tokenizeNormalizedWords(text: string): string[] {
  const cleaned = text.replace(/[^a-z0-9]+/g, ' ').trim();
  if (cleaned.length === 0) {
    return [];
  }
  return cleaned.split(/\s+/);
}

function matchesAllPrefixTokens(words: readonly string[], tokens: readonly string[]): boolean {
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

function countPrefixMatches(words: readonly string[], tokens: readonly string[]): number {
  let count = 0;
  for (const token of tokens) {
    if (words.some((word) => word.startsWith(token))) {
      count += 1;
    }
  }
  return count;
}

function sortRowsAlphabetically(rows: readonly SongRow[]): SongRow[] {
  return [...rows].sort((a, b) => {
    const titleCmp = a.title.localeCompare(b.title, 'cs', { sensitivity: 'base' });
    if (titleCmp !== 0) {
      return titleCmp;
    }
    return a.artist.localeCompare(b.artist, 'cs', { sensitivity: 'base' });
  });
}

function pickBestBySourceUrl(rows: readonly SongRow[]): SongRow | null {
  if (rows.length === 0) {
    return null;
  }
  const sorted = [...rows].sort((a, b) => {
    const activeDiff = (b.deleted_at === null ? 1 : 0) - (a.deleted_at === null ? 1 : 0);
    if (activeDiff !== 0) {
      return activeDiff;
    }
    return b.updated_at.localeCompare(a.updated_at);
  });
  return sorted[0] ?? null;
}

function filterAndRankRows(
  activeRows: readonly SongRow[],
  normalizedTokens: readonly string[],
): SongRow[] {
  if (normalizedTokens.length === 0) {
    return sortRowsAlphabetically(activeRows);
  }

  const scored: { readonly row: SongRow; readonly score: number }[] = [];

  for (const row of activeRows) {
    const searchWords = tokenizeNormalizedWords(row.search_text);
    if (!matchesAllPrefixTokens(searchWords, normalizedTokens)) {
      continue;
    }

    const titleWords = tokenizeNormalizedWords(normalizeSearchText(row.title));
    const artistWords = tokenizeNormalizedWords(normalizeSearchText(row.artist));

    const score =
      countPrefixMatches(titleWords, normalizedTokens) * 10 +
      countPrefixMatches(artistWords, normalizedTokens) * 5 +
      countPrefixMatches(searchWords, normalizedTokens);

    scored.push({ row, score });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.row.title.localeCompare(b.row.title, 'cs', { sensitivity: 'base' });
    })
    .map((entry) => entry.row);
}

/**
 * IndexedDB / Dexie storage adapter for Web/PWA.
 */
export class DexieSongStorageAdapter implements SongStorageAdapter {
  private readonly dbName: string;
  private db: ZpevniqDexieInstance | null = null;

  constructor(dbName: string = DB_NAME) {
    this.dbName = dbName;
  }

  private getDb(): ZpevniqDexieInstance {
    if (!this.db) {
      const instance = new Dexie(this.dbName) as ZpevniqDexieInstance;
      instance.version(SCHEMA_VERSION).stores({
        songs: 'id, source_url, updated_at, deleted_at',
        meta: 'key',
      });
      this.db = instance;
    }
    return this.db;
  }

  async init(): Promise<void> {
    const db = this.getDb();
    await db.open();
    const existing = await db.meta.get('schema_version');
    const currentVersion = Number.parseInt(existing?.value ?? '0', 10) || 0;
    if (currentVersion < SCHEMA_VERSION) {
      await db.meta.put({
        key: 'schema_version',
        value: String(SCHEMA_VERSION),
      });
    }
  }

  async getSchemaVersion(): Promise<number> {
    const db = this.getDb();
    const record = await db.meta.get('schema_version');
    const parsed = Number.parseInt(record?.value ?? '0', 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  async getById(id: string): Promise<SongRow | null> {
    const row = await this.getDb().songs.get(id);
    return row ?? null;
  }

  async getBySourceUrl(sourceUrl: string): Promise<SongRow | null> {
    const matches = await this.getDb().songs.where('source_url').equals(sourceUrl).toArray();
    return pickBestBySourceUrl(matches);
  }

  async listActive(): Promise<SongRow[]> {
    const active = await this.getDb().songs.filter((row) => row.deleted_at === null).toArray();
    return sortRowsAlphabetically(active);
  }

  async searchActive(normalizedTokens: readonly string[]): Promise<SongRow[]> {
    const active = await this.getDb().songs.filter((row) => row.deleted_at === null).toArray();
    return filterAndRankRows(active, normalizedTokens);
  }

  async upsert(row: SongRow): Promise<void> {
    await this.getDb().songs.put(row);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * In-memory fallback implementing the exact Web storage contract for environments
 * without `indexedDB` (such as Vitest `happy-dom` or restricted browser contexts).
 */
export class InMemorySongStorageAdapter implements SongStorageAdapter {
  private readonly rows = new Map<string, SongRow>();
  private schemaVersion = 0;

  async init(): Promise<void> {
    if (this.schemaVersion < SCHEMA_VERSION) {
      this.schemaVersion = SCHEMA_VERSION;
    }
  }

  async getSchemaVersion(): Promise<number> {
    return this.schemaVersion;
  }

  async getById(id: string): Promise<SongRow | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySourceUrl(sourceUrl: string): Promise<SongRow | null> {
    const matches = [...this.rows.values()].filter((row) => row.source_url === sourceUrl);
    return pickBestBySourceUrl(matches);
  }

  async listActive(): Promise<SongRow[]> {
    const active = [...this.rows.values()].filter((row) => row.deleted_at === null);
    return sortRowsAlphabetically(active);
  }

  async searchActive(normalizedTokens: readonly string[]): Promise<SongRow[]> {
    const active = [...this.rows.values()].filter((row) => row.deleted_at === null);
    return filterAndRankRows(active, normalizedTokens);
  }

  async upsert(row: SongRow): Promise<void> {
    this.rows.set(row.id, row);
  }

  async close(): Promise<void> {
    this.rows.clear();
  }
}

export function createWebSongStorageAdapter(dbName: string = DB_NAME): SongStorageAdapter {
  if (typeof indexedDB !== 'undefined') {
    return new DexieSongStorageAdapter(dbName);
  }
  return new InMemorySongStorageAdapter();
}
