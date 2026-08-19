import type * as SQLite from 'expo-sqlite';

export interface ISearchResult {
  id: number;
  un_number: string;
  name_de: string;
  name_en: string | null;
  hazard_class: string;
  hazard_class_name: string | null;
  kemler_number: string | null;
  packing_group: string | null;
}

const MAX_RESULTS = 50;

const SEARCH_COLUMNS = `id, un_number, name_de, name_en, hazard_class,
    hazard_class_name, kemler_number, packing_group`;

const FTS_SEARCH_COLUMNS = `s.id, s.un_number, s.name_de, s.name_en, s.hazard_class,
    s.hazard_class_name, s.kemler_number, s.packing_group`;

const dedupeById = (rows: ISearchResult[]): ISearchResult[] => {
  const seen = new Set<number>();
  return rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
};

const likeSearch = (
  db: SQLite.SQLiteDatabase,
  query: string
): ISearchResult[] => {
  return db.getAllSync<ISearchResult>(
    `SELECT ${SEARCH_COLUMNS}
     FROM substances
     WHERE name_de LIKE ? OR kemler_number = ?
     ORDER BY un_number
     LIMIT ?`,
    `%${query}%`,
    query,
    MAX_RESULTS
  );
};

export const searchSubstances = (
  db: SQLite.SQLiteDatabase,
  query: string
): ISearchResult[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  if (/^\d{1,4}$/.test(trimmed)) {
    // Digits are ambiguous: "33" is UN 0033 and the Kemler number of every flammable
    // liquid. Both readings are answered, UN numbers first, since a placard shows the
    // Kemler number above the UN number and either may be what was typed.
    const padded = trimmed.padStart(4, '0');
    const byUnNumber = db.getAllSync<ISearchResult>(
      `SELECT ${SEARCH_COLUMNS}
       FROM substances
       WHERE un_number = ? OR un_number LIKE ?
       ORDER BY un_number
       LIMIT ?`,
      padded,
      `${trimmed}%`,
      MAX_RESULTS
    );

    const byKemler = db.getAllSync<ISearchResult>(
      `SELECT ${SEARCH_COLUMNS}
       FROM substances
       WHERE kemler_number = ?
       ORDER BY un_number
       LIMIT ?`,
      trimmed,
      MAX_RESULTS
    );

    return dedupeById([...byUnNumber, ...byKemler]).slice(0, MAX_RESULTS);
  }

  // Sanitize for FTS5: keep only letters, digits, spaces
  const sanitized = trimmed.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  if (!sanitized) {
    return likeSearch(db, trimmed);
  }

  try {
    const ftsQuery = sanitized + '*';
    const results = db.getAllSync<ISearchResult>(
      `SELECT ${FTS_SEARCH_COLUMNS}
       FROM substances_fts fts
       JOIN substances s ON s.id = fts.rowid
       WHERE substances_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      ftsQuery,
      MAX_RESULTS
    );

    if (results.length === 0) {
      return likeSearch(db, trimmed);
    }

    return results;
  } catch (err) {
    console.warn('[search] FTS query failed, falling back to LIKE:', err);
    return likeSearch(db, trimmed);
  }
};
