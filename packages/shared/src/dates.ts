import { TIMEZONE } from './constants.ts';
import { normalizeText } from './text.ts';

/**
 * Fechas y horas. En la base van en ISO (`2026-11-16`, `13:30`); se muestran
 * en formato argentino (`16/11`, 24 h). "Hoy" y "ahora" son siempre los de
 * la zona horaria del sistema, aunque el núcleo corra en otro lado.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

function zonedParts(now: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Fecha de hoy (`AAAA-MM-DD`) en la zona horaria del sistema. */
export function todayISO(now: Date = new Date(), timeZone: string = TIMEZONE): string {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hora actual (`HH:MM`) en la zona horaria del sistema. */
export function nowTime(now: Date = new Date(), timeZone: string = TIMEZONE): string {
  const p = zonedParts(now, timeZone);
  return `${p.hour}:${p.minute}`;
}

export function isValidISODate(text: string): boolean {
  const match = ISO_DATE.exec(text);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidTime(text: string): boolean {
  return HH_MM.test(text);
}

export function isValidMonth(text: string): boolean {
  const match = ISO_MONTH.exec(text);
  return Boolean(match) && Number(match![2]) >= 1 && Number(match![2]) <= 12;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Suma (o resta) días a una fecha ISO. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return toISO(new Date(Date.UTC(y, m - 1, d + days)));
}

const RELATIVE_DAYS: Record<string, number> = {
  hoy: 0,
  ayer: -1,
  anteayer: -2,
  manana: 1,
  'pasado manana': 2,
};

/**
 * Interpreta una fecha escrita a mano. Acepta `hoy`, `ayer`, `anteayer`,
 * `mañana`, `16/11`, `16/11/26`, `16/11/2026` y `2026-11-16`.
 * Sin año, toma el año actual. Devuelve `null` si no es una fecha válida.
 */
export function parseDateInput(text: string, now: Date = new Date()): string | null {
  const s = normalizeText(text);
  const today = todayISO(now);
  const relative = RELATIVE_DAYS[s];
  if (relative !== undefined) return addDays(today, relative);

  if (ISO_DATE.test(s)) return isValidISODate(s) ? s : null;

  const match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(s);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y === undefined ? today.slice(0, 4) : y.length === 2 ? `20${y}` : y;
  const iso = `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  return isValidISODate(iso) ? iso : null;
}

/** Interpreta una hora: `13:30`, `13.30`, `13`, `9hs`, `ahora`. Devuelve `HH:MM` o `null`. */
export function parseTimeInput(text: string, now: Date = new Date()): string | null {
  const s = normalizeText(text);
  if (s === 'ahora') return nowTime(now);
  const match = /^(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs?)?$/.exec(s);
  if (!match) return null;
  const time = `${match[1]!.padStart(2, '0')}:${match[2] ?? '00'}`;
  return isValidTime(time) ? time : null;
}

/** `2026-11-16` → `16/11` (o `16/11/2026` con `year`). */
export function formatDate(iso: string, options: { year?: boolean } = {}): string {
  const [y, m, d] = iso.split('-');
  return options.year ? `${d}/${m}/${y}` : `${d}/${m}`;
}

/** Mes (`AAAA-MM`) de una fecha ISO. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Suma (o resta) meses a un mes `AAAA-MM`. */
export function addMonths(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return toISO(new Date(Date.UTC(y, m - 1 + months, 1))).slice(0, 7);
}

/** Primer y último día de un mes `AAAA-MM`. */
export function monthRange(month: string): { desde: string; hasta: string } {
  const desde = `${month}-01`;
  return { desde, hasta: addDays(`${addMonths(month, 1)}-01`, -1) };
}

/** `2026-11` → `noviembre 2026`. */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MESES[m - 1]} ${y}`;
}

/** `2026-11` → `nov` (para ejes de gráficos). */
export function formatMonthShort(month: string): string {
  return MESES[Number(month.slice(5, 7)) - 1]!.slice(0, 3);
}
