import { relative } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { listMovimientos } from '../areas/finanzas/service.ts';
import { listAttachments } from '../records/service.ts';
import { createTestBot, JPG, OTRO, plain, TEST_NOW } from './testing.ts';
import type { IncomingMessage, OutgoingMessage } from './types.ts';

/**
 * Conversación de ejemplo: le manda al bot una charla entera y anota las
 * respuestas reales en `conversacion-ejemplo.md`, para que Ger las lea.
 * Si cambia alguna respuesta, este test falla; para aceptar el cambio:
 * `npx vitest run -u`.
 */

const t = createTestBot();
afterAll(() => t.cleanup());

const lines: string[] = [
  '# Conversación de ejemplo con el bot',
  '',
  'Son las respuestas **reales** del bot. Este archivo lo arma `conversation.test.ts` mandándole cada mensaje',
  'al bot, sin WhatsApp de por medio. Si cambia alguna respuesta, el test falla; para aceptar el cambio:',
  '`npx vitest run -u`.',
  '',
  `La charla es el jueves 19/11/2026 desde las 13:30 (un minuto entre mensaje y mensaje) y la base arranca vacía.`,
  'En WhatsApp, `*así*` se ve en **negrita** y `_así_` en _cursiva_.',
];

const section = (title: string) => lines.push('', `## ${title}`);

const quote = (text: string) => {
  const first = plain(text.split('\n')[0] ?? '');
  return first.length > 40 ? `${first.slice(0, 39)}…` : first;
};

function render(reply: OutgoingMessage): string {
  if (reply.type === 'text') return plain(reply.text);
  const file = relative(t.ctx.media.dir, reply.path).replaceAll('\\', '/');
  return `📷 [foto ${file}]${reply.caption ? ` ${reply.caption}` : ''}`;
}

/** Manda un mensaje, anota la charla y devuelve las respuestas. */
async function send(text: string, extra: Partial<IncomingMessage> = {}, who = 'Ger'): Promise<OutgoingMessage[]> {
  const replies = await t.send(text, extra);
  t.clock.now = new Date(t.clock.now.getTime() + 60_000);

  let said = text === '' ? '' : `\`${text}\``;
  if (extra.photo) {
    const quoted = extra.quoted ? ` respondiendo a «${quote(extra.quoted.text)}»` : '';
    said = `📷 _foto_${text ? ` con el pie ${said}` : ''}${quoted}`;
  } else if (text === '') said = '🎤 _audio_';

  lines.push('', `**${who}:** ${said}`, '');
  if (replies.length === 0) lines.push('_(no hay respuesta: ese número no está en la lista blanca)_');
  for (const reply of replies) lines.push('```', render(reply), '```');
  return replies;
}

const textOf = (replies: OutgoingMessage[]) => (replies[0]?.type === 'text' ? replies[0].text : '');

it('conversación de ejemplo (ver conversacion-ejemplo.md)', async () => {
  expect(t.clock.now).toEqual(TEST_NOW);

  section('Qué sabe hacer');
  await send('ayuda');

  section('Anotar gastos e ingresos');
  await send('gasté');
  const almuerzo = await send('gasté 1.500 - comida - almuerzo con Juan - ayer');
  await send('Cobré 350.000 - sueldo');
  await send('pagué 12.000,50 - Luz - - 15/11');

  section('Cuando algo está mal');
  await send('gasté mil - comida');
  await send('gasté 2500');
  await send('gaste 800 - café - - el lunes');

  section('Fotos');
  await send('', { photo: JPG, quoted: { text: textOf(almuerzo), fromBot: true } });
  await send('F3', { photo: JPG });
  await send('gasté 8.900 - super - compra semanal', { photo: JPG });
  await send('', { photo: JPG });

  section('Ver, corregir y borrar');
  await send('ver F1');
  await send('editar F1 monto - 1.800');
  await send('editar F3 nota - factura de octubre');
  await send('editar F1 color - rojo');
  await send('borrar F2');
  await send('sí');
  await send('borrar F4');
  await send('gasté 300 - café');
  await send('ver F2');

  section('Otras cosas');
  await send('hola!');
  await send('');
  await send('ayuda', { from: OTRO }, 'Otro número');

  // Lo que quedó guardado, por si el texto engaña.
  expect(listMovimientos(t.ctx.db).map((m) => m.code).sort()).toEqual(['F1', 'F3', 'F4', 'F5']);
  expect(['F1', 'F3', 'F4'].map((code) => listAttachments(t.ctx.db, code).length)).toEqual([1, 1, 1]);
  expect(t.errors).toEqual([]);

  await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./conversacion-ejemplo.md');
});
