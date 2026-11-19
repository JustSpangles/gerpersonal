import {
  commandHelp,
  createCommandMatcher,
  createKeywordIndex,
  fieldLabel,
  normalizeText,
  parseCommandArgs,
  parseFieldValue,
  splitFields,
  type AreaRegistry,
  type CommandMatch,
  type FieldDefinition,
} from '@ger/shared';
import type { Db } from '../db/database.ts';
import type { RecordsRegistry, RecordView } from '../records/areaRecords.ts';
import { NotFoundError, ValidationError } from '../records/errors.ts';
import { PHOTO_TYPES, type MediaStore } from '../records/media.ts';
import {
  attachPhoto,
  createRecord,
  deleteRecord,
  findRecord,
  listAttachments,
  normalizeCode,
  updateRecord,
  type FoundRecord,
  type RecordsContext,
} from '../records/service.ts';
import * as msg from './messages.ts';
import { normalizePhone } from './phone.ts';
import type { Bot, IncomingMessage, IncomingPhoto, OutgoingMessage } from './types.ts';

/**
 * El bot sin WhatsApp: mensaje entrante → respuestas. Es una capa fina:
 * interpreta el texto y llama a los servicios (los de cada área a través de
 * la capa genérica de registros). No sabe nada de Baileys; la fase 3b lo
 * conecta con `runBot` (transport.ts).
 *
 * Lo único que recuerda entre mensajes es el `borrar` que espera un `sí`
 * (en memoria: si el núcleo se reinicia, se pierde y hay que pedirlo de nuevo).
 */

export interface BotDeps {
  db: Db;
  areas: AreaRegistry;
  records: RecordsRegistry;
  media: MediaStore;
  /** Lista blanca (`bot.allowedNumbers` de config.json). Al resto no le responde. */
  allowedNumbers: readonly string[];
  /** Reloj (para los tests). */
  now?: () => Date;
  /** Errores inesperados. El bot igual le contesta a Ger que algo falló. */
  onError?: (error: unknown, message: IncomingMessage) => void;
  /** Cuánto espera el `sí` de un `borrar`. Por defecto, 5 minutos. */
  confirmTimeoutMs?: number;
}

const CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;

type GlobalCommand = 'ayuda' | 'ver' | 'editar' | 'borrar';

const text = (body: string): OutgoingMessage => ({ type: 'text', text: body });

/** `sí`, `Si!`, `SÍ.` → `si`; `no`, `No.` → `no`; cualquier otra cosa → `null`. */
function yesOrNo(message: IncomingMessage): 'si' | 'no' | null {
  if (message.photo) return null;
  const word = normalizeText(message.text).replace(/[.!¡]+/g, '');
  return word === 'si' || word === 'no' ? word : null;
}

/**
 * El código de registro de un mensaje del bot: está en la primera línea
 * (`✅ 💰 F14 guardado: …`). Sirve para las fotos que responden a ese mensaje.
 */
export function codeInBotMessage(body: string): string | null {
  const firstLine = body.split('\n')[0] ?? '';
  const match = /(?<![\p{L}\d])([A-Z]\d+)(?![\p{L}\d])/u.exec(firstLine);
  return match ? normalizeCode(match[1]!) : null;
}

function findField(record: RecordView, name: string): FieldDefinition | undefined {
  const wanted = normalizeText(name);
  return record.fields.find((field) => normalizeText(fieldLabel(field)) === wanted || normalizeText(field.key) === wanted);
}

export function createBot(deps: BotDeps): Bot {
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.confirmTimeoutMs ?? CONFIRM_TIMEOUT_MS;
  const ctx: RecordsContext = { db: deps.db, records: deps.records, media: deps.media };
  const allowed = new Set(deps.allowedNumbers.map(normalizePhone));
  const matchCommand = createCommandMatcher(deps.areas);
  const matchGlobal = createKeywordIndex<GlobalCommand>([
    ['ayuda', 'ayuda'],
    ['ver', 'ver'],
    ['editar', 'editar'],
    ['borrar', 'borrar'],
  ]);
  const ex = msg.examplesFrom(deps.areas);
  /** `borrar` que espera el `sí`, por número. */
  const pending = new Map<string, { code: string; until: number }>();

  // --- Comandos de las áreas ---------------------------------------------------

  function runCommand(match: CommandMatch): { reply: string; created?: FoundRecord } {
    const format = commandHelp(match.area, match.command, match.keyword);
    if (match.args === '') return { reply: format };

    const at = now();
    const parsed = parseCommandArgs(match.command, match.args, at);
    if (!parsed.ok) return { reply: `${msg.invalidFields(parsed.errors, match.command.fields)}\n\n${format}` };
    try {
      const created = createRecord(ctx, match.area.id, match.command.id, parsed.values, at);
      return { reply: msg.saved(created), created };
    } catch (error) {
      if (error instanceof ValidationError) return { reply: `${msg.invalidFields(error.fields, match.command.fields)}\n\n${format}` };
      throw error;
    }
  }

  // --- Comandos globales -------------------------------------------------------

  function ver(rest: string): OutgoingMessage[] {
    if (rest === '') return [text(msg.verHelp(ex))];
    const code = normalizeCode(rest);
    if (!code) return [text(msg.notACode(rest, ex))];
    const found = findRecord(ctx, code);
    if (!found) return [text(msg.notFound(code))];

    const attachments = listAttachments(deps.db, code);
    return [
      text(msg.recordDetail(found, attachments.length)),
      ...attachments.map(
        (attachment, i): OutgoingMessage => ({
          type: 'photo',
          path: deps.media.resolve(attachment.filePath),
          mime: attachment.mime,
          caption: msg.photoCaption(code, i + 1, attachments.length),
        }),
      ),
    ];
  }

  function editar(rest: string): string {
    if (rest === '') return msg.editarHelp(ex);
    const [, codeText = '', after = ''] = /^(\S+)\s*(.*)$/s.exec(rest) ?? [];
    const code = normalizeCode(codeText);
    if (!code) return `${msg.notACode(codeText, ex)}\n\n${msg.editarHelp(ex)}`;
    const found = findRecord(ctx, code);
    if (!found) return msg.notFound(code);
    const { record } = found;
    if (after.trim() === '') return msg.editWhichField(record);

    // `campo - valor`; sin guion se acepta `campo valor` (la primera palabra es el campo).
    const parts = splitFields(after);
    const [, firstWord = '', restWords = ''] = /^(\S+)\s*(.*)$/s.exec(after.trim()) ?? [];
    const name = parts.length > 1 ? parts[0]! : firstWord;
    const value = parts.length > 1 ? parts.slice(1).join(' - ') : restWords.trim() || undefined;

    const field = findField(record, name);
    if (!field) return msg.unknownField(record, name);
    const problem = (errors: Record<string, string>) => `${msg.invalidFields(errors, record.fields)}\n${msg.editFormat(record, field)}`;
    if (value === undefined) return problem({ [field.key]: 'falta' });

    const at = now();
    const parsed = parseFieldValue(field, value, at);
    if (!parsed.ok) return problem({ [field.key]: parsed.error });
    try {
      return msg.edited(updateRecord(ctx, code, { [field.key]: parsed.value }, at), field, record.values[field.key]);
    } catch (error) {
      if (error instanceof ValidationError) return problem(error.fields);
      if (error instanceof NotFoundError) return msg.notFound(code);
      throw error;
    }
  }

  function borrar(from: string, rest: string): string {
    if (rest === '') return msg.borrarHelp(ex);
    const code = normalizeCode(rest);
    if (!code) return msg.notACode(rest, ex);
    const found = findRecord(ctx, code);
    if (!found) return msg.notFound(code);

    pending.set(from, { code, until: now().getTime() + timeoutMs });
    return msg.confirmDelete(found, listAttachments(deps.db, code).length);
  }

  function confirmDelete(code: string): string {
    try {
      return msg.deleted(code, deleteRecord(ctx, code).attachments.length);
    } catch (error) {
      if (error instanceof NotFoundError) return msg.notFound(code);
      throw error;
    }
  }

  // --- Fotos -------------------------------------------------------------------

  function attach(code: string, photo: IncomingPhoto): string {
    try {
      attachPhoto(ctx, code, photo, now());
    } catch (error) {
      if (error instanceof NotFoundError) return msg.photoNotSaved(code);
      throw error;
    }
    return msg.photoSaved(code, listAttachments(deps.db, code).length);
  }

  /**
   * Una foto va al registro del código escrito de pie; si el pie es un
   * comando, se crea el registro y la foto queda en él; si no, al registro
   * del mensaje del bot que se está respondiendo.
   */
  function handlePhoto(message: IncomingMessage, photo: IncomingPhoto): string {
    if (!PHOTO_TYPES[photo.mime]) return msg.photoType;
    const caption = message.text.trim();

    const code = normalizeCode(caption);
    if (code) return attach(code, photo);

    const command = matchCommand(caption);
    if (command && command.args !== '') {
      const result = runCommand(command);
      if (!result.created) return `${result.reply}\n\n${msg.photoAfterError}`;
      return `${result.reply}\n${attach(result.created.record.code, photo)}`;
    }

    const quoted = message.quoted?.fromBot ? codeInBotMessage(message.quoted.text) : null;
    if (quoted) return attach(quoted, photo);
    return msg.photoWhere(ex);
  }

  // --- Entrada -----------------------------------------------------------------

  function process(from: string, message: IncomingMessage): OutgoingMessage[] {
    if (message.photo) return [text(handlePhoto(message, message.photo))];

    const body = message.text.trim();
    if (body === '') return [text(msg.onlyTextAndPhotos)];

    const global = matchGlobal(body);
    switch (global?.value) {
      case 'ayuda':
        return [text(msg.help(deps.areas, ex))];
      case 'ver':
        return ver(global.rest);
      case 'editar':
        return [text(editar(global.rest))];
      case 'borrar':
        return [text(borrar(from, global.rest))];
    }

    const command = matchCommand(body);
    if (command) return [text(runCommand(command).reply)];
    return [text(msg.notUnderstood(body))];
  }

  function route(from: string, message: IncomingMessage): OutgoingMessage[] {
    const answer = yesOrNo(message);
    const waiting = pending.get(from);
    pending.delete(from);

    if (waiting && now().getTime() <= waiting.until) {
      if (answer === 'si') return [text(confirmDelete(waiting.code))];
      // Cualquier otra cosa cancela. Si es otro comando, además se hace.
      const cancelled = text(msg.deleteCancelled(waiting.code));
      return answer === 'no' ? [cancelled] : [cancelled, ...process(from, message)];
    }
    if (waiting && answer === 'si') return [text(msg.deleteExpired(waiting.code))];
    if (answer) return [text(msg.nothingToConfirm)];
    return process(from, message);
  }

  return {
    async handle(message) {
      const from = normalizePhone(message.from);
      if (!allowed.has(from)) return [];
      try {
        return route(from, message);
      } catch (error) {
        deps.onError?.(error, message);
        return [text(msg.unexpectedError)];
      }
    },
  };
}
