import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../db/database.ts';
import { defaultMigrationDirs, findMigrations, migrate } from '../db/migrate.ts';
import { nextCode } from './codes.ts';

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db, findMigrations(defaultMigrationDirs()));
});

afterEach(() => db.close());

describe('nextCode', () => {
  it('numera de forma correlativa por prefijo', () => {
    expect(nextCode(db, 'C')).toBe('C1');
    expect(nextCode(db, 'C')).toBe('C2');
    expect(nextCode(db, 'F')).toBe('F1');
    expect(nextCode(db, 'C')).toBe('C3');
  });

  it('no depende de los registros: los números no se reutilizan', () => {
    nextCode(db, 'S');
    nextCode(db, 'S');
    // Aunque se borren registros, el contador sigue.
    expect(nextCode(db, 'S')).toBe('S3');
  });

  it('rechaza prefijos inválidos sin tocar los contadores', () => {
    expect(() => nextCode(db, 'cc')).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM counters').get()).toEqual({ n: 0 });
  });
});
