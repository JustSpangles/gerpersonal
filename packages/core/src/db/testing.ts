import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMediaStore, type MediaStore } from '../records/media.ts';
import { openDatabase, type Db } from './database.ts';
import { defaultMigrationDirs, findMigrations, migrate } from './migrate.ts';

/** Base en memoria con todas las migraciones aplicadas (solo para tests). */
export function createTestDb(): Db {
  const db = openDatabase(':memory:');
  migrate(db, findMigrations(defaultMigrationDirs()));
  return db;
}

/**
 * Carpeta de fotos temporal (solo para tests). No crea nada hasta que se
 * guarda una foto; al terminar, `removeTestMedia(media)`.
 */
export function createTestMedia(): MediaStore {
  return createMediaStore(join(tmpdir(), `ger-test-media-${randomUUID()}`));
}

export function removeTestMedia(media: MediaStore): void {
  rmSync(media.dir, { recursive: true, force: true });
}
