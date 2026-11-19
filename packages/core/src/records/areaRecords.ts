import { parseCode, type AreaDefinition, type AreaRegistry, type FieldDefinition, type FieldValues } from '@ger/shared';
import { importAreaModules } from '../areaModules.ts';
import type { Db } from '../db/database.ts';

/**
 * Capa genérica de registros: lo que el bot necesita de cada área para
 * trabajar con cualquier código (`ver`, `editar`, `borrar`, fotos) y para
 * crear registros con los comandos del área.
 *
 * Cada área lo declara en `src/areas/<area>/records.ts`, que exporta por
 * defecto `defineAreaRecords(...)` y solo llama a su propio servicio. Se
 * descubren por carpeta, como las rutas: el prefijo del código lleva al área.
 */

/** Un registro listo para mostrarse y editarse sin saber de qué área es. */
export interface RecordView {
  code: string;
  /** Campos del registro, en orden (un área puede tener registros de varios tipos). */
  fields: readonly FieldDefinition[];
  values: FieldValues;
}

/** Crea un registro con los valores de un comando del bot (ya interpretados, con los fijos incluidos). */
export type CreateFromCommand = (db: Db, values: FieldValues, now: Date) => RecordView;

export interface AreaRecords {
  /** El registro con ese código, o `null` si no existe. */
  find(db: Db, code: string): RecordView | null;
  /** Cambia los campos que vienen. Valida el servicio (ValidationError, NotFoundError). */
  update(db: Db, code: string, patch: FieldValues, now: Date): RecordView;
  /** Borra el registro y lo devuelve. Sus fotos las borra la capa genérica. */
  delete(db: Db, code: string): RecordView;
  /** Una función por cada comando del área: id del comando → crear el registro. */
  commands: Readonly<Record<string, CreateFromCommand>>;
}

/** Solo da tipos a `records.ts`. */
export function defineAreaRecords(records: AreaRecords): AreaRecords {
  return records;
}

function isAreaRecords(value: unknown): value is AreaRecords {
  const r = value as Partial<AreaRecords> | null;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.find === 'function' &&
    typeof r.update === 'function' &&
    typeof r.delete === 'function' &&
    typeof r.commands === 'object' &&
    r.commands !== null
  );
}

/** Busca `areas/<area>/records.ts` e importa cada uno. Devuelve id del área → registros. */
export async function loadAreaRecords(areasDir?: URL): Promise<Map<string, AreaRecords>> {
  const result = new Map<string, AreaRecords>();
  for (const [area, records] of await importAreaModules('records.ts', areasDir)) {
    if (!isAreaRecords(records)) {
      throw new Error(`areas/${area}/records.ts tiene que exportar por defecto defineAreaRecords({ find, update, delete, commands })`);
    }
    result.set(area, records);
  }
  return result;
}

export interface AreaWithRecords {
  area: AreaDefinition;
  records: AreaRecords;
}

export interface RecordsRegistry {
  /** El área y sus registros según el prefijo del código (`f14` → Finanzas), o `null`. */
  forCode(code: string): AreaWithRecords | null;
  forArea(areaId: string): AreaWithRecords | null;
}

export class RecordsRegistryError extends Error {
  override name = 'RecordsRegistryError';
}

/**
 * Junta las áreas con sus registros y verifica que encajen: cada área con
 * comandos tiene su `records.ts` y una función para cada comando.
 */
export function buildRecordsRegistry(areas: AreaRegistry, handlers: ReadonlyMap<string, AreaRecords>): RecordsRegistry {
  const problems: string[] = [];

  for (const [areaId, records] of handlers) {
    const area = areas.get(areaId);
    if (!area) {
      problems.push(`${areaId}: hay records.ts, pero el área no existe`);
      continue;
    }
    const commandIds = new Set(area.commands.map((command) => command.id));
    for (const id of commandIds) {
      if (typeof records.commands[id] !== 'function') problems.push(`${areaId}: falta la función del comando "${id}" en records.ts`);
    }
    for (const id of Object.keys(records.commands)) {
      if (!commandIds.has(id)) problems.push(`${areaId}: records.ts tiene el comando "${id}", que no está en la definición`);
    }
  }
  for (const area of areas.all) {
    if (area.commands.length > 0 && !handlers.has(area.id)) {
      problems.push(`${area.id}: tiene comandos pero le falta src/areas/${area.id}/records.ts`);
    }
  }
  if (problems.length > 0) {
    throw new RecordsRegistryError(`Hay problemas con los registros de las áreas:\n- ${problems.join('\n- ')}`);
  }

  const withRecords = (area: AreaDefinition | undefined): AreaWithRecords | null => {
    const records = area && handlers.get(area.id);
    return area && records ? { area, records } : null;
  };
  return {
    forCode(code) {
      const parsed = parseCode(code);
      return parsed ? withRecords(areas.byPrefix(parsed.prefix)) : null;
    },
    forArea: (areaId) => withRecords(areas.get(areaId)),
  };
}
