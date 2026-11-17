/**
 * Códigos de registro: prefijo del área + número correlativo (C14, F203, S3).
 * Los números los asigna el núcleo y nunca se reutilizan.
 */

export interface ParsedCode {
  prefix: string;
  number: number;
}

export function formatCode(prefix: string, number: number): string {
  if (!/^[A-Z]$/.test(prefix)) throw new Error(`Prefijo inválido: "${prefix}"`);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`Número de código inválido: ${number}`);
  return `${prefix}${number}`;
}

/** Interpreta un código escrito a mano. Acepta minúsculas (`c14` → C14). */
export function parseCode(text: string): ParsedCode | null {
  const match = /^([a-z])(\d+)$/i.exec(text.trim());
  if (!match) return null;
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return { prefix: match[1]!.toUpperCase(), number };
}
