import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './database.ts';
import { defaultMigrationDirs, findMigrations, migrate, MigrationError } from './migrate.ts';

let tmp: string;
let db: Db;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ger-migrate-'));
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

function dir(name: string, files: Record<string, string>): string {
  const path = join(tmp, name);
  mkdirSync(path, { recursive: true });
  for (const [file, sql] of Object.entries(files)) writeFileSync(join(path, file), sql);
  return path;
}

function tables(db: Db): string[] {
  const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).all() as { name: string }[];
  return rows.map((row) => row.name);
}

describe('migraciones', () => {
  it('las migraciones reales del proyecto se aplican sobre una base vacía', () => {
    const { applied } = migrate(db, findMigrations(defaultMigrationDirs()));
    expect(applied.map((m) => m.name)).toContain('001_init.sql');
    expect(tables(db)).toEqual(expect.arrayContaining(['attachments', 'counters', 'schema_migrations']));
  });

  it('ordena por número aunque estén en carpetas distintas y no repite', () => {
    const comunes = dir('db', { '001_init.sql': 'CREATE TABLE a (x INTEGER);', '003_c.sql': 'CREATE TABLE c (x INTEGER);' });
    const area = dir('areas/finanzas/migrations', { '002_finanzas.sql': 'CREATE TABLE b (x INTEGER);' });
    const migrations = findMigrations([comunes, area]);
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 3]);

    expect(migrate(db, migrations).applied).toHaveLength(3);
    expect(migrate(db, migrations).applied).toHaveLength(0);
    expect(tables(db)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('aplica solo las nuevas', () => {
    const d = dir('db', { '001_init.sql': 'CREATE TABLE a (x INTEGER);' });
    migrate(db, findMigrations([d]));
    writeFileSync(join(d, '002_b.sql'), 'CREATE TABLE b (x INTEGER);');
    expect(migrate(db, findMigrations([d])).applied.map((m) => m.name)).toEqual(['002_b.sql']);
  });

  it('no arranca si se editó una migración ya aplicada', () => {
    const d = dir('db', { '001_init.sql': 'CREATE TABLE a (x INTEGER);' });
    migrate(db, findMigrations([d]));
    writeFileSync(join(d, '001_init.sql'), 'CREATE TABLE a (x INTEGER, y TEXT);');
    expect(() => migrate(db, findMigrations([d]))).toThrow(/cambió después de aplicarse/);
  });

  it('los fines de línea Windows/Linux no cuentan como edición', () => {
    const d = dir('db', { '001_init.sql': 'CREATE TABLE a (x INTEGER);\nCREATE TABLE b (x INTEGER);\n' });
    migrate(db, findMigrations([d]));
    writeFileSync(join(d, '001_init.sql'), 'CREATE TABLE a (x INTEGER);\r\nCREATE TABLE b (x INTEGER);\r\n');
    expect(migrate(db, findMigrations([d])).applied).toHaveLength(0);
  });

  it('rechaza números repetidos entre carpetas', () => {
    const a = dir('db', { '002_x.sql': 'SELECT 1;' });
    const b = dir('areas/gimnasio/migrations', { '002_gimnasio.sql': 'SELECT 1;' });
    expect(() => findMigrations([a, b])).toThrow(/Dos migraciones con el número 2/);
  });

  it('rechaza nombres mal formados', () => {
    expect(() => findMigrations([dir('db', { '2_x.sql': 'SELECT 1;' })])).toThrow(MigrationError);
  });

  it('una migración con error no deja nada a medias', () => {
    const d = dir('db', { '001_init.sql': 'CREATE TABLE a (x INTEGER); CREATE TABLE a (x INTEGER);' });
    expect(() => migrate(db, findMigrations([d]))).toThrow();
    expect(tables(db)).toEqual(['schema_migrations']);
  });

  it('no arranca si la base tiene migraciones que el código no conoce', () => {
    const d = dir('db', { '001_init.sql': 'SELECT 1;', '002_b.sql': 'SELECT 1;' });
    migrate(db, findMigrations([d]));
    rmSync(join(d, '002_b.sql'));
    expect(() => migrate(db, findMigrations([d]))).toThrow(/no conoce/);
  });
});
