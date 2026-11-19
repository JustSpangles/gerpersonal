import { z } from 'zod';

/**
 * Definición de áreas y comandos.
 *
 * Cada área declara sus comandos y cada comando declara sus campos UNA sola vez.
 * De esa declaración se derivan el mensaje de formato del bot, el parser,
 * la validación y el formulario de la UI.
 */

const fieldKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'la clave del campo va en minúsculas, sin espacios ni tildes');

const fieldBase = {
  key: fieldKey,
  /** Texto para mostrar (formulario, mensaje de formato). Si falta, se usa `key`. */
  label: z.string().min(1).optional(),
  /** Ayuda corta debajo del campo en el formulario. */
  hint: z.string().min(1).optional(),
  required: z.boolean().optional(),
};

const numberLimits = {
  min: z.number().optional(),
  max: z.number().optional(),
};

/** Tipos de campo disponibles. Se amplía cuando un área lo necesite. */
export const fieldSchema = z.discriminatedUnion('type', [
  z.object({ ...fieldBase, type: z.literal('text'), default: z.string().optional() }),
  z.object({ ...fieldBase, ...numberLimits, type: z.literal('number'), default: z.number().optional() }),
  z.object({ ...fieldBase, ...numberLimits, type: z.literal('int'), default: z.number().int().optional() }),
  /** Monto en pesos, mayor a 0. Se guarda en centavos (entero). */
  z.object({ ...fieldBase, type: z.literal('money'), default: z.number().int().optional() }),
  z
    .object({
      ...fieldBase,
      type: z.literal('enum'),
      options: z.array(z.string().min(1)).min(1),
      /** Cómo se muestra cada opción en la UI, p. ej. `{ egreso: 'Gasto' }`. */
      optionLabels: z.record(z.string(), z.string().min(1)).optional(),
      default: z.string().optional(),
    })
    .refine((f) => f.default === undefined || f.options.includes(f.default), {
      message: 'el valor por defecto tiene que ser una de las opciones',
    }),
  /** Fecha (AAAA-MM-DD). `today` = hoy en la zona horaria del sistema. */
  z.object({ ...fieldBase, type: z.literal('date'), default: z.literal('today').optional() }),
  /** Hora (HH:mm, 24 h). `now` = ahora. */
  z.object({ ...fieldBase, type: z.literal('time'), default: z.literal('now').optional() }),
]);

export const commandSchema = z.object({
  /** Identificador dentro del área, p. ej. `gasto`. */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().min(1),
  /** Palabras clave del bot. Se comparan sin mayúsculas ni tildes. */
  keywords: z.array(z.string().min(1)).min(1),
  /**
   * Campos del registro, en el orden en que se escriben en el bot. Los
   * opcionales (o con valor por defecto) van al final.
   */
  fields: z.array(fieldSchema),
  /**
   * Valores que pone el comando sin preguntarlos. P. ej. `gasté` y `cobré`
   * comparten campos y solo cambian `{ tipo: 'egreso' }` / `{ tipo: 'ingreso' }`.
   */
  fixed: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  example: z.string().min(1),
});

export const areaSchema = z.object({
  /** Igual al nombre de la carpeta del área. */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  /** Una letra mayúscula: prefijo de los códigos de registro (C14, F203…). */
  prefix: z.string().regex(/^[A-Z]$/, 'el prefijo es una sola letra mayúscula'),
  emoji: z.string().min(1),
  /** Orden en el menú y en `ayuda`. */
  order: z.number().int(),
  description: z.string().min(1),
  commands: z.array(commandSchema).default([]),
});

export type FieldDefinition = z.output<typeof fieldSchema>;
export type FieldType = FieldDefinition['type'];
export type CommandDefinition = z.output<typeof commandSchema>;
export type AreaDefinitionInput = z.input<typeof areaSchema>;
export type AreaDefinition = z.output<typeof areaSchema>;

/**
 * Declara un área. Solo sirve para tener tipos y autocompletado en
 * `areas/<area>/definition.ts`; la validación la hace el registro.
 */
export function defineArea(definition: AreaDefinitionInput): AreaDefinitionInput {
  return definition;
}
