import { DatabaseSync } from 'node:sqlite';
import type * as SQLite from 'expo-sqlite';

import { runMigrations } from '../migrations';
import { seedDatabaseWith, type ISeedData } from '../seed';
import type { IDataVersion } from '../data-version';

/**
 * Real in-memory SQLite for database tests.
 *
 * expo-sqlite cannot run under Node, so the tests drive node:sqlite through an
 * adapter exposing the same subset of the API the production code uses. That keeps
 * the SQL itself under test, including the FTS5 index, instead of asserting on
 * query strings.
 */
const adapt = (db: DatabaseSync): SQLite.SQLiteDatabase =>
  ({
    execSync: (sql: string) => db.exec(sql),

    getAllSync: (sql: string, ...params: unknown[]) =>
      db.prepare(sql).all(...(params as never[])),

    getFirstSync: (sql: string, ...params: unknown[]) =>
      db.prepare(sql).get(...(params as never[])) ?? null,

    runSync: (sql: string, ...params: unknown[]) => db.prepare(sql).run(...(params as never[])),

    prepareSync: (sql: string) => {
      const statement = db.prepare(sql);
      return {
        executeSync: (...params: unknown[]) => statement.run(...(params as never[])),
        finalizeSync: () => undefined,
      };
    },

    withTransactionSync: (fn: () => void) => {
      db.exec('BEGIN');
      try {
        fn();
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  }) as unknown as SQLite.SQLiteDatabase;

export const EMPTY_SEED: ISeedData = {
  substances: [],
  ericards: [],
};

export interface ITestDatabaseOptions {
  /**
   * Enforce foreign keys. Off by default to mirror expo-sqlite, which does not enforce
   * them either. Switch it on to prove the schema would survive enforcement.
   */
  foreignKeys?: boolean;
}

/** Migrated, seeded in-memory database. */
export const createTestDatabase = (
  data: Partial<ISeedData> = {},
  version: IDataVersion = { fixture: '1' },
  options: ITestDatabaseOptions = {}
): SQLite.SQLiteDatabase => {
  const raw = new DatabaseSync(':memory:', {
    enableForeignKeyConstraints: options.foreignKeys ?? false,
  });
  const db = adapt(raw);
  runMigrations(db);
  seedDatabaseWith(db, { ...EMPTY_SEED, ...data }, version);
  return db;
};

type ERICardSeed = ISeedData['ericards'][number];

/** ERICard row with the fields a test does not care about prefilled. */
export const ericard = (overrides: Partial<ERICardSeed>): ERICardSeed => ({
  un_number: '1203',
  substance_name: 'BENZIN',
  ericard_id: '3-01',
  immediate_actions: JSON.stringify(['Zündquellen ausschließen']),
  firefighting: JSON.stringify(['Schaum']),
  personal_protection: JSON.stringify(['Chemikalienschutzanzug']),
  first_aid: JSON.stringify(['Betroffene an die frische Luft bringen']),
  spillage: JSON.stringify(['Eindämmen']),
  hazards: JSON.stringify(['Leicht entzündbar']),
  physical_properties: JSON.stringify(['Farblose Flüssigkeit']),
  evacuation_distance_m: null,
  water_hazard_class: null,
  ...overrides,
});

type SubstanceSeed = ISeedData['substances'][number];

/** Substance row with the fields a test does not care about prefilled. */
export const substance = (overrides: Partial<SubstanceSeed>): SubstanceSeed => ({
  un_number: '1203',
  name_de: 'BENZIN',
  name_en: 'GASOLINE',
  cas_number: null,
  hazard_class: '3',
  hazard_class_name: null,
  kemler_number: '33',
  packing_group: 'II',
  tunnel_code: null,
  special_provisions: null,
  labels: null,
  ...overrides,
});
