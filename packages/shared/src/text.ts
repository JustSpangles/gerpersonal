/**
 * Normaliza texto para comparar palabras clave: minúsculas, sin tildes y
 * sin espacios de más. `Comí` → `comi`, `  SÍ ` → `si`.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
