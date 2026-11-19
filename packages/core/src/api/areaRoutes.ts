import { existsSync, readdirSync } from 'node:fs';
import type { AreaDefinition } from '@ger/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/database.ts';

/**
 * Rutas propias de cada área: `src/areas/<area>/routes.ts` exporta por defecto
 * `defineAreaRoutes(...)` y quedan montadas bajo `/areas/<area>/`.
 * Se descubren por carpeta, como las migraciones: agregar un área no toca la API.
 */

export interface AreaRoutesOptions {
  db: Db;
  area: AreaDefinition;
}

export type AreaRoutes = FastifyPluginAsync<AreaRoutesOptions>;

/** Solo da tipos a `routes.ts`. */
export function defineAreaRoutes(plugin: AreaRoutes): AreaRoutes {
  return plugin;
}

const AREAS_DIR = new URL('../areas/', import.meta.url);

/** Busca `areas/<area>/routes.ts` e importa cada uno. Devuelve id del área → rutas. */
export async function loadAreaRoutes(areasDir: URL = AREAS_DIR): Promise<Map<string, AreaRoutes>> {
  const routes = new Map<string, AreaRoutes>();
  if (!existsSync(areasDir)) return routes;

  for (const entry of readdirSync(areasDir, { withFileTypes: true })) {
    const file = new URL(`./${entry.name}/routes.ts`, areasDir);
    if (!entry.isDirectory() || !existsSync(file)) continue;
    const mod = (await import(file.href)) as { default?: AreaRoutes };
    if (typeof mod.default !== 'function') {
      throw new Error(`areas/${entry.name}/routes.ts tiene que exportar por defecto defineAreaRoutes(...)`);
    }
    routes.set(entry.name, mod.default);
  }
  return routes;
}
