import { z } from 'zod';
import { areaSchema, type AreaDefinition, type CommandDefinition } from './area.ts';
import { fieldValueSchema, isRequired } from './fields.ts';
import { normalizeText } from './text.ts';

/**
 * Registro central de áreas.
 *
 * Cada área vive en `areas/<id>/definition.ts` y exporta por defecto su
 * definición. Nadie la importa a mano: el núcleo las descubre leyendo la
 * carpeta (`@ger/shared/node`) y el programa de PC con `import.meta.glob`.
 * Los dos le pasan los módulos a `buildRegistry`, que valida todo junto.
 */

/** Palabras que usa el bot para comandos globales; ningún área puede usarlas. */
export const GLOBAL_KEYWORDS = ['ayuda', 'ver', 'editar', 'borrar', 'si', 'no'] as const;

export interface AreaRegistry {
  /** Todas las áreas, ordenadas por `order`. */
  readonly all: readonly AreaDefinition[];
  get(id: string): AreaDefinition | undefined;
  byPrefix(prefix: string): AreaDefinition | undefined;
}

export class AreaRegistryError extends Error {
  override name = 'AreaRegistryError';
}

const DEFINITION_PATH = /areas\/([^/]+)\/definition\.ts$/;

/**
 * Arma el registro a partir de los módulos `definition.ts` encontrados.
 * @param modules ruta del archivo → módulo importado (con `default`).
 */
export function buildRegistry(modules: Record<string, unknown>): AreaRegistry {
  const areas: AreaDefinition[] = [];
  const problems: string[] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const folder = DEFINITION_PATH.exec(path.replaceAll('\\', '/'))?.[1];
    if (!folder) {
      problems.push(`${path}: no es un archivo areas/<area>/definition.ts`);
      continue;
    }
    const raw = (mod as { default?: unknown } | null)?.default;
    if (raw === undefined) {
      problems.push(`${folder}: definition.ts tiene que exportar la definición por defecto`);
      continue;
    }
    const parsed = areaSchema.safeParse(raw);
    if (!parsed.success) {
      problems.push(`${folder}: ${z.prettifyError(parsed.error)}`);
      continue;
    }
    if (parsed.data.id !== folder) {
      problems.push(`${folder}: el id "${parsed.data.id}" tiene que ser igual al nombre de la carpeta`);
      continue;
    }
    areas.push(parsed.data);
  }

  problems.push(...findCollisions(areas));
  if (problems.length > 0) {
    throw new AreaRegistryError(`Hay problemas en las definiciones de áreas:\n- ${problems.join('\n- ')}`);
  }

  areas.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const byId = new Map(areas.map((a) => [a.id, a]));
  const byPrefix = new Map(areas.map((a) => [a.prefix, a]));

  return {
    all: areas,
    get: (id) => byId.get(id),
    byPrefix: (prefix) => byPrefix.get(prefix.toUpperCase()),
  };
}

function findCollisions(areas: AreaDefinition[]): string[] {
  const problems: string[] = [];
  const prefixes = new Map<string, string>();
  const keywords = new Map<string, string>(GLOBAL_KEYWORDS.map((k) => [k, 'los comandos globales']));

  for (const area of areas) {
    const prefixOwner = prefixes.get(area.prefix);
    if (prefixOwner) problems.push(`${area.id}: el prefijo "${area.prefix}" ya lo usa ${prefixOwner}`);
    else prefixes.set(area.prefix, area.id);

    const commandIds = new Set<string>();
    for (const command of area.commands) {
      if (commandIds.has(command.id)) problems.push(`${area.id}: el comando "${command.id}" está repetido`);
      commandIds.add(command.id);

      const fieldKeys = new Set<string>();
      for (const field of command.fields) {
        if (fieldKeys.has(field.key)) problems.push(`${area.id}/${command.id}: el campo "${field.key}" está repetido`);
        fieldKeys.add(field.key);
      }
      problems.push(...checkCommand(`${area.id}/${command.id}`, command));

      for (const keyword of command.keywords) {
        const normalized = normalizeText(keyword);
        const owner = keywords.get(normalized);
        if (owner) problems.push(`${area.id}/${command.id}: la palabra clave "${keyword}" ya la usa ${owner}`);
        else keywords.set(normalized, `${area.id}/${command.id}`);
      }
    }
  }
  return problems;
}

/** Reglas de cada comando que el esquema solo no puede expresar. */
function checkCommand(where: string, command: CommandDefinition): string[] {
  const problems: string[] = [];
  const byKey = new Map(command.fields.map((field) => [field.key, field]));

  for (const [key, value] of Object.entries(command.fixed)) {
    const field = byKey.get(key);
    if (!field) problems.push(`${where}: el valor fijo "${key}" no es un campo del comando`);
    else if (!fieldValueSchema(field).safeParse(value).success) {
      problems.push(`${where}: el valor fijo ${JSON.stringify(value)} no sirve para el campo "${key}"`);
    }
  }

  // En el bot los campos se escriben en orden y los opcionales se pueden omitir
  // al final: después de un campo opcional no puede venir uno obligatorio.
  let firstOptional: string | undefined;
  for (const field of command.fields) {
    if (field.key in command.fixed) continue;
    if (!isRequired(field)) firstOptional ??= field.key;
    else if (firstOptional) {
      problems.push(`${where}: el campo obligatorio "${field.key}" tiene que ir antes que el opcional "${firstOptional}"`);
    }
  }
  return problems;
}
