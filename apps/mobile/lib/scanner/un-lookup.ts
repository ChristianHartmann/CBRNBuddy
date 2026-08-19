import type * as SQLite from 'expo-sqlite';

import { getSubstancesByUnNumber } from '../database/hazmat-repository';
import type { UnNumberValidator } from './placard-pairing';

/**
 * The one place where the scanner meets the substance database.
 *
 * Everything else under lib/scanner works on an injected `UnNumberValidator` and knows
 * nothing about SQLite. Replacing this single adapter is enough to run the scanner
 * against a different source, which is what a stripped down copy of this project needs.
 *
 * Create one per scan: the memo is scoped to the returned function, so a database
 * update between scans takes effect without anything having to be cleared.
 */
export const createDatabaseUnLookup = (db: SQLite.SQLiteDatabase): UnNumberValidator => {
  const answered = new Map<string, boolean>();

  return (unNumber: string): boolean => {
    const remembered = answered.get(unNumber);
    if (remembered !== undefined) {
      return remembered;
    }

    try {
      const known = getSubstancesByUnNumber(db, unNumber).length > 0;
      answered.set(unNumber, known);
      return known;
    } catch (err) {
      // Fail open: a correctly read UN number must not be discarded because the
      // database is unavailable. Deliberately not remembered, so a transient failure
      // does not poison the rest of the scan.
      console.warn('[scanner] UN validation skipped, database unavailable:', err);
      return true;
    }
  };
};
