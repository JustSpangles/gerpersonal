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
