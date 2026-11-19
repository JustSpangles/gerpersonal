import { z } from 'zod';
import type { FieldDefinition } from './area.ts';
import { formatDate, isValidISODate, isValidTime, nowTime, parseDateInput, parseTimeInput, todayISO } from './dates.ts';
import { formatMoney, formatMoneyInput, parseMoney } from './money.ts';
import { normalizeText } from './text.ts';

/**
 * Todo lo que se deriva de la definición de un campo: validación de la API,
 * valores por defecto, interpretación de lo que se escribe (bot y formulario)
 * y cómo se muestra. Así cada área declara sus campos una sola vez.
 */

/** Valor de un campo tal como viaja en la API y se guarda: texto, número o nada. */
export type FieldValue = string | number | null;
export type FieldValues = Record<string, FieldValue>;

export const TEXT_MAX_LENGTH = 2000;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function fieldLabel(field: FieldDefinition): string {
  return field.label ?? capitalize(field.key.replaceAll('_', ' '));
}

/** Cómo se muestra una opción de un campo `enum`: `egreso` → `Gasto`. */
export function optionLabel(field: FieldDefinition, option: string): string {
  return (field.type === 'enum' ? field.optionLabels?.[option] : undefined) ?? capitalize(option);
}

/** Hay que escribirlo sí o sí: es obligatorio y no tiene valor por defecto. */
export function isRequired(field: FieldDefinition): boolean {
  return field.required === true && field.default === undefined;
}

/** Puede quedar vacío (`null`) en la base: no es obligatorio ni tiene valor por defecto. */
export function isNullable(field: FieldDefinition): boolean {
  return field.required !== true && field.default === undefined;
}

// --- Validación (API y servicios) ---------------------------------------------

/** El mensaje "falta" cuando no vino nada; si no, el del tipo. */
const typeError = (message: string) => (issue: { input: unknown }) => (issue.input == null ? 'falta' : message);

function limits<T extends z.ZodNumber>(schema: T, field: { min?: number | undefined; max?: number | undefined }): T {
  let result = schema;
  if (field.min !== undefined) result = result.min(field.min, `tiene que ser ${field.min} o más`) as T;
  if (field.max !== undefined) result = result.max(field.max, `tiene que ser ${field.max} o menos`) as T;
  return result;
}

/** Esquema Zod del valor de un campo (sin contemplar que falte). */
export function fieldValueSchema(field: FieldDefinition): z.ZodType<string | number> {
  switch (field.type) {
    case 'text':
      return z
        .string({ error: typeError('tiene que ser texto') })
        .trim()
        .min(1, 'no puede estar vacío')
        .max(TEXT_MAX_LENGTH, `no puede pasar de ${TEXT_MAX_LENGTH} caracteres`);
    case 'number':
      return limits(z.number({ error: typeError('tiene que ser un número') }), field);
    case 'int':
      return limits(z.number({ error: typeError('tiene que ser un número') }).int('tiene que ser un número entero'), field);
    case 'money':
      return z
        .number({ error: typeError('tiene que ser un monto') })
        .int('tiene que estar en centavos (número entero)')
        .min(1, 'tiene que ser mayor a 0')
        .max(Number.MAX_SAFE_INTEGER, 'es demasiado grande');
    case 'enum':
      return z.enum(field.options as [string, ...string[]], { error: typeError(`tiene que ser ${listOptions(field.options)}`) });
    case 'date':
      return z.string({ error: typeError('tiene que ser una fecha') }).refine(isValidISODate, 'tiene que ser una fecha AAAA-MM-DD');
    case 'time':
      return z.string({ error: typeError('tiene que ser una hora') }).refine(isValidTime, 'tiene que ser una hora HH:MM');
  }
}

/** `['a', 'b', 'c']` → `a, b o c`. */
export function listOptions(options: readonly string[]): string {
  return options.length === 1 ? options[0]! : `${options.slice(0, -1).join(', ')} o ${options.at(-1)}`;
}

export type ValuesMode = 'create' | 'update';

/**
 * Esquema de un registro entero.
 * - `create`: los obligatorios tienen que venir; el resto puede faltar (después se aplican los valores por defecto).
 * - `update`: todo es opcional; solo se pueden vaciar (`null`) los campos que admiten quedar vacíos.
 */
export function valuesSchema(fields: readonly FieldDefinition[], mode: ValuesMode) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    const value = fieldValueSchema(field);
    if (mode === 'create') shape[field.key] = isRequired(field) ? value : value.nullish();
    else shape[field.key] = isNullable(field) ? value.nullish() : value.optional();
  }
  return z.strictObject(shape, {
    error: (issue) => (issue.code === 'unrecognized_keys' ? 'campo desconocido' : 'tiene que ser un objeto con los campos'),
  });
}

export type ValidationResult =
  | { ok: true; values: FieldValues }
  | { ok: false; errors: Record<string, string> };

/**
 * Valida los valores de un registro. Los errores vienen por campo, en castellano,
 * listos para mostrar: `{ monto: 'tiene que ser mayor a 0' }`.
 */
export function validateValues(fields: readonly FieldDefinition[], input: unknown, mode: ValuesMode): ValidationResult {
  const result = valuesSchema(fields, mode).safeParse(input);
  if (result.success) return { ok: true, values: result.data as FieldValues };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) errors[key] ??= 'campo desconocido';
    } else {
      const key = issue.path.length > 0 ? String(issue.path[0]) : '_';
      errors[key] ??= issue.message;
    }
  }
  return { ok: false, errors };
}

/** Completa lo que falta con el valor por defecto de cada campo (o `null`). */
export function applyDefaults(fields: readonly FieldDefinition[], values: FieldValues, now: Date = new Date()): FieldValues {
  const result: FieldValues = { ...values };
  for (const field of fields) {
    if (result[field.key] != null) continue;
    result[field.key] = resolveDefault(field, now);
  }
  return result;
}

function resolveDefault(field: FieldDefinition, now: Date): FieldValue {
  if (field.default === undefined) return null;
  if (field.type === 'date' && field.default === 'today') return todayISO(now);
  if (field.type === 'time' && field.default === 'now') return nowTime(now);
  return field.default;
}

// --- Lo que se escribe (bot y formularios) ------------------------------------

export type ParseResult = { ok: true; value: FieldValue } | { ok: false; error: string };

/**
 * Interpreta lo que se escribió para un campo (`1.500,50`, `ayer`, `13:30`…).
 * Vacío da `null` (o error, si el campo es obligatorio).
 */
export function parseFieldValue(field: FieldDefinition, text: string, now: Date = new Date()): ParseResult {
  const raw = text.trim();
  if (raw === '') return isRequired(field) ? { ok: false, error: 'falta' } : { ok: true, value: null };

  const fail = (error: string): ParseResult => ({ ok: false, error });
  switch (field.type) {
    case 'text':
      return raw.length > TEXT_MAX_LENGTH ? fail(`no puede pasar de ${TEXT_MAX_LENGTH} caracteres`) : { ok: true, value: raw };
    case 'number':
    case 'int': {
      const value = /^-?\d+([.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : Number.NaN;
      if (Number.isNaN(value)) return fail('tiene que ser un número');
      return checkSchema(field, value);
    }
    case 'money': {
      const value = parseMoney(raw);
      if (value === null) return fail('no es un monto válido (ej.: 1.500 o 1500,50)');
      return checkSchema(field, value);
    }
    case 'enum': {
      const wanted = normalizeText(raw);
      const option = field.options.find(
        (o) => normalizeText(o) === wanted || normalizeText(optionLabel(field, o)) === wanted,
      );
      return option ? { ok: true, value: option } : fail(`tiene que ser ${listOptions(field.options)}`);
    }
    case 'date': {
      const value = parseDateInput(raw, now);
      return value ? { ok: true, value } : fail('no es una fecha válida (ej.: 16/11, ayer o 2026-11-16)');
    }
    case 'time': {
      const value = parseTimeInput(raw, now);
      return value ? { ok: true, value } : fail('no es una hora válida (ej.: 13:30)');
    }
  }
}

function checkSchema(field: FieldDefinition, value: number): ParseResult {
  const result = fieldValueSchema(field).safeParse(value);
  return result.success ? { ok: true, value } : { ok: false, error: result.error.issues[0]?.message ?? 'valor inválido' };
}

// --- Cómo se muestra -----------------------------------------------------------

/** Valor listo para mostrar: `$ 1.500`, `16/11`, `13:30`… Vacío si no hay valor. */
export function formatFieldValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  switch (field.type) {
    case 'money':
      return typeof value === 'number' ? formatMoney(value) : String(value);
    case 'date':
      return typeof value === 'string' && isValidISODate(value) ? formatDate(value) : String(value);
    case 'number':
      return String(value).replace('.', ',');
    case 'enum':
      return optionLabel(field, String(value));
    default:
      return String(value);
  }
}

/** Valor para cargar en un campo editable del formulario (inverso de `parseFieldValue`). */
export function toInputText(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined) return '';
  switch (field.type) {
    case 'money':
      return typeof value === 'number' ? formatMoneyInput(value) : String(value);
    case 'number':
      return String(value).replace('.', ',');
    default:
      return String(value);
  }
}
