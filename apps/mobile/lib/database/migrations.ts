import type * as SQLite from 'expo-sqlite';

interface IMigration {
  version: number;
  up: (db: SQLite.SQLiteDatabase) => void;
}

/** Exported so tests can replay a single step against a populated database. */
export const migrations: IMigration[] = [
  {
    version: 1,
    up: (db) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS substances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          un_number TEXT NOT NULL,
          name_de TEXT NOT NULL,
          name_en TEXT,
          cas_number TEXT,
          hazard_class TEXT NOT NULL,
          hazard_class_name TEXT,
          kemler_number TEXT,
          packing_group TEXT,
          tunnel_code TEXT,
          special_provisions TEXT,
          labels TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_substances_un ON substances(un_number);
        CREATE INDEX IF NOT EXISTS idx_substances_name ON substances(name_de);
        CREATE INDEX IF NOT EXISTS idx_substances_kemler ON substances(kemler_number);
        CREATE INDEX IF NOT EXISTS idx_substances_cas ON substances(cas_number);

        CREATE TABLE IF NOT EXISTS ericards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          un_number TEXT NOT NULL,
          substance_name TEXT,
          ericard_id TEXT,
          immediate_actions TEXT,
          firefighting TEXT,
          personal_protection TEXT,
          first_aid TEXT,
          spillage TEXT,
          hazards TEXT,
          physical_properties TEXT,
          evacuation_distance_m INTEGER,
          water_hazard_class TEXT,
          FOREIGN KEY (un_number) REFERENCES substances(un_number)
        );

        CREATE INDEX IF NOT EXISTS idx_ericards_un ON ericards(un_number);

        CREATE TABLE IF NOT EXISTS hazard_classes (
          class_code TEXT PRIMARY KEY,
          name_de TEXT NOT NULL,
          name_en TEXT,
          color TEXT,
          placard_description TEXT
        );

        CREATE TABLE IF NOT EXISTS ghs_pictograms (
          code TEXT PRIMARY KEY,
          name_de TEXT NOT NULL,
          hazard_de TEXT,
          signal_word TEXT
        );

        CREATE TABLE IF NOT EXISTS ai_queries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query_date TEXT NOT NULL,
          query_count INTEGER DEFAULT 0
        );
      `);
    },
  },
  {
    version: 2,
    up: (db) => {
      db.execSync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS substances_fts USING fts5(
          un_number,
          name_de,
          kemler_number,
          cas_number,
          content='substances',
          content_rowid='id'
        );

        -- Rebuild FTS with existing data
        INSERT INTO substances_fts(substances_fts) VALUES('rebuild');
      `);
    },
  },
  {
    version: 3,
    up: (db) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS data_version (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 4,
    up: (db) => {
      // ai_queries held a per-day quota for a chat feature that no longer exists, so
      // nothing writes to it. Dropped here rather than removed from migration 1, so
      // databases already on devices are migrated instead of silently diverging from
      // the schema in this file.
      db.execSync('DROP TABLE IF EXISTS ai_queries;');
    },
  },
  {
    version: 5,
    up: (db) => {
      // Migration 1 declared ericards.un_number as a foreign key onto
      // substances(un_number). That column is not unique, and cannot be: 570 UN numbers
      // carry several entries. SQLite rejects such a parent key with "foreign key
      // mismatch" the moment enforcement is switched on, so the constraint never held
      // anything together and only looked like it did. SQLite cannot drop a constraint
      // in place, hence the copy and rename. The index goes with the dropped table and
      // has to be recreated.
      db.execSync(`
        CREATE TABLE ericards_rebuilt (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          un_number TEXT NOT NULL,
          substance_name TEXT,
          ericard_id TEXT,
          immediate_actions TEXT,
          firefighting TEXT,
          personal_protection TEXT,
          first_aid TEXT,
          spillage TEXT,
          hazards TEXT,
          physical_properties TEXT,
          evacuation_distance_m INTEGER,
          water_hazard_class TEXT
        );

        INSERT INTO ericards_rebuilt
          SELECT id, un_number, substance_name, ericard_id, immediate_actions,
                 firefighting, personal_protection, first_aid, spillage, hazards,
                 physical_properties, evacuation_distance_m, water_hazard_class
          FROM ericards;

        DROP TABLE ericards;
        ALTER TABLE ericards_rebuilt RENAME TO ericards;

        CREATE INDEX IF NOT EXISTS idx_ericards_un ON ericards(un_number);
      `);
    },
  },
  {
    version: 6,
    up: (db) => {
      // hazard_classes and ghs_pictograms were seeded from JSON assets but never read:
      // the UI takes hazard class names and colours from constants/hazmat-classes.ts.
      // Holding the same reference data twice, with the unused copy being the one that
      // was maintained, is worse than holding it once.
      db.execSync(`
        DROP TABLE IF EXISTS hazard_classes;
        DROP TABLE IF EXISTS ghs_pictograms;
      `);
    },
  },
];

export const runMigrations = (db: SQLite.SQLiteDatabase): void => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const result = db.getFirstSync<{ version: number }>(
    'SELECT MAX(version) as version FROM schema_version'
  );
  const currentVersion = result?.version ?? 0;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.withTransactionSync(() => {
        migration.up(db);
        db.runSync(
          'INSERT INTO schema_version (version) VALUES (?)',
          migration.version
        );
      });
    }
  }
};
