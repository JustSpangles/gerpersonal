/**
 * Lo que entra y sale del bot, sin nada de WhatsApp. La fase 3b solo tiene
 * que traducir los mensajes de Baileys a `IncomingMessage` y mandar cada
 * `OutgoingMessage` (ver `BotTransport` en `transport.ts`).
 */

export interface IncomingPhoto {
  data: Uint8Array;
  /** `image/jpeg`, `image/png` o `image/webp`. */
  mime: string;
}

export interface IncomingMessage {
  /**
   * Número de quien escribe, con código de país (`5491112345678`). También
   * sirve el JID de WhatsApp: se normaliza solo. Es lo que se compara con la lista blanca.
   */
  from: string;
  /** Texto del mensaje, o el pie de la foto. Vacío si no hay (audio, sticker…). */
  text: string;
  photo?: IncomingPhoto;
  /** El mensaje que se está respondiendo (citando), si hay uno. */
  quoted?: {
    text: string;
    /** true si el mensaje citado lo mandó el bot (solo esos sirven para adjuntar fotos). */
    fromBot: boolean;
  };
}

export type OutgoingMessage =
  | { type: 'text'; text: string }
  /** Una foto guardada: `path` es la ruta absoluta del archivo en `data/media/`. */
  | { type: 'photo'; path: string; mime: string; caption?: string };

export interface Bot {
  /**
   * Procesa un mensaje y devuelve las respuestas, en orden. Si el número no
   * está en la lista blanca, no devuelve nada (el bot lo ignora).
   */
  handle(message: IncomingMessage): Promise<OutgoingMessage[]>;
}
