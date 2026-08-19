import type * as SQLite from 'expo-sqlite';

import { seedDatabaseWith, type ISeedData } from '../seed';
import type { IDataVersion } from '../data-version';

const DATA: ISeedData = {
  substances: [
    {
      un_number: '3423',
      name_de: 'TETRAMETHYLAMMONIUMHYDROXID, FEST',
      name_en: null,
      cas_number: null,
      hazard_class: '6.1',
      hazard_class_name: null,
      kemler_number: '668',
      packing_group: 'I',
      tunnel_code: 'C/E',
      special_provisions: null,
      labels: '6.1',
    },
  ],
  ericards: [],
};

const VERSION: IDataVersion = { substances: 'v2' };

/** Records the SQL issued. `storedVersion` stands in for what the device holds. */
const createFakeDb = (storedVersion: string | null) => {
  const statements: string[] = [];
  const inserted: unknown[][] = [];

  const db = {
    getFirstSync: (sql: string) => {
      statements.push(sql);
      return storedVersion === null ? null : { value: storedVersion };
    },
    execSync: (sql: string) => {
      statements.push(sql);
    },
    runSync: (sql: string, ..._params: unknown[]) => {
      statements.push(sql);
    },
    prepareSync: (sql: string) => {
      statements.push(sql);
      return {
        executeSync: (...params: unknown[]) => {
          inserted.push(params);
        },
        finalizeSync: () => undefined,
      };
    },
    withTransactionSync: (fn: () => void) => fn(),
  } as unknown as SQLite.SQLiteDatabase;

  return { db, statements, inserted };
};

const sqlText = (statements: string[]): string => statements.join('\n').toUpperCase();

describe('seedDatabaseWith', () => {
  it('seeds a fresh database', () => {
    const { db, inserted } = createFakeDb(null);

    expect(seedDatabaseWith(db, DATA, VERSION)).toBe(true);
    expect(inserted).toHaveLength(1);
  });

  it('does not seed again when the data version is unchanged', () => {
    const stored = JSON.stringify([['substances', 'v2']]);
    const { db, inserted } = createFakeDb(stored);

    expect(seedDatabaseWith(db, DATA, VERSION)).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it('clears the previous reference data before loading a new version', () => {
    const stored = JSON.stringify([['substances', 'v1']]);
    const { db, statements, inserted } = createFakeDb(stored);

    expect(seedDatabaseWith(db, DATA, VERSION)).toBe(true);

    const sql = sqlText(statements);
    expect(sql).toContain('DELETE FROM SUBSTANCES');
    expect(sql).toContain('DELETE FROM ERICARDS');
    expect(inserted).toHaveLength(1);
  });

  it('keeps the full text index current after an update', () => {
    const stored = JSON.stringify([['substances', 'v1']]);
    const { db, statements } = createFakeDb(stored);

    seedDatabaseWith(db, DATA, VERSION);

    expect(sqlText(statements)).toContain('REBUILD');
  });

  it('stores the new data version so the next start does not seed again', () => {
    const { db, statements } = createFakeDb(null);

    seedDatabaseWith(db, DATA, VERSION);

    expect(sqlText(statements)).toContain('DATA_VERSION');
  });
});
