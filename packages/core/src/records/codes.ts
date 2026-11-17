import { formatCode } from '@ger/shared';
import type { Db } from '../db/database.ts';

/**
 * Reserva el próximo código de un área (C14, F203…).
 * Usa un contador por prefijo, así los números nunca se reutilizan aunque se
 * borren registros. Llamarla dentro de la misma transacción que el INSERT.
 */
export function nextCode(db: Db, prefix: string): string {
  if (!/^[A-Z]$/.test(prefix)) throw new Error(`Prefijo inválido: "${prefix}"`);
  const row = db
    .prepare(
      `INSERT INTO counters (prefix, last_number) VALUES (?, 1)
       ON CONFLICT (prefix) DO UPDATE SET last_number = last_number + 1
       RETURNING last_number`,
    )
    .get(prefix) as { last_number: number };
  return formatCode(prefix, row.last_number);
}
