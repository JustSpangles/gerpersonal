import { openDatabase, type Db } from './database.ts';
import { defaultMigrationDirs, findMigrations, migrate } from './migrate.ts';

/** Base en memoria con todas las migraciones aplicadas (solo para tests). */
export function createTestDb(): Db {
  const db = openDatabase(':memory:');
  migrate(db, findMigrations(defaultMigrationDirs()));
  return db;
}
