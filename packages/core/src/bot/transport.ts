import type { Bot, IncomingMessage, OutgoingMessage } from './types.ts';

/**
 * Lo que tiene que implementar la conexión con WhatsApp (fase 3b, Baileys).
 *
 * El transporte se ocupa de todo lo de WhatsApp: vincular por QR, guardar la
 * sesión en `data/`, ignorar los mensajes propios y de grupos, bajar las
 * fotos, y traducir cada mensaje a `IncomingMessage` (el número de quien
 * escribe en `from`, el texto o pie de foto, y si responde a un mensaje del
 * bot, ese texto en `quoted`). Puede sumarle sus propios datos al mensaje
 * (`M`): le vuelven en `send` para saber a qué chat contestar.
 */
export interface BotTransport<M extends IncomingMessage = IncomingMessage> {
  /** Conecta y empieza a pasarle cada mensaje que llega a `onMessage`. */
  start(onMessage: (message: M) => Promise<void>): Promise<void>;
  /** Manda una respuesta al chat del mensaje `to`. */
  send(to: M, reply: OutgoingMessage): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Conecta el bot con un transporte. Los mensajes se procesan de a uno y en
 * el orden en que llegan (importa para `borrar` → `sí`). Si algo falla con un
 * mensaje, se avisa en `onError` y se sigue con el siguiente.
 */
export async function runBot<M extends IncomingMessage>(
  bot: Bot,
  transport: BotTransport<M>,
  onError: (error: unknown) => void = (error) => console.error('Bot:', error),
): Promise<void> {
  let queue = Promise.resolve();
  await transport.start((message) => {
    queue = queue.then(async () => {
      try {
        for (const reply of await bot.handle(message)) await transport.send(message, reply);
      } catch (error) {
        onError(error);
      }
    });
    return queue;
  });
}
