/**
 * Errores de los servicios. La API los traduce a 400/404 y el bot (fase 3)
 * los muestra tal cual: los mensajes ya están pensados para leerse.
 */

export class NotFoundError extends Error {
  override name = 'NotFoundError';
}

export class ValidationError extends Error {
  override name = 'ValidationError';
  /** Error por campo: `{ monto: 'tiene que ser mayor a 0' }` (`_` = del registro entero). */
  readonly fields: Record<string, string>;

  constructor(fields: Record<string, string>, labels: Record<string, string> = {}) {
    const detail = Object.entries(fields)
      .map(([key, message]) => (key === '_' ? message : `${labels[key] ?? key}: ${message}`))
      .join('; ');
    super(`Datos inválidos. ${detail}`);
    this.fields = fields;
  }
}
