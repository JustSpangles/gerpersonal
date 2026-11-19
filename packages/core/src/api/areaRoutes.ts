import type { AreaDefinition } from '@ger/shared';
import type { FastifyPluginAsync } from 'fastify';
import { importAreaModules } from '../areaModules.ts';
import type { Db } from '../db/database.ts';
import type { MediaStore } from '../records/media.ts';

/**
 * Rutas propias de cada área: `src/areas/<area>/routes.ts` exporta por defecto
 * `defineAreaRoutes(...)` y quedan montadas bajo `/areas/<area>/`.
 * Se descubren por carpeta, como las migraciones: agregar un área no toca la API.
 */

export interface AreaRoutesOptions {
  db: Db;
  area: AreaDefinition;
  /** Fotos y archivos de los registros (para borrarlos junto con el registro). */
  media: MediaStore;
}

export type AreaRoutes = FastifyPluginAsync<AreaRoutesOptions>;

/** Solo da tipos a `routes.ts`. */
export function defineAreaRoutes(plugin: AreaRoutes): AreaRoutes {
  return plugin;
}

/** Busca `areas/<area>/routes.ts` e importa cada uno. Devuelve id del área → rutas. */
export async function loadAreaRoutes(areasDir?: URL): Promise<Map<string, AreaRoutes>> {
  const routes = new Map<string, AreaRoutes>();
  for (const [area, plugin] of await importAreaModules('routes.ts', areasDir)) {
    if (typeof plugin !== 'function') {
      throw new Error(`areas/${area}/routes.ts tiene que exportar por defecto defineAreaRoutes(...)`);
    }
    routes.set(area, plugin as AreaRoutes);
  }
  return routes;
}
