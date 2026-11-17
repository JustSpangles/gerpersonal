import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transaction, type Db } from './database.ts';

/**
 * Migraciones numeradas con una sola secuencia global (001, 002, 003…).
 *
 * Los archivos pueden estar en `src/db/migrations/` (tablas comunes) o en
 * `src/areas/<area>/migrations/` (tablas de cada área), así un área nueva no
 * toca nada fuera de su carpeta. El número tiene que ser único en todo el
 * proyecto: si dos archivos comparten número, el núcleo no arranca.
 *
 * Una migración aplicada NUNCA se edita: se guarda su checksum y, si el
 * archivo cambia, el núcleo no arranca. Para cambiar algo, migración nueva.
 */

export interface Migration {
  version: number;
  name: string;
  file: string;
  sql: string;
  checksum: string;
}

const FILE_PATTERN = /^(\d{3,})_([a-z0-9_-]+)\.sql$/;

export class MigrationError extends Error {
  override name = 'MigrationError';
}

const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Carpetas de migraciones del núcleo: comunes + una por área. */
export function defaultMigrationDirs(srcDir = SRC_DIR): string[] {
  const dirs = [join(srcDir, 'db', 'migrations')];
  const areasDir = join(srcDir, 'areas');
  if (existsSync(areasDir)) {
    for (const entry of readdirSync(areasDir, { withFileTypes: true })) {
      const dir = join(areasDir, entry.name, 'migrations');
      if (entry.isDirectory() && existsSync(dir)) dirs.push(dir);
    }
  }
  return dirs;
}

export function findMigrations(dirs: string[]): Migration[] {
  const migrations: Migration[] = [];
  const seen = new Map<number, string>();

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith('.sql')) continue;
      const match = FILE_PATTERN.exec(name);
      if (!match) {
        throw new MigrationError(`Nombre de migración inválido: ${join(dir, name)} (usar 003_algo.sql)`);
      }
      const version = Number(match[1]);
      const file = join(dir, name);
      const other = seen.get(version);
      if (other) throw new MigrationError(`Dos migraciones con el número ${version}: ${other} y ${file}`);
      seen.set(version, file);

      // Los fines de línea no cuentan: el repo puede estar en Windows o en Android.
      const sql = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      migrations.push({ version, name, file, sql, checksum: sha256(sql) });
    }
  }

  return migrations.sort((a, b) => a.version - b.version);
}

/** Aplica las migraciones pendientes, cada una en su transacción. */
export function migrate(db: Db, migrations: Migration[]): { applied: Migration[] } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT
  `);

  const rows = db.prepare('SELECT version, name, checksum FROM schema_migrations').all() as {
    version: number;
    name: string;
    checksum: string;
  }[];
  const done = new Map(rows.map((row) => [row.version, row]));
  const known = new Set(migrations.map((m) => m.version));

  const unknown = rows.filter((row) => !known.has(row.version));
  if (unknown.length > 0) {
    const names = unknown.map((row) => row.name).join(', ');
    throw new MigrationError(`La base tiene migraciones que este código no conoce (${names}). ¿Código desactualizado?`);
  }

  for (const migration of migrations) {
    const row = done.get(migration.version);
    if (row && row.checksum !== migration.checksum) {
      throw new MigrationError(
        `La migración ${migration.name} cambió después de aplicarse. ` +
          'No se editan migraciones aplicadas: volvé el archivo atrás y creá una migración nueva.',
      );
    }
  }

  const applied: Migration[] = [];
  const insert = db.prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)');
  for (const migration of migrations) {
    if (done.has(migration.version)) continue;
    transaction(db, () => {
      db.exec(migration.sql);
      insert.run(migration.version, migration.name, migration.checksum, new Date().toISOString());
    });
    applied.push(migration);
  }
  return { applied };
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
