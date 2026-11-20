import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { normalizeSearchText } from '../core/utils/normalize';
import type { SongStorageAdapter } from './repository';
import { DB_NAME, SCHEMA_VERSION, type SongRow } from './schema';

export interface SqliteExecutor {
  open(): Promise<void>;
  execute(sql: string): Promise<void>;
  run(sql: string, values?: readonly unknown[]): Promise<void>;
  query<T>(sql: string, values?: readonly unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

const CREATE_META_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS db_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;

const MIGRATION_V1_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY NOT NULL,
    chordpro_content TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    key TEXT,
    capo INTEGER,
    search_text TEXT NOT NULL,
    source_provider TEXT,
    source_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE INDEX IF NOT EXISTS idx_songs_updated_at ON songs(updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_songs_source_url ON songs(source_url);`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
    song_id UNINDEXED,
    title_norm,
    artist_norm,
    search_text
  );`,
  `INSERT OR REPLACE INTO db_meta (key, value) VALUES ('schema_version', '1');`,
];

function sanitizeSqlValues(values: readonly unknown[]): unknown[] {
  return values.map((value) => (value === undefined ? null : value));
}

function buildFtsMatchExpression(tokens: readonly string[]): string {
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}

/**
 * Native SQLite + FTS5 storage adapter implementing `SongStorageAdapter`.
 */
export class SqliteSongStorageAdapter implements SongStorageAdapter {
  private readonly executor: SqliteExecutor;

  constructor(executor: SqliteExecutor) {
    this.executor = executor;
  }

  async init(): Promise<void> {
    await this.executor.open();
    await this.executor.execute(CREATE_META_TABLE_SQL);

    const version = await this.getSchemaVersion();
    if (version < SCHEMA_VERSION) {
      for (const statement of MIGRATION_V1_STATEMENTS) {
        await this.executor.execute(statement);
      }
    }
  }

  async getSchemaVersion(): Promise<number> {
    const rows = await this.executor.query<{ value: string }>(
      "SELECT value FROM db_meta WHERE key = 'schema_version'",
    );
    const parsed = Number.parseInt(rows[0]?.value ?? '0', 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  async getById(id: string): Promise<SongRow | null> {
    const rows = await this.executor.query<SongRow>(
      'SELECT * FROM songs WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  }

  async getBySourceUrl(sourceUrl: string): Promise<SongRow | null> {
    const rows = await this.executor.query<SongRow>(
      `SELECT * FROM songs
       WHERE source_url = ?
       ORDER BY (deleted_at IS NULL) DESC, updated_at DESC
       LIMIT 1`,
      [sourceUrl],
    );
    return rows[0] ?? null;
  }

  async listActive(): Promise<SongRow[]> {
    return this.executor.query<SongRow>(
      `SELECT * FROM songs
       WHERE deleted_at IS NULL
       ORDER BY title COLLATE NOCASE ASC, artist COLLATE NOCASE ASC`,
    );
  }

  async searchActive(normalizedTokens: readonly string[]): Promise<SongRow[]> {
    if (normalizedTokens.length === 0) {
      return this.listActive();
    }

    const matchExpression = buildFtsMatchExpression(normalizedTokens);
    return this.executor.query<SongRow>(
      `SELECT s.*
       FROM songs_fts f
       JOIN songs s ON s.id = f.song_id
       WHERE songs_fts MATCH ? AND s.deleted_at IS NULL
       ORDER BY bm25(songs_fts, 0.0, 10.0, 5.0, 1.0) ASC, s.title COLLATE NOCASE ASC`,
      [matchExpression],
    );
  }

  async upsert(row: SongRow): Promise<void> {
    await this.executor.run(
      `INSERT INTO songs (
        id, chordpro_content, title, artist, key, capo, search_text,
        source_provider, source_url, created_at, updated_at, deleted_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        chordpro_content = excluded.chordpro_content,
        title = excluded.title,
        artist = excluded.artist,
        key = excluded.key,
        capo = excluded.capo,
        search_text = excluded.search_text,
        source_provider = excluded.source_provider,
        source_url = excluded.source_url,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        is_dirty = excluded.is_dirty`,
      sanitizeSqlValues([
        row.id,
        row.chordpro_content,
        row.title,
        row.artist,
        row.key,
        row.capo,
        row.search_text,
        row.source_provider,
        row.source_url,
        row.created_at,
        row.updated_at,
        row.deleted_at,
        row.is_dirty,
      ]),
    );

    await this.executor.run('DELETE FROM songs_fts WHERE song_id = ?', [row.id]);

    if (row.deleted_at === null) {
      await this.executor.run(
        `INSERT INTO songs_fts (song_id, title_norm, artist_norm, search_text)
         VALUES (?, ?, ?, ?)`,
        [
          row.id,
          normalizeSearchText(row.title),
          normalizeSearchText(row.artist),
          row.search_text,
        ],
      );
    }
  }

  async close(): Promise<void> {
    await this.executor.close();
  }
}

function createCapacitorSqliteExecutor(dbName: string = DB_NAME): SqliteExecutor {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  let db: SQLiteDBConnection | null = null;

  const ensureConnection = async (): Promise<SQLiteDBConnection> => {
    if (db) {
      return db;
    }

    const consistency = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(dbName, false)).result;
    db =
      consistency.result && isConn
        ? await sqlite.retrieveConnection(dbName, false)
        : await sqlite.createConnection(dbName, false, 'no-encryption', SCHEMA_VERSION, false);

    const openState = await db.isDBOpen();
    if (!openState.result) {
      await db.open();
    }

    return db;
  };

  return {
    async open(): Promise<void> {
      await ensureConnection();
    },

    async execute(sql: string): Promise<void> {
      const conn = await ensureConnection();
      await conn.execute(sql, false);
    },

    async run(sql: string, values: readonly unknown[] = []): Promise<void> {
      const conn = await ensureConnection();
      // Pass transaction=false to prevent nested transaction failures in CapacitorSQLite.
      await conn.run(sql, sanitizeSqlValues(values), false);
    },

    async query<T>(sql: string, values: readonly unknown[] = []): Promise<T[]> {
      const conn = await ensureConnection();
      const result = await conn.query(sql, sanitizeSqlValues(values));
      return (result.values ?? []) as T[];
    },

    async close(): Promise<void> {
      if (!db) {
        return;
      }
      await sqlite.closeConnection(dbName, false);
      db = null;
    },
  };
}

export function createCapacitorSqliteAdapter(dbName: string = DB_NAME): SongStorageAdapter {
  return new SqliteSongStorageAdapter(createCapacitorSqliteExecutor(dbName));
}
