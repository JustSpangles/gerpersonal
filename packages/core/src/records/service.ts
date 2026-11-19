import { formatCode, parseCode, type AreaDefinition, type FieldValues } from '@ger/shared';
import { transaction, type Db } from '../db/database.ts';
import type { RecordsRegistry, RecordView } from './areaRecords.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import { PHOTO_TYPES, type MediaStore } from './media.ts';

/**
 * Servicio genérico de registros: lo que se puede hacer con cualquier código
 * sin saber de qué área es (buscar, editar, borrar, adjuntar fotos). Cada
 * operación va al servicio del área a través de su `records.ts`.
 */

export interface RecordsContext {
  db: Db;
  records: RecordsRegistry;
  media: MediaStore;
}

export interface FoundRecord {
  area: AreaDefinition;
  record: RecordView;
}

/** Foto (u otro archivo) de un registro. Tabla `attachments` (001_init.sql). */
export interface Attachment {
  id: number;
  recordCode: string;
  /** Relativa a `data/media/`. */
  filePath: string;
  mime: string;
  /** ISO 8601 (UTC) */
  createdAt: string;
}

export interface Photo {
  data: Uint8Array;
  mime: string;
}

/** `f14` → `F14`, o `null` si no es un código. */
export function normalizeCode(code: string): string | null {
  const parsed = parseCode(code);
  return parsed ? formatCode(parsed.prefix, parsed.number) : null;
}

const notFound = (code: string) => new NotFoundError(`No existe el registro ${normalizeCode(code) ?? code.trim()}`);

function target(ctx: RecordsContext, code: string) {
  const found = ctx.records.forCode(code);
  if (!found) throw notFound(code);
  return found;
}

// --- Registros -----------------------------------------------------------------

/** El registro con ese código, de cualquier área, o `null` si no existe. */
export function findRecord(ctx: RecordsContext, code: string): FoundRecord | null {
  const found = ctx.records.forCode(code);
  const record = found?.records.find(ctx.db, code);
  return found && record ? { area: found.area, record } : null;
}

export function getRecord(ctx: RecordsContext, code: string): FoundRecord {
  const found = findRecord(ctx, code);
  if (!found) throw notFound(code);
  return found;
}

/** Crea un registro con un comando de un área (los valores los valida el servicio del área). */
export function createRecord(
  ctx: RecordsContext,
  areaId: string,
  commandId: string,
  values: FieldValues,
  now: Date = new Date(),
): FoundRecord {
  const found = ctx.records.forArea(areaId);
  const create = found?.records.commands[commandId];
  if (!found || !create) throw new Error(`El área "${areaId}" no tiene el comando "${commandId}"`);
  return { area: found.area, record: create(ctx.db, values, now) };
}

/** Cambia uno o más campos de un registro de cualquier área. */
export function updateRecord(ctx: RecordsContext, code: string, patch: FieldValues, now: Date = new Date()): FoundRecord {
  const { area, records } = target(ctx, code);
  return { area, record: records.update(ctx.db, code, patch, now) };
}

/** Borra un registro de cualquier área junto con sus fotos. Su código no se reutiliza. */
export function deleteRecord(ctx: RecordsContext, code: string): FoundRecord & { attachments: Attachment[] } {
  const { area, records } = target(ctx, code);
  const { removed, attachments } = removeWithAttachments(ctx.db, ctx.media, () => records.delete(ctx.db, code));
  return { area, record: removed, attachments };
}

/**
 * Borra un registro con `remove` (el borrado del servicio del área) y,
 * en la misma transacción, sus adjuntos. Los archivos se borran después de
 * confirmar la transacción: si alguno no se puede borrar, el registro igual
 * queda borrado (a lo sumo sobra un archivo en `data/media/`).
 */
export function removeWithAttachments<T extends { code: string }>(
  db: Db,
  media: MediaStore,
  remove: () => T,
): { removed: T; attachments: Attachment[] } {
  const result = transaction(db, () => {
    const removed = remove();
    const attachments = listAttachments(db, removed.code);
    db.prepare('DELETE FROM attachments WHERE record_code = ?').run(removed.code);
    return { removed, attachments };
  });
  for (const attachment of result.attachments) {
    try {
      media.remove(attachment.filePath);
    } catch {
      // Ver el comentario de arriba: no vale la pena fallar por esto.
    }
  }
  return result;
}

// --- Fotos ---------------------------------------------------------------------

interface AttachmentRow {
  id: number;
  record_code: string;
  file_path: string;
  mime: string;
  created_at: string;
}

const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  recordCode: row.record_code,
  filePath: row.file_path,
  mime: row.mime,
  createdAt: row.created_at,
});

/** Fotos de un registro, de la más vieja a la más nueva. */
export function listAttachments(db: Db, code: string): Attachment[] {
  const normalized = normalizeCode(code);
  if (!normalized) return [];
  const rows = db
    .prepare('SELECT id, record_code, file_path, mime, created_at FROM attachments WHERE record_code = ? ORDER BY id')
    .all(normalized) as unknown as AttachmentRow[];
  return rows.map(toAttachment);
}

/** Guarda una foto en `data/media/` y la liga al registro. */
export function attachPhoto(ctx: RecordsContext, code: string, photo: Photo, now: Date = new Date()): Attachment {
  if (!PHOTO_TYPES[photo.mime]) throw new ValidationError({ foto: 'tiene que ser una foto JPG, PNG o WebP' });
  const { record } = getRecord(ctx, code);

  const file = ctx.media.save(record.code, photo.data, photo.mime, now);
  try {
    const row = ctx.db
      .prepare(
        `INSERT INTO attachments (record_code, file_path, mime, created_at) VALUES (?, ?, ?, ?)
         RETURNING id, record_code, file_path, mime, created_at`,
      )
      .get(record.code, file, photo.mime, now.toISOString()) as unknown as AttachmentRow;
    return toAttachment(row);
  } catch (error) {
    ctx.media.remove(file);
    throw error;
  }
}
