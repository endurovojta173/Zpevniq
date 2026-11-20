import { type ChordProPreviewLine, parseChordProPreview } from '../core/chordpro/preview';
import type { SavedSong } from '../core/types/song';
import { normalizeSearchText } from '../core/utils/normalize';

export const SCHEMA_VERSION = 1;
export const DB_NAME = 'zpevniq';
export const DEFAULT_SONG_TITLE = 'Bez názvu';

export interface SongRow {
  readonly id: string;
  readonly chordpro_content: string;
  readonly title: string;
  readonly artist: string;
  readonly key: string | null;
  readonly capo: number | null;
  readonly search_text: string;
  readonly source_provider: string | null;
  readonly source_url: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
  readonly is_dirty: number;
}

export interface DerivedSongProjections {
  readonly title: string;
  readonly artist: string;
  readonly key: string | null;
  readonly capo: number | null;
  readonly titleNorm: string;
  readonly artistNorm: string;
  readonly searchText: string;
}

function isLyricLine(
  line: ChordProPreviewLine,
): line is Extract<ChordProPreviewLine, { kind: 'lyric' }> {
  return line.kind === 'lyric';
}

/**
 * Derives indexed database projections strictly from the canonical ChordPro content.
 */
export function deriveSongProjections(chordproContent: string): DerivedSongProjections {
  const parsed = parseChordProPreview(chordproContent);
  const title = parsed.title?.trim() || DEFAULT_SONG_TITLE;
  const artist = parsed.artist?.trim() ?? '';
  const key = parsed.key?.trim() || null;
  const capo = parsed.capo ?? null;

  const plainLyrics = parsed.lines
    .filter(isLyricLine)
    .map((line) => line.segments.map((segment) => segment.lyric).join(''))
    .join(' ');

  return {
    title,
    artist,
    key,
    capo,
    titleNorm: normalizeSearchText(title),
    artistNorm: normalizeSearchText(artist),
    searchText: normalizeSearchText(`${title} ${artist} ${plainLyrics}`),
  };
}

/**
 * Converts a persisted database row into the domain `SavedSong` model.
 */
export function rowToSavedSong(row: SongRow): SavedSong {
  return {
    id: row.id,
    chordproContent: row.chordpro_content,
    title: row.title,
    artist: row.artist,
    key: row.key,
    capo: row.capo,
    sourceProvider: row.source_provider,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    isDirty: row.is_dirty !== 0,
  };
}

/**
 * Normalizes and tokenizes a user search query into safe alphanumeric prefix tokens
 * shared by both SQLite FTS5 and Web IndexedDB search.
 */
export function tokenizeSearchQuery(query: string): string[] {
  const cleaned = normalizeSearchText(query).replace(/[^a-z0-9]+/g, ' ').trim();
  if (cleaned.length === 0) {
    return [];
  }
  return cleaned.split(/\s+/).filter((token) => token.length > 0);
}
