import { existsSync, readdirSync } from 'node:fs';
import { buildRegistry, type AreaRegistry } from './registry.ts';

/**
 * Descubre las áreas leyendo la carpeta `areas/` (solo Node: núcleo y tests).
 * Agregar un área = agregar `areas/<id>/definition.ts`. No hay lista a mano.
 */
export async function loadAreaRegistry(): Promise<AreaRegistry> {
  const areasDir = new URL('./areas/', import.meta.url);
  const modules: Record<string, unknown> = {};

  const folders = readdirSync(areasDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const folder of folders) {
    const file = new URL(`./${folder}/definition.ts`, areasDir);
    if (!existsSync(file)) continue;
    modules[`areas/${folder}/definition.ts`] = await import(file.href);
  }

  return buildRegistry(modules);
}
