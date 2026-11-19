import { existsSync, readdirSync } from 'node:fs';

const AREAS_DIR = new URL('./areas/', import.meta.url);

/**
 * Importa `src/areas/<area>/<file>` de cada área que lo tenga y devuelve
 * id del área → export por defecto (`undefined` si no tiene). Así se descubren
 * las rutas de la API y los registros del bot: agregar un área = agregar una carpeta.
 */
export async function importAreaModules(file: string, areasDir: URL = AREAS_DIR): Promise<Map<string, unknown>> {
  const modules = new Map<string, unknown>();
  if (!existsSync(areasDir)) return modules;

  const folders = readdirSync(areasDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const folder of folders) {
    const url = new URL(`./${folder}/${file}`, areasDir);
    if (!existsSync(url)) continue;
    const mod = (await import(url.href)) as { default?: unknown };
    modules.set(folder, mod.default);
  }
  return modules;
}
