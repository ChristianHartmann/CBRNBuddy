import type * as SQLite from 'expo-sqlite';

import { createDatabaseUnLookup } from '../un-lookup';
import { createTestDatabase, substance } from '../../database/__tests__/test-db';

const FIXTURE = [substance({ un_number: '1203', name_de: 'BENZIN' })];

/** Database that fails on every query, standing in for one that is not ready yet. */
const brokenDb = (): SQLite.SQLiteDatabase =>
  ({
    getAllSync: () => {
      throw new Error('database closed');
    },
  }) as unknown as SQLite.SQLiteDatabase;

describe('createDatabaseUnLookup', () => {
  it('confirms a UN number the database knows', () => {
    const isKnownUn = createDatabaseUnLookup(createTestDatabase({ substances: FIXTURE }));

    expect(isKnownUn('1203')).toBe(true);
  });

  it('denies a UN number the database does not know', () => {
    const isKnownUn = createDatabaseUnLookup(createTestDatabase({ substances: FIXTURE }));

    expect(isKnownUn('9999')).toBe(false);
  });

  it('asks the database only once per UN number', () => {
    let queries = 0;
    const counting = {
      getAllSync: (...args: unknown[]) => {
        queries += 1;
        return createTestDatabase({ substances: FIXTURE }).getAllSync(
          ...(args as Parameters<SQLite.SQLiteDatabase['getAllSync']>)
        );
      },
    } as unknown as SQLite.SQLiteDatabase;
    const isKnownUn = createDatabaseUnLookup(counting);

    isKnownUn('1203');
    isKnownUn('1203');
    isKnownUn('1203');

    expect(queries).toBe(1);
  });

  it('fails open when the database is unavailable, so a valid reading is not discarded', () => {
    const isKnownUn = createDatabaseUnLookup(brokenDb());

    expect(isKnownUn('1203')).toBe(true);
  });

  it('does not remember a failure, so a later working lookup still counts', () => {
    let broken = true;
    const flaky = {
      getAllSync: (...args: unknown[]) => {
        if (broken) {
          throw new Error('database closed');
        }
        return createTestDatabase({ substances: FIXTURE }).getAllSync(
          ...(args as Parameters<SQLite.SQLiteDatabase['getAllSync']>)
        );
      },
    } as unknown as SQLite.SQLiteDatabase;
    const isKnownUn = createDatabaseUnLookup(flaky);

    expect(isKnownUn('9999')).toBe(true); // failed open
    broken = false;

    expect(isKnownUn('9999')).toBe(false); // now actually answered
  });
});
