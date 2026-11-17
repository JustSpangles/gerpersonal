import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CORE_PORT } from '@ger/shared';
import { z } from 'zod';

/**
 * Configuración del núcleo: `config.json` en la raíz del repo (está en
 * .gitignore). Otra ubicación: variable de entorno `GER_CONFIG`.
 * Si no existe, se crea con un token nuevo al azar.
 */

export const configSchema = z.object({
  port: z.number().int().min(1).max(65535).default(DEFAULT_CORE_PORT),
  /** 0.0.0.0 = accesible desde la red local y Tailscale. */
  host: z.string().min(1).default('0.0.0.0'),
  /** Lo tiene que mandar el programa de PC en cada pedido (Authorization: Bearer …). */
  apiToken: z.string().min(16, 'apiToken tiene que tener al menos 16 caracteres'),
  /** Carpeta con app.db y media/. Si es relativa, se toma desde la carpeta de config.json. */
  dataDir: z.string().min(1).default('data'),
});

export type CoreConfig = z.output<typeof configSchema>;

export interface LoadedConfig {
  config: CoreConfig;
  path: string;
  /** Carpeta de datos con ruta absoluta. */
  dataDir: string;
  /** true si config.json no existía y se acaba de crear. */
  created: boolean;
}

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export function defaultConfigPath(): string {
  return resolve(process.env.GER_CONFIG ?? resolve(REPO_ROOT, 'config.json'));
}

export function loadConfig(path = defaultConfigPath()): LoadedConfig {
  let created = false;
  let raw: unknown;

  if (existsSync(path)) {
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(`No se pudo leer ${path}: ${(error as Error).message}`);
    }
  } else {
    raw = { apiToken: randomBytes(24).toString('base64url') };
    writeFileSync(path, `${JSON.stringify(configSchema.parse(raw), null, 2)}\n`, { mode: 0o600 });
    created = true;
  }

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Configuración inválida en ${path}:\n${z.prettifyError(parsed.error)}`);
  }

  return {
    config: parsed.data,
    path,
    dataDir: resolve(dirname(path), parsed.data.dataDir),
    created,
  };
}
