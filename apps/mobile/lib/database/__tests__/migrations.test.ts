import { migrations } from '../migrations';
import { createTestDatabase, substance } from './test-db';

const ERICARD = {
  un_number: '1203',
  substance_name: 'BENZIN',
  ericard_id: 'ERIC-1-2-3',
  immediate_actions: '[]',
  firefighting: '[]',
  personal_protection: '[]',
  first_aid: '[]',
  spillage: '[]',
  hazards: '[]',
  physical_properties: '[]',
  evacuation_distance_m: 50,
  water_hazard_class: 'WGK 2',
};

describe('schema', () => {
  /**
   * Migration 1 declared ericards.un_number as a foreign key onto
   * substances(un_number), but that column is not unique: 570 UN numbers carry several
   * entries. SQLite rejects such a constraint with "foreign key mismatch" as soon as
   * enforcement is on. It only stays invisible because expo-sqlite leaves enforcement
   * off, so the declaration promised an integrity guarantee that never existed.
   */
  it('survives foreign key enforcement', () => {
    const db = createTestDatabase(
      { substances: [substance({ un_number: '1203' })], ericards: [ERICARD] },
      { fixture: '1' },
      { foreignKeys: true }
    );

    expect(db.getAllSync('SELECT un_number FROM ericards')).toHaveLength(1);
  });

  it('does not carry tables nobody reads', () => {
    // hazard_classes and ghs_pictograms were migrated, seeded and shipped as JSON assets,
    // but never read: the badge takes its colours from constants/hazmat-classes.ts. Two
    // copies of the same reference data, of which the maintained one was the unused one.
    const db = createTestDatabase();

    const tables = db.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    );

    expect(tables.map((t) => t.name)).not.toContain('hazard_classes');
    expect(tables.map((t) => t.name)).not.toContain('ghs_pictograms');
  });

  it('keeps the ericards lookup index', () => {
    const db = createTestDatabase();

    const indexes = db.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ericards'"
    );

    expect(indexes.map((i) => i.name)).toContain('idx_ericards_un');
  });

  it('carries existing ericards through the table rebuild unchanged', () => {
    // Replays the rebuild against a populated table, which the fresh-install path never
    // exercises: seeding happens after the migrations, so the copy would run over an
    // empty table and a wrong column order in the INSERT ... SELECT would go unnoticed
    // until it mangled the data on someone's device.
    const db = createTestDatabase({
      substances: [substance({ un_number: '1203' })],
      ericards: [ERICARD],
    });
    const rebuild = migrations.find((m) => m.version === 5);

    rebuild?.up(db);

    const rows = db.getAllSync<typeof ERICARD>('SELECT * FROM ericards');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(ERICARD);
  });

  it('keeps ericards readable by UN number after migrating', () => {
    const db = createTestDatabase({
      substances: [substance({ un_number: '1203' })],
      ericards: [ERICARD],
    });

    const rows = db.getAllSync<{ ericard_id: string }>(
      'SELECT ericard_id FROM ericards WHERE un_number = ?',
      '1203'
    );

    expect(rows[0]?.ericard_id).toBe('ERIC-1-2-3');
  });
});
