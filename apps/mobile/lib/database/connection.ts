import * as SQLite from 'expo-sqlite';

const DB_NAME = 'cbrn-buddy.db';

let database: SQLite.SQLiteDatabase | null = null;

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!database) {
    database = SQLite.openDatabaseSync(DB_NAME);
  }
  return database;
};

export const closeDatabase = (): void => {
  if (database) {
    database.closeSync();
    database = null;
  }
};
