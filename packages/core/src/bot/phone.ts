/**
 * Números de teléfono: solo dígitos, con código de país. En Argentina, los
 * celulares en WhatsApp llevan el 9: `54 9 11 1234-5678` → `5491112345678`.
 *
 * Acepta también un JID de WhatsApp (`5491112345678@s.whatsapp.net`, o con
 * dispositivo: `5491112345678:12@s.whatsapp.net`) y se queda con el número.
 */
export function normalizePhone(text: string): string {
  const number = text.split('@')[0]!.split(':')[0]!;
  return number.replace(/\D/g, '');
}

/** Un número normalizado válido: entre 8 y 15 dígitos (máximo internacional). */
export function isValidPhone(number: string): boolean {
  return /^\d{8,15}$/.test(number);
}
