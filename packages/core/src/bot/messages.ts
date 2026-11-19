import {
  createCommandMatcher,
  fieldLabel,
  formatFieldValue,
  isNullable,
  splitFields,
  writtenFields,
  type AreaRegistry,
  type FieldDefinition,
} from '@ger/shared';
import type { RecordView } from '../records/areaRecords.ts';
import type { FoundRecord } from '../records/service.ts';

/**
 * Todos los textos del bot, en un solo lugar para poder cambiarlos fácil.
 * Formato de WhatsApp: *negrita* y _cursiva_. Cortos, con el emoji del área
 * y siempre con el código del registro en la primera línea (así, si Ger
 * responde a un mensaje con una foto, se sabe a qué registro va).
 *
 * Los formatos de los comandos de las áreas NO están acá: salen de la
 * definición de cada comando (`commandHelp` en shared).
 */

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Para repetir lo que escribió Ger sin llenar la pantalla. */
const short = (text: string) => {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 30 ? `${oneLine.slice(0, 29)}…` : oneLine;
};

const joinAnd = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;

const photos = (count: number) => (count === 1 ? '1 foto' : `${count} fotos`);

const fieldNames = (record: RecordView) => joinAnd(record.fields.map((field) => fieldLabel(field).toLowerCase()));

/** Los valores del registro en una línea: `Gasto · $ 1.500 · Comida · 18/11`. */
export function summary(record: RecordView): string {
  return record.fields
    .map((field) => formatFieldValue(field, record.values[field.key]))
    .filter((text) => text !== '')
    .join(' · ');
}

// --- Ayuda y formatos de los comandos globales ---------------------------------

/** Ejemplos para los comandos globales, sacados del primer comando de un área: `F14`, `monto`, `1.500`. */
export interface Examples {
  code: string;
  field: string;
  value: string;
  /** Un campo que se puede vaciar (para el ejemplo de `editar`), si hay. */
  optionalField?: string;
}

export function examplesFrom(areas: AreaRegistry): Examples {
  const area = areas.all.find((a) => a.commands.length > 0);
  const command = area?.commands[0];
  if (!area || !command) return { code: `${areas.all[0]?.prefix ?? 'F'}14`, field: 'campo', value: 'valor' };

  const fields = writtenFields(command);
  const args = createCommandMatcher(areas)(command.example)?.args ?? '';
  const optional = fields.find(isNullable);
  return {
    code: `${area.prefix}14`,
    field: fieldLabel(fields[0]!).toLowerCase(),
    value: splitFields(args)[0] || 'valor',
    ...(optional ? { optionalField: fieldLabel(optional).toLowerCase() } : {}),
  };
}

export function help(areas: AreaRegistry, ex: Examples): string {
  const active = areas.all.filter((area) => area.commands.length > 0);
  const soon = areas.all.filter((area) => area.commands.length === 0);
  const firstKeyword = active[0]?.commands[0]?.keywords[0];

  const areaBlocks = active.map((area) =>
    [
      `${area.emoji} *${area.name}*`,
      ...area.commands.map((command) => {
        const [main, ...others] = command.keywords;
        return `• *${main}*${others.length > 0 ? ` (${others.join(', ')})` : ''}: ${lowerFirst(command.description)}`;
      }),
    ].join('\n'),
  );

  return [
    '📋 *Comandos*',
    ...areaBlocks,
    [
      '🔧 *Con cualquier registro*',
      `• *ver* ${ex.code}: muestra el registro y sus fotos`,
      `• *editar* ${ex.code} ${ex.field} - ${ex.value}: corrige un campo`,
      `• *borrar* ${ex.code}: lo borra (te pido que confirmes)`,
      `• 📷 Una foto con el código de pie (${ex.code}), o respondiendo a uno de mis mensajes, queda guardada en ese registro`,
    ].join('\n'),
    [
      ...(firstKeyword ? [`Mandame solo la palabra clave (ej.: *${firstKeyword}*) y te explico el formato.`] : []),
      ...(soon.length > 0 ? [`_Más adelante: ${joinAnd(soon.map((area) => area.name))}._`] : []),
    ].join('\n'),
  ]
    .filter((block) => block !== '')
    .join('\n\n');
}

export const verHelp = (ex: Examples) => ['🔎 *Ver un registro*', 'ver código', `Ejemplo: ver ${ex.code}`].join('\n');

export const editarHelp = (ex: Examples) =>
  [
    '✏️ *Corregir un campo*',
    'editar código campo - valor',
    `Ejemplo: editar ${ex.code} ${ex.field} - ${ex.value}`,
    ...(ex.optionalField ? [`_Para vaciar un campo opcional, sin valor: editar ${ex.code} ${ex.optionalField} -_`] : []),
  ].join('\n');

export const borrarHelp = (ex: Examples) =>
  ['🗑️ *Borrar un registro*', 'borrar código', `Ejemplo: borrar ${ex.code}`, '_Antes de borrar te pido que confirmes con *sí*._'].join('\n');

// --- Registros -----------------------------------------------------------------

export const saved = ({ area, record }: FoundRecord) => `✅ ${area.emoji} ${record.code} guardado: ${summary(record)}`;

export function recordDetail({ area, record }: FoundRecord, photoCount: number): string {
  return [
    `${area.emoji} *${record.code}* · ${area.name}`,
    ...record.fields.map((field) => `${fieldLabel(field)}: ${formatFieldValue(field, record.values[field.key]) || '—'}`),
    ...(photoCount > 0 ? [`📎 ${photos(photoCount)}`] : []),
    `_Para corregir: editar ${record.code} campo - valor_`,
  ].join('\n');
}

export const photoCaption = (code: string, index: number, total: number) =>
  total === 1 ? code : `${code} · foto ${index} de ${total}`;

export function edited({ area, record }: FoundRecord, field: FieldDefinition, before: unknown): string {
  const show = (value: unknown) => formatFieldValue(field, value) || '—';
  return [
    `✏️ ${area.emoji} ${record.code} corregido · ${fieldLabel(field)}: ${show(before)} → ${show(record.values[field.key])}`,
    summary(record),
  ].join('\n');
}

export const editWhichField = (record: RecordView) =>
  [`✏️ ¿Qué campo de ${record.code}? Tiene: ${fieldNames(record)}.`, `Formato: editar ${record.code} campo - valor`].join('\n');

export const unknownField = (record: RecordView, name: string) =>
  [`⚠️ ${record.code} no tiene el campo «${short(name)}». Tiene: ${fieldNames(record)}.`, `Formato: editar ${record.code} campo - valor`].join(
    '\n',
  );

export const editFormat = (record: RecordView, field: FieldDefinition) =>
  `Formato: editar ${record.code} ${fieldLabel(field).toLowerCase()} - valor`;

export function confirmDelete({ area, record }: FoundRecord, photoCount: number): string {
  return [
    `🗑️ ${area.emoji} ¿Borro ${record.code}? ${summary(record)}${photoCount > 0 ? ` · con ${photos(photoCount)}` : ''}`,
    'Respondé *sí* para borrarlo. Cualquier otra cosa lo cancela.',
  ].join('\n');
}

export function deleted(code: string, photoCount: number): string {
  if (photoCount === 0) return `🗑️ ${code} borrado.`;
  return `🗑️ ${code} borrado, ${photoCount === 1 ? 'con su foto' : `con sus ${photos(photoCount)}`}.`;
}

export const deleteCancelled = (code: string) => `👌 No borré ${code}.`;

export const deleteExpired = (code: string) =>
  `⌛ Pasó mucho tiempo y no borré ${code}. Si querés borrarlo, mandá *borrar ${code}* de nuevo.`;

export const nothingToConfirm = '🤔 No tenía nada para confirmar.';

export const notFound = (code: string) => `⚠️ No existe el registro ${code}.`;

export const notACode = (text: string, ex: Examples) =>
  `⚠️ «${short(text)}» no es un código. Los códigos son una letra y un número, como ${ex.code}.`;

/** Errores por campo (`_` = del mensaje entero). Los que faltan van juntos en una línea. */
export function invalidFields(errors: Record<string, string>, fields: readonly FieldDefinition[]): string {
  const labels = new Map(fields.map((field) => [field.key, fieldLabel(field)]));
  const label = (key: string) => labels.get(key) ?? key;
  const entries = Object.entries(errors);

  const missing = entries.filter(([key, message]) => key !== '_' && message === 'falta').map(([key]) => label(key).toLowerCase());
  const lines = entries
    .filter(([key, message]) => key === '_' || message !== 'falta')
    .map(([key, message]) => (key === '_' ? `⚠️ ${upperFirst(message)}` : `⚠️ ${label(key)}: ${message}`));
  return [...(missing.length > 0 ? [`⚠️ Falta: ${joinAnd(missing)}`] : []), ...lines].join('\n');
}

// --- Fotos ---------------------------------------------------------------------

export const photoSaved = (code: string, total: number) =>
  total === 1 ? `📎 Foto guardada en ${code}.` : `📎 Foto guardada en ${code} (ya tiene ${total}).`;

export const photoWhere = (ex: Examples) =>
  `📷 ¿De qué registro es la foto? No la guardé: mandala de nuevo con el código de pie (ej.: ${ex.code}) o respondiendo a mi mensaje de ese registro.`;

export const photoNotSaved = (code: string) => `⚠️ No existe el registro ${code}, así que no guardé la foto.`;

export const photoType = '⚠️ Solo guardo fotos (JPG, PNG o WebP).';

export const photoAfterError = '📷 La foto no la guardé: mandala de nuevo cuando esté bien el registro.';

// --- Otros ---------------------------------------------------------------------

export const notUnderstood = (text: string) => `🤔 No entendí «${short(text)}». Escribí *ayuda* para ver los comandos.`;

export const onlyTextAndPhotos = '🤔 Por ahora entiendo texto y fotos. Escribí *ayuda* para ver los comandos.';

export const unexpectedError = '⚠️ Algo falló de mi lado y no pude hacerlo. Probá de nuevo en un rato.';
