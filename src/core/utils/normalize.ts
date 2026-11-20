/**
 * Normalizes text for diacritic- and case-insensitive full-text search.
 * Used as the single source of truth by both SQLite FTS5 and IndexedDB indexes.
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
