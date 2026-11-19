import type { AreaDefinition, CommandDefinition, FieldDefinition } from './area.ts';
import { formatMoney } from './money.ts';
import { fieldLabel, isRequired, listOptions, optionLabel, parseFieldValue, type FieldValues } from './fields.ts';
import type { AreaRegistry } from './registry.ts';
import { normalizeText } from './text.ts';

/**
 * Comandos del bot: `<palabra clave> campo1 - campo2 - campo3`.
 *
 * Todo sale de la definición del comando: qué palabras clave lo disparan,
 * cómo se interpreta cada campo y el mensaje de formato. Ningún comando
 * tiene textos ni parser escritos a mano.
 */

// --- Palabras clave -------------------------------------------------------------

export interface KeywordMatch<T> {
  value: T;
  /** Lo que sigue a la palabra clave, tal como se escribió (sin espacios en los bordes). */
  rest: string;
}

/**
 * Arma un buscador de palabras clave. Se comparan sin mayúsculas ni tildes
 * (`Comí` = `comi`) y pueden tener más de una palabra: gana la más larga.
 * El resto del mensaje se devuelve sin tocar (conserva mayúsculas y tildes).
 */
export function createKeywordIndex<T>(entries: Iterable<readonly [keyword: string, value: T]>): (text: string) => KeywordMatch<T> | null {
  const index = new Map<string, T>();
  let maxWords = 1;
  for (const [keyword, value] of entries) {
    const normalized = normalizeText(keyword);
    if (index.has(normalized)) throw new Error(`La palabra clave "${keyword}" está repetida`);
    index.set(normalized, value);
    maxWords = Math.max(maxWords, normalized.split(' ').length);
  }

  return (text) => {
    const words = [...text.matchAll(/\S+/g)];
    for (let count = Math.min(maxWords, words.length); count >= 1; count--) {
      const value = index.get(normalizeText(words.slice(0, count).map((word) => word[0]).join(' ')));
      if (value === undefined) continue;
      const last = words[count - 1]!;
      return { value, rest: text.slice(last.index + last[0].length).trim() };
    }
    return null;
  };
}

export interface CommandMatch {
  area: AreaDefinition;
  command: CommandDefinition;
  /** La palabra clave usada, como está en la definición (con tildes): `pagué`. */
  keyword: string;
  /** Los campos escritos después de la palabra clave, sin interpretar. */
  args: string;
}

/** Arma el buscador de comandos de todas las áreas del registro. */
export function createCommandMatcher(registry: AreaRegistry): (text: string) => CommandMatch | null {
  const find = createKeywordIndex(
    registry.all.flatMap((area) =>
      area.commands.flatMap((command) => command.keywords.map((keyword) => [keyword, { area, command, keyword }] as const)),
    ),
  );
  return (text) => {
    const match = find(text);
    return match && { ...match.value, args: match.rest };
  };
}

// --- Campos ---------------------------------------------------------------------

/**
 * Separador de campos: un guion CON espacios a los dos lados, así
 * `pan-queque` no se corta. Acepta también – y — porque algunos teclados
 * de celular cambian el guion solo.
 */
const FIELD_SEPARATOR = /(?<=\s)[-–—](?=\s)/;

/**
 * Corta lo escrito en campos. Un campo vacío en el medio (`1500 - comida - - ayer`)
 * se toma como omitido, así se puede saltear un opcional y poner el siguiente.
 */
export function splitFields(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  return ` ${trimmed} `.split(FIELD_SEPARATOR).map((part) => part.trim());
}

/** Los campos que se escriben, en orden: todos menos los que fija la palabra clave. */
export function writtenFields(command: CommandDefinition): FieldDefinition[] {
  return command.fields.filter((field) => !(field.key in command.fixed));
}

export type CommandArgsResult = { ok: true; values: FieldValues } | { ok: false; errors: Record<string, string> };

/**
 * Interpreta los campos escritos de un comando. Devuelve los valores (con los
 * fijos del comando incluidos) listos para el servicio del área, o los errores
 * por campo (`_` = del mensaje entero). Los omitidos no vienen: el servicio
 * les pone el valor por defecto.
 */
export function parseCommandArgs(command: CommandDefinition, args: string, now: Date = new Date()): CommandArgsResult {
  const fields = writtenFields(command);
  const parts = splitFields(args);
  if (parts.length > fields.length) {
    return {
      ok: false,
      errors: { _: `sobran campos: escribiste ${parts.length} y lleva hasta ${fields.length}, separados por « - »` },
    };
  }

  const values: FieldValues = { ...command.fixed };
  const errors: Record<string, string> = {};
  fields.forEach((field, i) => {
    const part = parts[i];
    if (part === undefined) {
      if (isRequired(field)) errors[field.key] = 'falta';
      return;
    }
    const result = parseFieldValue(field, part, now);
    if (result.ok) values[field.key] = result.value;
    else errors[field.key] = result.error;
  });
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values };
}

// --- Mensaje de formato ---------------------------------------------------------

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Cómo se lee el valor por defecto: `hoy`, `ahora`, `normal`… */
function defaultText(field: FieldDefinition): string | undefined {
  if (field.default === undefined) return undefined;
  switch (field.type) {
    case 'date':
      return 'hoy';
    case 'time':
      return 'ahora';
    case 'enum':
      return optionLabel(field, field.default).toLowerCase();
    case 'money':
      return formatMoney(field.default);
    default:
      return String(field.default);
  }
}

/** Ayuda según el tipo, para los campos que no traen `hint`. */
function typeHint(field: FieldDefinition): string | undefined {
  switch (field.type) {
    case 'date':
      return 'Ej.: ayer o 16/11';
    case 'time':
      return 'Ej.: 13:30';
    case 'money':
      return 'Ej.: 1.500 o 1500,50';
    case 'enum':
      return listOptions(field.options.map((option) => optionLabel(field, option).toLowerCase()));
    case 'number':
    case 'int':
      if (field.min !== undefined && field.max !== undefined) return `Del ${field.min} al ${field.max}`;
      if (field.min !== undefined) return `${field.min} o más`;
      if (field.max !== undefined) return `${field.max} o menos`;
      return undefined;
    case 'text':
      return undefined;
  }
}

function fieldHelp(field: FieldDefinition): string {
  const parts: string[] = [];
  if (!isRequired(field)) {
    const value = defaultText(field);
    parts.push(value ? `opcional (si no va: ${value})` : 'opcional');
  }
  const hint = field.hint ?? typeHint(field);
  if (hint) parts.push(hint);
  const detail = parts.map((part, i) => (i === 0 ? lowerFirst(part) : upperFirst(part))).join('. ');
  return `• ${fieldLabel(field)}${detail ? `: ${detail}` : ''}`;
}

/**
 * Mensaje de formato de un comando, armado desde sus campos y su ejemplo.
 * Usa el formato de WhatsApp (`*negrita*`, `_cursiva_`).
 * @param keyword la palabra clave que se escribió (se muestra esa en el formato).
 */
export function commandHelp(area: AreaDefinition, command: CommandDefinition, keyword: string = command.keywords[0]!): string {
  const fields = writtenFields(command);
  const others = command.keywords.filter((k) => normalizeText(k) !== normalizeText(keyword));
  return [
    `${area.emoji} *${command.description}*`,
    [keyword, fields.map((field) => fieldLabel(field).toLowerCase()).join(' - ')].filter(Boolean).join(' '),
    ...fields.map(fieldHelp),
    `Ejemplo: ${command.example}`,
    ...(others.length > 0 ? [`_También sirve: ${others.join(', ')}_`] : []),
  ].join('\n');
}
