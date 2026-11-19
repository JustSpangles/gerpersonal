import { loadAreaRegistry } from '@ger/shared/node';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadAreaRoutes } from '../../api/areaRoutes.ts';
import { buildServer } from '../../api/server.ts';
import { createTestDb } from '../../db/testing.ts';

const TOKEN = 'token-de-prueba-1234567890';
const headers = { authorization: `Bearer ${TOKEN}` };
let app: FastifyInstance;

beforeEach(async () => {
  app = buildServer({
    db: createTestDb(),
    areas: await loadAreaRegistry(),
    areaRoutes: await loadAreaRoutes(),
    apiToken: TOKEN,
    version: '0.0.0',
  });
  await app.ready();
});

afterEach(() => app.close());

const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url: `/areas/finanzas${url}`, headers, ...(payload ? { payload } : {}) });

describe('API de Finanzas', () => {
  it('pide token', async () => {
    expect((await app.inject({ method: 'GET', url: '/areas/finanzas/movimientos' })).statusCode).toBe(401);
  });

  it('crear, ver, editar y borrar un movimiento', async () => {
    const created = await call('POST', '/movimientos', { tipo: 'egreso', monto: 150000, categoria: 'comida', fecha: '2026-11-15' });
    expect(created.statusCode).toBe(201);
    expect(created.json().movimiento).toMatchObject({ code: 'F1', monto: 150000, nota: null });

    expect((await call('GET', '/movimientos/f1')).json().movimiento.code).toBe('F1');

    const edited = await call('PATCH', '/movimientos/F1', { nota: 'con Juan' });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().movimiento).toMatchObject({ code: 'F1', nota: 'con Juan', monto: 150000 });

    expect((await call('DELETE', '/movimientos/F1')).statusCode).toBe(204);
    const missing = await call('GET', '/movimientos/F1');
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toBe('No existe el movimiento F1');
  });

  it('datos inválidos: 400 con el error de cada campo', async () => {
    const res = await call('POST', '/movimientos', { tipo: 'egreso', monto: '1500' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: 'Datos inválidos. Monto: tiene que ser un monto; Categoría: falta',
      campos: { monto: 'tiene que ser un monto', categoria: 'falta' },
    });
  });

  it('JSON roto o sin cuerpo: 400 con mensaje', async () => {
    const broken = await app.inject({
      method: 'POST',
      url: '/areas/finanzas/movimientos',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: '{nope',
    });
    expect(broken.statusCode).toBe(400);
    expect(broken.json()).toHaveProperty('error');

    const empty = await call('POST', '/movimientos');
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error).toContain('tiene que ser un objeto');
  });

  it('listar con filtros, categorías y resumen', async () => {
    await call('POST', '/movimientos', { tipo: 'egreso', monto: 1000, categoria: 'comida', fecha: '2026-10-31' });
    await call('POST', '/movimientos', { tipo: 'ingreso', monto: 500000, categoria: 'sueldo', fecha: '2026-11-01' });
    await call('POST', '/movimientos', { tipo: 'egreso', monto: 2000, categoria: 'comida', fecha: '2026-11-02' });

    const list = await call('GET', '/movimientos?desde=2026-11-01&hasta=2026-11-30&limit=10');
    expect(list.json().movimientos.map((m: { code: string }) => m.code)).toEqual(['F3', 'F2']);

    expect((await call('GET', '/movimientos?desde=ayer')).statusCode).toBe(400);
    expect((await call('GET', '/categorias?tipo=egreso')).json()).toEqual({ categorias: ['comida'] });

    const resumen = (await call('GET', '/resumen?mes=2026-11&meses=2')).json();
    expect(resumen.totales).toEqual({ ingresos: 500000, egresos: 2000, saldo: 498000 });
    expect(resumen.meses.map((m: { mes: string; saldoAcumulado: number }) => [m.mes, m.saldoAcumulado])).toEqual([
      ['2026-10', -1000],
      ['2026-11', 497000],
    ]);
    expect((await call('GET', '/resumen?meses=muchos')).statusCode).toBe(400);
  });

  it('el preflight de CORS permite editar y borrar', async () => {
    const res = await app.inject({ method: 'OPTIONS', url: '/areas/finanzas/movimientos/F1' });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
  });
});
