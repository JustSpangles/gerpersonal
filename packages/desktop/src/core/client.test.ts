import { describe, expect, it } from 'vitest';
import { checkConnection, createApiClient, ApiError } from './client.ts';

const config = { coreUrl: 'http://nucleo:3210', apiToken: 'secreto' };

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fetch, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('cliente de la API', () => {
  it('manda el token y devuelve el JSON', async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { areas: [] }));
    await expect(createApiClient(config, fetch).get('/areas')).resolves.toEqual({ areas: [] });
    expect(calls[0]?.url).toBe('http://nucleo:3210/areas');
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBe('Bearer secreto');
  });

  it('convierte errores HTTP en ApiError con el mensaje del núcleo', async () => {
    const { fetch } = fakeFetch(() => json(404, { error: 'No existe' }));
    const error = await createApiClient(config, fetch).get('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'No existe' });
  });

  it('manda JSON al crear y editar; borrar no tiene cuerpo', async () => {
    const { fetch, calls } = fakeFetch((_url, init) =>
      init?.method === 'DELETE' ? new Response(null, { status: 204 }) : json(200, { ok: true }),
    );
    const api = createApiClient(config, fetch);
    await api.post('/x', { monto: 1 });
    await api.patch('/x/F1', { nota: null });
    await expect(api.delete('/x/F1')).resolves.toBeUndefined();

    expect(calls.map((c) => c.init?.method)).toEqual(['POST', 'PATCH', 'DELETE']);
    expect(calls[0]?.init?.body).toBe('{"monto":1}');
    expect(new Headers(calls[0]?.init?.headers).get('Content-Type')).toBe('application/json');
    expect(calls[2]?.init?.body).toBeUndefined();
    expect(new Headers(calls[2]?.init?.headers).has('Content-Type')).toBe(false);
  });

  it('errores de validación: trae el error de cada campo', async () => {
    const { fetch } = fakeFetch(() => json(400, { error: 'Datos inválidos', campos: { monto: 'falta' } }));
    await expect(createApiClient(config, fetch).post('/x', {})).rejects.toMatchObject({ status: 400, fields: { monto: 'falta' } });
  });

  it('sin respuesta: ApiError con status 0', async () => {
    const { fetch } = fakeFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(createApiClient(config, fetch).get('/health')).rejects.toMatchObject({ status: 0 });
  });
});

describe('checkConnection', () => {
  it('ok cuando responde y el token sirve', async () => {
    const { fetch } = fakeFetch((url) => (url.endsWith('/health') ? json(200, { ok: true, version: '1.2.3' }) : json(200, { areas: [] })));
    await expect(checkConnection(config, fetch)).resolves.toEqual({ state: 'ok', version: '1.2.3' });
  });

  it('unauthorized cuando el token no sirve', async () => {
    const { fetch } = fakeFetch((url) => (url.endsWith('/health') ? json(200, { ok: true, version: '1' }) : json(401, { error: 'x' })));
    await expect(checkConnection(config, fetch)).resolves.toEqual({ state: 'unauthorized' });
  });

  it('offline cuando no hay respuesta', async () => {
    const { fetch } = fakeFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(checkConnection(config, fetch)).resolves.toMatchObject({ state: 'offline' });
  });
});
