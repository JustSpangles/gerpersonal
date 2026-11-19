/**
 * Montos: en la base y en la API van en CENTAVOS (enteros).
 * Se escriben y se muestran en formato argentino: punto de miles, coma decimal.
 */

const NBSP = ' ';

/**
 * Interpreta un monto escrito a mano y lo devuelve en centavos, o `null` si no se entiende.
 * Acepta `1500`, `1.500`, `1.500,50`, `1500,5`, `$ 1.500` y también `1500.50`
 * (un solo punto seguido de 1 o 2 cifras se toma como decimal).
 */
export function parseMoney(text: string): number | null {
  const s = text.trim().replace(/^\$/, '').replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;

  let integer: string;
  let decimals = '';
  const comma = s.lastIndexOf(',');
  if (comma >= 0) {
    // Con coma: la coma es el decimal y los puntos, separadores de miles.
    integer = s.slice(0, comma);
    decimals = s.slice(comma + 1);
    if (decimals === '' || !isGroupedInteger(integer)) return null;
  } else {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1]!.length !== 3) {
      [integer, decimals] = parts as [string, string];
      if (decimals === '') return null;
    } else {
      if (!isGroupedInteger(s)) return null;
      integer = s;
    }
  }
  if (!/^\d{0,2}$/.test(decimals)) return null;

  const cents = Number(integer.replaceAll('.', '')) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** `1500` o `1.500` o `12.345.678` (puntos de miles bien puestos). */
function isGroupedInteger(text: string): boolean {
  return /^\d+$/.test(text) || /^\d{1,3}(\.\d{3})+$/.test(text);
}

function groupThousands(pesos: number): string {
  return String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Monto para mostrar: `$ 1.500` o `$ 1.500,50` (los centavos solo si hay). */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${NBSP}${formatMoneyInput(Math.abs(cents))}`;
}

/** Monto para un campo de texto editable, sin el signo `$`: `1.500,50`. */
export function formatMoneyInput(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const pesos = Math.floor(abs / 100);
  const rest = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}${groupThousands(pesos)}${rest ? `,${String(rest).padStart(2, '0')}` : ''}`;
}

/** Monto corto para ejes de gráficos: `$ 850`, `$ 15 mil`, `$ 1,2 M`. */
export function formatMoneyShort(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const pesos = Math.abs(cents) / 100;
  let body: string;
  if (pesos >= 1_000_000) body = `${trimDecimal(pesos / 1_000_000)}${NBSP}M`;
  else if (pesos >= 1_000) body = `${trimDecimal(pesos / 1_000)}${NBSP}mil`;
  else body = String(Math.round(pesos));
  return `${sign}$${NBSP}${body}`;
}

function trimDecimal(value: number): string {
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}
