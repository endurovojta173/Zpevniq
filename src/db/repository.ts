import type { SaveSongInput, SavedSong } from '../core/types/song';
import { platform } from '../services/platform';
import {
  type SongRow,
  deriveSongProjections,
  rowToSavedSong,
  tokenizeSearchQuery,
} from './schema';
import { createCapacitorSqliteAdapter } from './sqlite.adapter';
import { createWebSongStorageAdapter } from './web.adapter';

export interface SongStorageAdapter {
  init(): Promise<void>;
  getSchemaVersion(): Promise<number>;
  getById(id: string): Promise<SongRow | null>;
  getBySourceUrl(sourceUrl: string): Promise<SongRow | null>;
  listActive(): Promise<SongRow[]>;
  searchActive(normalizedTokens: readonly string[]): Promise<SongRow[]>;
  upsert(row: SongRow): Promise<void>;
  close(): Promise<void>;
}

export interface SongRepositoryOptions {
  readonly now?: () => string;
  readonly generateId?: () => string;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC-4122 v4 formatting if crypto.randomUUID is unavailable in older WebViews.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

/**
 * Unified offline-first repository for reading, searching, saving, and soft-deleting songs.
 * Automatically derives all indexed projections from canonical `chordproContent`.
 */
export class SongRepository {
  private readonly adapter: SongStorageAdapter;
  private readonly now: () => string;
  private readonly generateId: () => string;
  private initPromise: Promise<void> | null = null;

  constructor(adapter: SongStorageAdapter, options: SongRepositoryOptions = {}) {
    this.adapter = adapter;
    this.now = options.now ?? (() => new Date().toISOString());
    this.generateId = options.generateId ?? generateUuid;
  }

  private ensureInit(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.adapter.init().catch((error: unknown) => {
        this.initPromise = null;
        throw error;
      });
    }
    return this.initPromise;
  }

  async getSchemaVersion(): Promise<number> {
    await this.ensureInit();
    return this.adapter.getSchemaVersion();
  }

  async save(input: SaveSongInput): Promise<SavedSong> {
    await this.ensureInit();

    const normalizedSourceUrl = input.sourceUrl?.trim() || null;
    const normalizedSourceProvider = input.sourceProvider?.trim() || null;

    let existing: SongRow | null = null;
    if (input.id) {
      existing = await this.adapter.getById(input.id);
    }
    if (!existing && normalizedSourceUrl) {
      existing = await this.adapter.getBySourceUrl(normalizedSourceUrl);
    }

    const projections = deriveSongProjections(input.chordproContent);
    const timestamp = this.now();

    const row: SongRow = {
      id: existing?.id ?? input.id ?? this.generateId(),
      chordpro_content: input.chordproContent,
      title: projections.title,
      artist: projections.artist,
      key: projections.key,
      capo: projections.capo,
      search_text: projections.searchText,
      source_provider: normalizedSourceProvider ?? existing?.source_provider ?? null,
      source_url: normalizedSourceUrl ?? existing?.source_url ?? null,
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
      deleted_at: null,
      is_dirty: 1,
    };

    await this.adapter.upsert(row);
    return rowToSavedSong(row);
  }

  async getById(id: string): Promise<SavedSong | null> {
    await this.ensureInit();
    const row = await this.adapter.getById(id);
    if (!row || row.deleted_at !== null) {
      return null;
    }
    return rowToSavedSong(row);
  }

  async findBySourceUrl(sourceUrl: string): Promise<SavedSong | null> {
    await this.ensureInit();
    const trimmed = sourceUrl.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const row = await this.adapter.getBySourceUrl(trimmed);
    if (!row || row.deleted_at !== null) {
      return null;
    }
    return rowToSavedSong(row);
  }

  async list(): Promise<SavedSong[]> {
    await this.ensureInit();
    const rows = await this.adapter.listActive();
    return rows.map(rowToSavedSong);
  }

  async search(query: string): Promise<SavedSong[]> {
    await this.ensureInit();
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length === 0) {
      return this.list();
    }
    const rows = await this.adapter.searchActive(tokens);
    return rows.map(rowToSavedSong);
  }

  async softDelete(id: string): Promise<boolean> {
    await this.ensureInit();
    const existing = await this.adapter.getById(id);
    if (!existing || existing.deleted_at !== null) {
      return false;
    }

    const timestamp = this.now();
    await this.adapter.upsert({
      ...existing,
      updated_at: timestamp,
      deleted_at: timestamp,
      is_dirty: 1,
    });
    return true;
  }

  async close(): Promise<void> {
    this.initPromise = null;
    await this.adapter.close();
  }
}

function createPlatformAdapter(): SongStorageAdapter {
  return platform.isNative ? createCapacitorSqliteAdapter() : createWebSongStorageAdapter();
}

export const songRepository = new SongRepository(createPlatformAdapter());
