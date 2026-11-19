import { loadAreaRegistry } from '@ger/shared/node';
import { createTestDb, createTestMedia, removeTestMedia } from '../db/testing.ts';
import { buildRecordsRegistry, loadAreaRecords } from '../records/areaRecords.ts';
import type { RecordsContext } from '../records/service.ts';
import { createBot } from './bot.ts';
import type { Bot, IncomingMessage, OutgoingMessage } from './types.ts';

/** Números de mentira para los tests. Nunca usar números reales. */
export const GER = '5491100000001';
export const OTRO = '5491100000099';

/** Jueves 19/11/2026 13:30 en Buenos Aires. */
export const TEST_NOW = new Date('2026-11-19T16:30:00Z');

/** Una "foto" JPG de mentira. */
export const JPG = { data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), mime: 'image/jpeg' };

/**
 * Los montos llevan un espacio duro entre `$` y el número (así WhatsApp no
 * los corta en dos renglones). En los tests se cambia por uno común para
 * poder escribir los textos esperados.
 */
export const plain = (text: string) => text.replaceAll(' ', ' ');

const areas = await loadAreaRegistry();
const handlers = await loadAreaRecords();

export interface TestBot {
  bot: Bot;
  ctx: RecordsContext;
  /** Reloj del bot: se puede mover (`clock.now = …`). */
  clock: { now: Date };
  errors: unknown[];
  /** Manda un mensaje de Ger (o de quien diga `extra.from`). */
  send(text: string, extra?: Partial<IncomingMessage>): Promise<OutgoingMessage[]>;
  /** Como `send`, pero devuelve las respuestas como texto (las fotos como `[foto: pie]`). */
  say(text: string, extra?: Partial<IncomingMessage>): Promise<string>;
  cleanup(): void;
}

/** Bot con base en memoria y carpeta de fotos temporal (solo para tests). */
export function createTestBot(allowedNumbers: readonly string[] = [`+${GER}`]): TestBot {
  const ctx: RecordsContext = { db: createTestDb(), records: buildRecordsRegistry(areas, handlers), media: createTestMedia() };
  const clock = { now: new Date(TEST_NOW) };
  const errors: unknown[] = [];
  const bot = createBot({ ...ctx, areas, allowedNumbers, now: () => clock.now, onError: (error) => errors.push(error) });

  const send = (text: string, extra: Partial<IncomingMessage> = {}) => bot.handle({ from: GER, text, ...extra });
  return {
    bot,
    ctx,
    clock,
    errors,
    send,
    async say(text, extra) {
      const replies = await send(text, extra);
      return plain(replies.map((reply) => (reply.type === 'text' ? reply.text : `[foto: ${reply.caption ?? ''}]`)).join('\n---\n'));
    },
    cleanup: () => removeTestMedia(ctx.media),
  };
}
