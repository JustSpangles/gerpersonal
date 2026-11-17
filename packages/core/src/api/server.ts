import { timingSafeEqual } from 'node:crypto';
import type { AreaRegistry, AreaResponse, AreasResponse, HealthResponse } from '@ger/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Db } from '../db/database.ts';

/**
 * API HTTP del núcleo. Es una capa fina: valida, llama al servicio del área
 * y devuelve JSON. La lógica de negocio va en `areas/<area>/service.ts`.
 */

export interface ServerDeps {
  db: Db;
  areas: AreaRegistry;
  apiToken: string;
  version: string;
  logger?: FastifyServerOptions['logger'];
}

/** Rutas que no piden token (no exponen datos). */
const PUBLIC_ROUTES = new Set(['/health']);

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });
  const expectedAuth = Buffer.from(`Bearer ${deps.apiToken}`);

  app.addHook('onRequest', async (request, reply) => {
    // CORS: el programa de PC llama desde otro origen (Electron o Vite).
    reply.header('Access-Control-Allow-Origin', '*');
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      reply.header('Access-Control-Max-Age', '86400');
      return reply.code(204).send();
    }

    const path = request.url.split('?')[0] ?? '';
    if (PUBLIC_ROUTES.has(path)) return;

    const given = Buffer.from(request.headers.authorization ?? '');
    if (given.length !== expectedAuth.length || !timingSafeEqual(given, expectedAuth)) {
      return reply.code(401).send({ error: 'Token inválido o ausente' });
    }
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'No existe' }));

  app.get('/health', async (): Promise<HealthResponse> => ({
    ok: true,
    name: 'gerpersonal-core',
    version: deps.version,
    time: new Date().toISOString(),
  }));

  app.get('/areas', async (): Promise<AreasResponse> => ({ areas: [...deps.areas.all] }));

  app.get<{ Params: { id: string } }>('/areas/:id', async (request, reply) => {
    const area = deps.areas.get(request.params.id);
    if (!area) return reply.code(404).send({ error: `No existe el área "${request.params.id}"` });
    return { area } satisfies AreaResponse;
  });

  return app;
}
