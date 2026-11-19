import { existsSync, readFileSync } from 'node:fs';
import { loadAreaRegistry } from '@ger/shared/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteMovimiento } from '../areas/finanzas/service.ts';
import { transaction } from '../db/database.ts';
import { createTestDb, createTestMedia, removeTestMedia } from '../db/testing.ts';
import { buildRecordsRegistry, defineAreaRecords, loadAreaRecords } from './areaRecords.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import {
  attachPhoto,
  createRecord,
  deleteRecord,
  findRecord,
  getRecord,
  listAttachments,
  removeWithAttachments,
  updateRecord,
  type RecordsContext,
} from './service.ts';

// 19/11/2026 13:30 en Buenos Aires.
const NOW = new Date('2026-11-19T16:30:00Z');
const JPG = { data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), mime: 'image/jpeg' };

const areas = await loadAreaRegistry();
const handlers = await loadAreaRecords();
let ctx: RecordsContext;

beforeEach(() => {
  ctx = { db: createTestDb(), records: buildRecordsRegistry(areas, handlers), media: createTestMedia() };
});
afterEach(() => removeTestMedia(ctx.media));

const gasto = (monto: number, categoria = 'comida') =>
  createRecord(ctx, 'finanzas', 'gasto', { tipo: 'egreso', monto, categoria }, NOW).record.code;

describe('registro de registros', () => {
  it('descubre records.ts de cada área y lleva del prefijo del código al área', () => {
    expect([...handlers.keys()]).toEqual(['finanzas']);
    const { records } = ctx;
    expect(records.forCode('f3')?.area.id).toBe('finanzas');
    expect(records.forArea('finanzas')?.area.prefix).toBe('F');
    // Alimentación (C) existe, pero todavía no tiene registros.
    expect(records.forCode('C3')).toBeNull();
    expect(records.forArea('alimentacion')).toBeNull();
    expect(records.forCode('hola')).toBeNull();
  });

  it('verifica que cada comando tenga su función y que nada sobre', () => {
    const noop = () => {
      throw new Error('no se usa');
    };
    const incompleto = defineAreaRecords({ find: () => null, update: noop, delete: noop, commands: { gasto: noop, otro: noop } });
    expect(() => buildRecordsRegistry(areas, new Map([['finanzas', incompleto]]))).toThrow(
      /falta la función del comando "ingreso"[\s\S]*tiene el comando "otro"/,
    );
    expect(() => buildRecordsRegistry(areas, new Map())).toThrow(/finanzas: tiene comandos pero le falta src\/areas\/finanzas\/records\.ts/);
    expect(() => buildRecordsRegistry(areas, new Map([...handlers, ['nada', incompleto]]))).toThrow(/nada: hay records\.ts, pero el área no existe/);
  });
});

describe('operaciones con cualquier código', () => {
  it('crea con un comando y encuentra por código sin importar mayúsculas', () => {
    const created = createRecord(ctx, 'finanzas', 'ingreso', { tipo: 'ingreso', monto: 35000000, categoria: 'sueldo' }, NOW);
    expect(created.area.id).toBe('finanzas');
    expect(created.record).toMatchObject({
      code: 'F1',
      values: { tipo: 'ingreso', monto: 35000000, categoria: 'sueldo', nota: null, fecha: '2026-11-19' },
    });
    expect(findRecord(ctx, 'f1')?.record).toEqual(created.record);
    expect(findRecord(ctx, 'F99')).toBeNull();
    expect(findRecord(ctx, 'C1')).toBeNull();
  });

  it('edita a través del servicio del área, que valida', () => {
    gasto(150000);
    expect(updateRecord(ctx, 'f1', { monto: 200000 }, NOW).record.values.monto).toBe(200000);
    expect(() => updateRecord(ctx, 'F1', { monto: -1 }, NOW)).toThrow(ValidationError);
    expect(() => updateRecord(ctx, 'F9', { monto: 1 }, NOW)).toThrow(NotFoundError);
    expect(() => updateRecord(ctx, 'C1', { nombre: 'x' }, NOW)).toThrow(NotFoundError);
  });

  it('getRecord avisa con el código normalizado', () => {
    expect(() => getRecord(ctx, 'x9')).toThrow('No existe el registro X9');
  });
});

describe('fotos', () => {
  it('se guardan en data/media por mes, con nombre legible, y quedan ligadas al registro', () => {
    gasto(1000);
    const first = attachPhoto(ctx, 'f1', JPG, NOW);
    const second = attachPhoto(ctx, 'F1', { data: new Uint8Array([1]), mime: 'image/png' }, NOW);

    expect(first).toMatchObject({ recordCode: 'F1', filePath: '2026-11/F1_2026-11-19_13-30.jpg', mime: 'image/jpeg', createdAt: NOW.toISOString() });
    expect(second.filePath).toBe('2026-11/F1_2026-11-19_13-30.png');
    expect(attachPhoto(ctx, 'F1', JPG, NOW).filePath).toBe('2026-11/F1_2026-11-19_13-30_2.jpg');
    expect(readFileSync(ctx.media.resolve(first.filePath))).toEqual(Buffer.from(JPG.data));
    expect(listAttachments(ctx.db, 'f1').map((a) => a.id)).toEqual([first.id, second.id, second.id + 1]);
  });

  it('solo acepta fotos y de registros que existen', () => {
    gasto(1000);
    expect(() => attachPhoto(ctx, 'F1', { data: new Uint8Array([1]), mime: 'application/pdf' }, NOW)).toThrow(ValidationError);
    expect(() => attachPhoto(ctx, 'F9', JPG, NOW)).toThrow(NotFoundError);
    expect(existsSync(ctx.media.dir)).toBe(false);
  });

  it('al borrar un registro se borran sus fotos: las filas y los archivos', () => {
    gasto(1000);
    gasto(2000);
    const files = [attachPhoto(ctx, 'F1', JPG, NOW), attachPhoto(ctx, 'F1', JPG, NOW)].map((a) => ctx.media.resolve(a.filePath));
    const other = attachPhoto(ctx, 'F2', JPG, NOW);

    const deleted = deleteRecord(ctx, 'f1');
    expect(deleted.record.code).toBe('F1');
    expect(deleted.attachments).toHaveLength(2);
    expect(files.map((file) => existsSync(file))).toEqual([false, false]);
    expect(listAttachments(ctx.db, 'F1')).toEqual([]);
    expect(findRecord(ctx, 'F1')).toBeNull();
    // Las del otro registro quedan.
    expect(listAttachments(ctx.db, 'F2')).toEqual([other]);
    expect(existsSync(ctx.media.resolve(other.filePath))).toBe(true);
    // Y el código no se reutiliza.
    expect(gasto(3000)).toBe('F3');
  });

  it('si el borrado del área falla, las fotos quedan como estaban', () => {
    gasto(1000);
    const photo = attachPhoto(ctx, 'F1', JPG, NOW);
    expect(() =>
      removeWithAttachments(ctx.db, ctx.media, () => {
        throw new Error('falló');
      }),
    ).toThrow('falló');
    expect(listAttachments(ctx.db, 'F1')).toEqual([photo]);
    expect(existsSync(ctx.media.resolve(photo.filePath))).toBe(true);
  });

  it('sirve aunque el borrado del área abra su propia transacción', () => {
    gasto(1000);
    attachPhoto(ctx, 'F1', JPG, NOW);
    const { removed, attachments } = removeWithAttachments(ctx.db, ctx.media, () =>
      transaction(ctx.db, () => deleteMovimiento(ctx.db, 'F1')),
    );
    expect(removed.code).toBe('F1');
    expect(attachments).toHaveLength(1);
    expect(ctx.db.isTransaction).toBe(false);
  });

  it('no deja leer ni borrar fuera de data/media', () => {
    expect(() => ctx.media.resolve('../app.db')).toThrow(/fuera de la carpeta/);
    expect(() => ctx.media.remove('../../config.json')).toThrow(/fuera de la carpeta/);
  });
});
