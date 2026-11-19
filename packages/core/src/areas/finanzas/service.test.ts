import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../db/database.ts';
import { createTestDb } from '../../db/testing.ts';
import { NotFoundError, ValidationError } from '../../records/errors.ts';
import {
  createMovimiento,
  deleteMovimiento,
  findMovimiento,
  getMovimiento,
  getResumen,
  listCategorias,
  listMovimientos,
  updateMovimiento,
} from './service.ts';

// 16/11/2026 12:00 en Buenos Aires.
const NOW = new Date('2026-11-16T15:00:00Z');
let db: Db;

beforeEach(() => {
  db = createTestDb();
});

const gasto = (monto: number, categoria: string, fecha: string, nota?: string) =>
  createMovimiento(db, { tipo: 'egreso', monto, categoria, fecha, nota }, NOW);
const ingreso = (monto: number, categoria: string, fecha: string) =>
  createMovimiento(db, { tipo: 'ingreso', monto, categoria, fecha }, NOW);

describe('crear', () => {
  it('guarda el movimiento con código correlativo y fecha de hoy por defecto', () => {
    const m = createMovimiento(db, { tipo: 'egreso', monto: 150000, categoria: 'comida' }, NOW);
    expect(m).toEqual({
      code: 'F1',
      tipo: 'egreso',
      monto: 150000,
      categoria: 'comida',
      nota: null,
      fecha: '2026-11-16',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(gasto(100, 'otra', '2026-11-01').code).toBe('F2');
  });

  it('valida campo por campo y no gasta un código si falla', () => {
    const error = (() => {
      try {
        createMovimiento(db, { tipo: 'egreso', monto: -5, categoria: '' }, NOW);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toEqual({ monto: 'tiene que ser mayor a 0', categoria: 'no puede estar vacío' });
    expect((error as ValidationError).message).toContain('Monto: tiene que ser mayor a 0');
    expect(gasto(100, 'x', '2026-11-01').code).toBe('F1');
  });

  it('reutiliza la categoría existente aunque cambien mayúsculas o tildes', () => {
    gasto(100, 'Café', '2026-11-01');
    expect(gasto(100, 'cafe', '2026-11-02').categoria).toBe('Café');
    expect(gasto(100, '  Mercado   Pago ', '2026-11-02').categoria).toBe('Mercado Pago');
  });
});

describe('ver, editar y borrar', () => {
  it('busca por código, sin importar mayúsculas', () => {
    gasto(100, 'x', '2026-11-01');
    expect(getMovimiento(db, 'f1').code).toBe('F1');
    expect(findMovimiento(db, 'F99')).toBeNull();
    expect(findMovimiento(db, 'C1')).toBeNull();
    expect(() => getMovimiento(db, 'F99')).toThrow(NotFoundError);
  });

  it('edita solo los campos que vienen', () => {
    gasto(100, 'x', '2026-11-01', 'nota vieja');
    const later = new Date('2026-11-17T10:00:00Z');
    const m = updateMovimiento(db, 'F1', { monto: 250050, nota: null }, later);
    expect(m).toMatchObject({ code: 'F1', monto: 250050, nota: null, categoria: 'x', fecha: '2026-11-01' });
    expect(m.updatedAt).toBe(later.toISOString());
    expect(m.createdAt).toBe(NOW.toISOString());
  });

  it('al editar valida y no deja vaciar lo obligatorio', () => {
    gasto(100, 'x', '2026-11-01');
    expect(() => updateMovimiento(db, 'F1', { categoria: null as unknown as string })).toThrow(ValidationError);
    expect(() => updateMovimiento(db, 'F1', { tipo: 'regalo' as 'egreso' })).toThrow(ValidationError);
    expect(() => updateMovimiento(db, 'F9', { monto: 1 })).toThrow(NotFoundError);
  });

  it('se puede corregir cómo se escribe la categoría del único movimiento que la usa', () => {
    gasto(100, 'comida', '2026-11-01');
    expect(updateMovimiento(db, 'F1', { categoria: 'Comida' }).categoria).toBe('Comida');
  });

  it('borra y el código no se reutiliza', () => {
    gasto(100, 'x', '2026-11-01');
    expect(deleteMovimiento(db, 'F1').code).toBe('F1');
    expect(findMovimiento(db, 'F1')).toBeNull();
    expect(gasto(100, 'x', '2026-11-01').code).toBe('F2');
    expect(() => deleteMovimiento(db, 'F1')).toThrow(NotFoundError);
  });
});

describe('listar', () => {
  beforeEach(() => {
    gasto(1000, 'comida', '2026-10-31');
    gasto(2000, 'transporte', '2026-11-01');
    ingreso(500000, 'sueldo', '2026-11-05');
    gasto(3000, 'comida', '2026-11-05');
  });

  it('del más nuevo al más viejo', () => {
    expect(listMovimientos(db).map((m) => m.code)).toEqual(['F4', 'F3', 'F2', 'F1']);
  });

  it('filtra por fechas, tipo y categoría', () => {
    expect(listMovimientos(db, { desde: '2026-11-01', hasta: '2026-11-30' }).map((m) => m.code)).toEqual(['F4', 'F3', 'F2']);
    expect(listMovimientos(db, { tipo: 'ingreso' }).map((m) => m.code)).toEqual(['F3']);
    expect(listMovimientos(db, { categoria: 'comida', limit: 1 }).map((m) => m.code)).toEqual(['F4']);
  });

  it('rechaza filtros inválidos', () => {
    expect(() => listMovimientos(db, { desde: '01/11' })).toThrow(ValidationError);
  });

  it('categorías de la más usada a la menos', () => {
    expect(listCategorias(db)).toEqual(['comida', 'sueldo', 'transporte']);
    expect(listCategorias(db, 'ingreso')).toEqual(['sueldo']);
  });
});

describe('resumen', () => {
  it('totales del mes, por categoría y evolución con saldo acumulado', () => {
    ingreso(100000, 'sueldo', '2026-08-10'); // antes del período: arranca el acumulado
    gasto(30000, 'comida', '2026-09-15');
    ingreso(500000, 'sueldo', '2026-11-01');
    gasto(120000, 'alquiler', '2026-11-02');
    gasto(20000, 'comida', '2026-11-03');
    gasto(15000, 'comida', '2026-11-30');
    gasto(99999, 'comida', '2026-12-01'); // después del mes: no cuenta

    const resumen = getResumen(db, { mes: '2026-11', meses: 3 }, NOW);
    expect(resumen.mes).toBe('2026-11');
    expect(resumen.totales).toEqual({ ingresos: 500000, egresos: 155000, saldo: 345000 });
    expect(resumen.porCategoria).toEqual({
      egreso: [
        { categoria: 'alquiler', total: 120000 },
        { categoria: 'comida', total: 35000 },
      ],
      ingreso: [{ categoria: 'sueldo', total: 500000 }],
    });
    expect(resumen.meses).toEqual([
      { mes: '2026-09', ingresos: 0, egresos: 30000, saldo: -30000, saldoAcumulado: 70000 },
      { mes: '2026-10', ingresos: 0, egresos: 0, saldo: 0, saldoAcumulado: 70000 },
      { mes: '2026-11', ingresos: 500000, egresos: 155000, saldo: 345000, saldoAcumulado: 415000 },
    ]);
  });

  it('por defecto: el mes actual y 12 meses', () => {
    const resumen = getResumen(db, {}, NOW);
    expect(resumen.mes).toBe('2026-11');
    expect(resumen.meses).toHaveLength(12);
    expect(resumen.meses[0]?.mes).toBe('2025-12');
    expect(resumen.totales).toEqual({ ingresos: 0, egresos: 0, saldo: 0 });
  });

  it('rechaza meses inválidos', () => {
    expect(() => getResumen(db, { mes: '2026-13' })).toThrow(ValidationError);
    expect(() => getResumen(db, { meses: 0 })).toThrow(ValidationError);
  });
});
