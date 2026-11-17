import { loadAreaRegistry } from '@ger/shared/node';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.ts';
import { buildServer } from './server.ts';

const TOKEN = 'token-de-prueba-1234567890';
const auth = { authorization: `Bearer ${TOKEN}` };
let app: FastifyInstance;

beforeAll(async () => {
  app = buildServer({ db: openDatabase(':memory:'), areas: await loadAreaRegistry(), apiToken: TOKEN, version: '9.9.9' });
  await app.ready();
});

afterAll(() => app.close());

describe('API base', () => {
  it('GET /health responde sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, version: '9.9.9' });
  });

  it('pide token en el resto de las rutas', async () => {
    expect((await app.inject({ method: 'GET', url: '/areas' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/areas', headers: { authorization: 'Bearer otro' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/areas', headers: { authorization: TOKEN } })).statusCode).toBe(401);
  });

  it('GET /areas lista las áreas en orden', async () => {
    const res = await app.inject({ method: 'GET', url: '/areas', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json().areas.map((a: { id: string }) => a.id)).toEqual([
      'salud',
      'finanzas',
      'gimnasio',
      'trabajo',
      'alimentacion',
      'calendario',
      'sobre-mi',
    ]);
  });

  it('GET /areas/:id devuelve un área o 404', async () => {
    const ok = await app.inject({ method: 'GET', url: '/areas/finanzas', headers: auth });
    expect(ok.json().area).toMatchObject({ id: 'finanzas', prefix: 'F' });
    const missing = await app.inject({ method: 'GET', url: '/areas/nada', headers: auth });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toHaveProperty('error');
  });

  it('responde el preflight de CORS sin token', async () => {
    const res = await app.inject({ method: 'OPTIONS', url: '/areas' });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('rutas inexistentes: 401 sin token, 404 con token', async () => {
    expect((await app.inject({ method: 'GET', url: '/nada' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/nada', headers: auth })).statusCode).toBe(404);
  });
});
