import type * as SQLite from 'expo-sqlite';

import { needsReseed, serializeDataVersion, type IDataVersion } from './data-version';

import substancesData from '../../assets/data/substances.json';
import ericardsData from '../../assets/data/ericards.json';
import dataVersion from '../../assets/data/data-version.json';

interface ISubstance {
  un_number: string;
  name_de: string;
  name_en: string | null;
  cas_number: string | null;
  hazard_class: string;
  hazard_class_name: string | null;
  kemler_number: string | null;
  packing_group: string | null;
  tunnel_code: string | null;
  special_provisions: string | null;
  labels: string | null;
}

interface IERICard {
  un_number: string;
  substance_name: string;
  ericard_id: string;
  immediate_actions: string;
  firefighting: string;
  personal_protection: string;
  first_aid: string;
  spillage: string;
  hazards: string;
  physical_properties: string;
  evacuation_distance_m: number | null;
  water_hazard_class: string | null;
}

export interface ISeedData {
  substances: ISubstance[];
  ericards: IERICard[];
}

/** Key of the single row in data_version. */
const VERSION_KEY = 'reference-data';

const readStoredVersion = (db: SQLite.SQLiteDatabase): string | null => {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM data_version WHERE key = ?',
    VERSION_KEY
  );
  return row?.value ?? null;
};

const clearSeedTables = (db: SQLite.SQLiteDatabase): void => {
  db.execSync(`
    DELETE FROM substances;
    DELETE FROM ericards;
  `);
};

const seedSubstances = (db: SQLite.SQLiteDatabase, rows: ISubstance[]): void => {
  const stmt = db.prepareSync(
    `INSERT INTO substances (un_number, name_de, name_en, cas_number, hazard_class,
     hazard_class_name, kemler_number, packing_group, tunnel_code, special_provisions, labels)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    for (const s of rows) {
      stmt.executeSync(
        s.un_number, s.name_de, s.name_en, s.cas_number, s.hazard_class,
        s.hazard_class_name, s.kemler_number, s.packing_group, s.tunnel_code,
        s.special_provisions, s.labels
      );
    }
  } finally {
    stmt.finalizeSync();
  }
};

const seedERICards = (db: SQLite.SQLiteDatabase, rows: IERICard[]): void => {
  const stmt = db.prepareSync(
    `INSERT INTO ericards (un_number, substance_name, ericard_id, immediate_actions,
     firefighting, personal_protection, first_aid, spillage, hazards,
     physical_properties, evacuation_distance_m, water_hazard_class)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    for (const e of rows) {
      stmt.executeSync(
        e.un_number, e.substance_name, e.ericard_id, e.immediate_actions,
        e.firefighting, e.personal_protection, e.first_aid, e.spillage,
        e.hazards, e.physical_properties, e.evacuation_distance_m,
        e.water_hazard_class
      );
    }
  } finally {
    stmt.finalizeSync();
  }
};

/**
 * Load the reference data when its version differs from the one stored in the
 * database. Returns true when seeding happened.
 */
export const seedDatabaseWith = (
  db: SQLite.SQLiteDatabase,
  data: ISeedData,
  version: IDataVersion
): boolean => {
  if (!needsReseed(readStoredVersion(db), version)) {
    return false;
  }

  db.withTransactionSync(() => {
    // An update replaces everything: a substance can change class, Kemler number or
    // packing group, and merging would leave the superseded values in place.
    clearSeedTables(db);

    seedSubstances(db, data.substances);
    seedERICards(db, data.ericards);

    db.execSync("INSERT INTO substances_fts(substances_fts) VALUES('rebuild')");

    db.runSync(
      `INSERT INTO data_version (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      VERSION_KEY,
      serializeDataVersion(version)
    );
  });

  return true;
};

export const seedDatabase = (db: SQLite.SQLiteDatabase): boolean =>
  seedDatabaseWith(
    db,
    {
      substances: substancesData as ISubstance[],
      ericards: ericardsData as IERICard[],
    },
    dataVersion as IDataVersion
  );
