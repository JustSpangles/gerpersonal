import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findMovimiento, listMovimientos } from '../areas/finanzas/service.ts';
import { attachPhoto, listAttachments } from '../records/service.ts';
import { codeInBotMessage } from './bot.ts';
import { createTestBot, GER, JPG, OTRO, plain, type TestBot } from './testing.ts';
import { runBot, type BotTransport } from './transport.ts';
import type { IncomingMessage, OutgoingMessage } from './types.ts';

let t: TestBot;
beforeEach(() => {
  t = createTestBot();
});
afterEach(() => t.cleanup());

const photo = (caption = '', quoted?: IncomingMessage['quoted']) => ({ photo: JPG, ...(quoted ? { quoted } : {}), text: caption });
const fromBot = (text: string) => ({ text, fromBot: true });

describe('lista blanca', () => {
  it('solo le responde a los números de la lista, escritos como sea', async () => {
    expect(await t.send('ayuda', { from: OTRO })).toEqual([]);
    expect(await t.send('ayuda', { from: `${GER}@s.whatsapp.net` })).toHaveLength(1);
    expect(await t.send('ayuda', { from: `${GER}:3@s.whatsapp.net` })).toHaveLength(1);
  });

  it('con la lista vacía no le responde a nadie', async () => {
    const nadie = createTestBot([]);
    expect(await nadie.send('ayuda')).toEqual([]);
    nadie.cleanup();
  });

  it('a los demás ni siquiera les guarda nada', async () => {
    await t.send('gasté 100 - café', { from: OTRO });
    expect(listMovimientos(t.ctx.db)).toEqual([]);
  });
});

describe('comandos de Finanzas', () => {
  it('solo la palabra clave → formato y ejemplo, con la palabra que se usó', async () => {
    const reply = await t.say('Pagué');
    expect(reply.split('\n').slice(0, 2)).toEqual(['💰 *Anotar un gasto*', 'pagué monto - categoría - nota - fecha']);
    expect(reply).toContain('Ejemplo: gasté 1.500 - comida - almuerzo con Juan - ayer');
  });

  it('guarda el gasto y confirma con el código', async () => {
    expect(await t.say('gasté 1.500 - comida - almuerzo con Juan - ayer')).toBe(
      '✅ 💰 F1 guardado: Gasto · $ 1.500 · comida · almuerzo con Juan · 18/11',
    );
    expect(findMovimiento(t.ctx.db, 'F1')).toMatchObject({ tipo: 'egreso', monto: 150000, nota: 'almuerzo con Juan', fecha: '2026-11-18' });
  });

  it('sin mayúsculas ni tildes, y con los opcionales omitidos', async () => {
    expect(await t.say('COBRE 350.000 - sueldo')).toBe('✅ 💰 F1 guardado: Ingreso · $ 350.000 · sueldo · 19/11');
    expect(await t.say('gaste 200 - Kiosco - - 15/11')).toBe('✅ 💰 F2 guardado: Gasto · $ 200 · Kiosco · 15/11');
  });

  it('reutiliza la categoría que ya existe (como el servicio)', async () => {
    await t.say('gasté 100 - Café');
    expect(await t.say('gasté 100 - cafe')).toContain('· Café ·');
  });

  it('si un campo está mal, dice cuál, repite el formato y no gasta un código', async () => {
    const reply = await t.say('gasté mil - comida');
    expect(reply.split('\n\n')[0]).toBe('⚠️ Monto: no es un monto válido (ej.: 1.500 o 1500,50)');
    expect(reply).toContain('gasté monto - categoría - nota - fecha');
    expect(await t.say('gasté 100 - comida')).toContain('F1 guardado');
  });

  it('avisa lo que falta y lo que sobra', async () => {
    expect((await t.say('gasté 1500')).split('\n')[0]).toBe('⚠️ Falta: categoría');
    expect((await t.say('gasté - comida - nota')).split('\n')[0]).toBe('⚠️ Falta: monto');
    expect((await t.say('gasté 1 - a - b - hoy - otra')).split('\n')[0]).toBe(
      '⚠️ Sobran campos: escribiste 5 y lleva hasta 4, separados por « - »',
    );
  });
});

describe('ayuda y mensajes que no entiende', () => {
  it('ayuda lista los comandos por área, los globales y lo que viene', async () => {
    const reply = await t.say('Ayuda');
    expect(reply).toContain('💰 *Finanzas*\n• *gasté* (gasto, pagué): anotar un gasto\n• *cobré* (ingreso): anotar un ingreso');
    expect(reply).toContain('• *editar* F14 monto - 1.500: corrige un campo');
    expect(reply).toContain('_Más adelante: Salud, Gimnasio, Trabajo (gasista), Alimentación, Calendario y Sobre mí._');
  });

  it('lo que no es un comando, y lo que no es texto ni foto', async () => {
    expect(await t.say('hola che, ¿cómo andás?')).toBe('🤔 No entendí «hola che, ¿cómo andás?». Escribí *ayuda* para ver los comandos.');
    expect(await t.say('')).toBe('🤔 Por ahora entiendo texto y fotos. Escribí *ayuda* para ver los comandos.');
  });

  it('si algo falla adentro, avisa y sigue', async () => {
    t.ctx.db.close();
    expect(await t.say('gasté 100 - café')).toBe('⚠️ Algo falló de mi lado y no pude hacerlo. Probá de nuevo en un rato.');
    expect(t.errors).toHaveLength(1);
  });
});

describe('ver', () => {
  it('muestra todos los campos y sus fotos', async () => {
    await t.say('gasté 1500 - comida');
    attachPhoto(t.ctx, 'F1', JPG, t.clock.now);
    attachPhoto(t.ctx, 'F1', JPG, t.clock.now);

    const [detail, ...photos] = await t.send('ver f1');
    expect(detail?.type === 'text' && plain(detail.text)).toBe(
      [
        '💰 *F1* · Finanzas',
        'Tipo: Gasto',
        'Monto: $ 1.500',
        'Categoría: comida',
        'Nota: —',
        'Fecha: 19/11',
        '📎 2 fotos',
        '_Para corregir: editar F1 campo - valor_',
      ].join('\n'),
    );
    expect(photos).toHaveLength(2);
    expect(photos[1]).toMatchObject({ type: 'photo', mime: 'image/jpeg', caption: 'F1 · foto 2 de 2' });
    expect(existsSync((photos[0] as Extract<OutgoingMessage, { type: 'photo' }>).path)).toBe(true);
  });

  it('códigos que no existen o que no son códigos', async () => {
    expect(await t.say('ver F99')).toBe('⚠️ No existe el registro F99.');
    expect(await t.say('ver C1')).toBe('⚠️ No existe el registro C1.');
    expect(await t.say('ver la luz')).toBe('⚠️ «la luz» no es un código. Los códigos son una letra y un número, como F14.');
    expect(await t.say('ver')).toBe('🔎 *Ver un registro*\nver código\nEjemplo: ver F14');
  });
});

describe('editar', () => {
  beforeEach(async () => {
    await t.say('gasté 1.500 - comida - almuerzo');
  });

  it('corrige un campo y muestra el antes y el después', async () => {
    expect(await t.say('editar f1 monto - 2.000')).toBe(
      '✏️ 💰 F1 corregido · Monto: $ 1.500 → $ 2.000\nGasto · $ 2.000 · comida · almuerzo · 19/11',
    );
    expect(findMovimiento(t.ctx.db, 'F1')?.monto).toBe(200000);
  });

  it('acepta el campo sin tilde, sin guion, y cambiar el tipo', async () => {
    expect(await t.say('editar F1 categoria super')).toContain('Categoría: comida → super');
    expect(await t.say('Editar F1 tipo - ingreso')).toContain('Tipo: Gasto → Ingreso');
  });

  it('vacía un campo opcional sin valor', async () => {
    expect((await t.say('editar F1 nota -')).split('\n')[0]).toBe('✏️ 💰 F1 corregido · Nota: almuerzo → —');
    expect(findMovimiento(t.ctx.db, 'F1')?.nota).toBeNull();
  });

  it('dice qué está mal y repite el formato', async () => {
    expect(await t.say('editar F1 monto - mil')).toBe(
      '⚠️ Monto: no es un monto válido (ej.: 1.500 o 1500,50)\nFormato: editar F1 monto - valor',
    );
    expect(await t.say('editar F1 monto -')).toBe('⚠️ Falta: monto\nFormato: editar F1 monto - valor');
    expect(await t.say('editar F1 fecha')).toBe('⚠️ Falta: fecha\nFormato: editar F1 fecha - valor');
    expect(await t.say('editar F1 color - rojo')).toBe(
      '⚠️ F1 no tiene el campo «color». Tiene: tipo, monto, categoría, nota y fecha.\nFormato: editar F1 campo - valor',
    );
    expect(await t.say('editar F1')).toBe('✏️ ¿Qué campo de F1? Tiene: tipo, monto, categoría, nota y fecha.\nFormato: editar F1 campo - valor');
    expect(await t.say('editar F7 monto - 1')).toBe('⚠️ No existe el registro F7.');
    expect(await t.say('editar')).toContain('editar código campo - valor');
    expect(findMovimiento(t.ctx.db, 'F1')?.monto).toBe(150000);
  });
});

describe('borrar', () => {
  beforeEach(async () => {
    await t.say('gasté 1.500 - comida');
  });

  it('pide confirmación y con «sí» borra; el código no se reutiliza', async () => {
    expect(await t.say('borrar f1')).toBe(
      '🗑️ 💰 ¿Borro F1? Gasto · $ 1.500 · comida · 19/11\nRespondé *sí* para borrarlo. Cualquier otra cosa lo cancela.',
    );
    expect(findMovimiento(t.ctx.db, 'F1')).not.toBeNull();
    expect(await t.say('Sí!')).toBe('🗑️ F1 borrado.');
    expect(findMovimiento(t.ctx.db, 'F1')).toBeNull();
    expect(await t.say('gasté 100 - café')).toContain('F2 guardado');
  });

  it('borra también las fotos', async () => {
    const file = t.ctx.media.resolve(attachPhoto(t.ctx, 'F1', JPG, t.clock.now).filePath);
    expect(await t.say('borrar F1')).toContain('· con 1 foto');
    expect(await t.say('si')).toBe('🗑️ F1 borrado, con su foto.');
    expect(listAttachments(t.ctx.db, 'F1')).toEqual([]);
    expect(existsSync(file)).toBe(false);
  });

  it('«no» cancela', async () => {
    await t.say('borrar F1');
    expect(await t.say('No')).toBe('👌 No borré F1.');
    expect(await t.say('sí')).toBe('🤔 No tenía nada para confirmar.');
    expect(findMovimiento(t.ctx.db, 'F1')).not.toBeNull();
  });

  it('cualquier otra cosa también cancela, y si es un comando, además lo hace', async () => {
    await t.say('borrar F1');
    expect(await t.say('gasté 300 - café')).toBe('👌 No borré F1.\n---\n✅ 💰 F2 guardado: Gasto · $ 300 · café · 19/11');
    expect(findMovimiento(t.ctx.db, 'F1')).not.toBeNull();
  });

  it('el «sí» vale por 5 minutos', async () => {
    await t.say('borrar F1');
    t.clock.now = new Date(t.clock.now.getTime() + 5 * 60 * 1000 + 1);
    expect(await t.say('sí')).toBe('⌛ Pasó mucho tiempo y no borré F1. Si querés borrarlo, mandá *borrar F1* de nuevo.');
    expect(findMovimiento(t.ctx.db, 'F1')).not.toBeNull();
  });

  it('cada número confirma lo suyo', async () => {
    const dos = createTestBot([GER, OTRO]);
    await dos.say('gasté 100 - café');
    await dos.say('borrar F1');
    expect(await dos.say('sí', { from: OTRO })).toBe('🤔 No tenía nada para confirmar.');
    expect(await dos.say('sí')).toBe('🗑️ F1 borrado.');
    dos.cleanup();
  });

  it('formato y códigos que no existen', async () => {
    expect(await t.say('borrar')).toContain('borrar código');
    expect(await t.say('borrar F9')).toBe('⚠️ No existe el registro F9.');
    expect(await t.say('sí')).toBe('🤔 No tenía nada para confirmar.');
  });
});

describe('fotos', () => {
  beforeEach(async () => {
    await t.say('gasté 1.500 - comida');
  });

  it('con el código de pie se guarda en ese registro', async () => {
    expect(await t.say('', photo('f1'))).toBe('📎 Foto guardada en F1.');
    expect(await t.say('', photo(' F1 '))).toBe('📎 Foto guardada en F1 (ya tiene 2).');
    expect(listAttachments(t.ctx.db, 'F1')).toHaveLength(2);
  });

  it('respondiendo a un mensaje del bot se guarda en el registro de ese mensaje', async () => {
    const confirmation = '✅ 💰 F1 guardado: Gasto · $ 1.500 · comida · 19/11';
    expect(await t.say('', photo('', fromBot(confirmation)))).toBe('📎 Foto guardada en F1.');
    // Aunque tenga otro texto de pie.
    expect(await t.say('', photo('el ticket', fromBot(confirmation)))).toBe('📎 Foto guardada en F1 (ya tiene 2).');
  });

  it('un mensaje citado que no es del bot no cuenta', async () => {
    expect(await t.say('', photo('', { text: 'F1', fromBot: false }))).toContain('¿De qué registro es la foto?');
    expect(await t.say('', photo(''))).toContain('¿De qué registro es la foto?');
    expect(await t.say('', photo('', fromBot('📋 *Comandos*\n• *ver* F14')))).toContain('¿De qué registro es la foto?');
    expect(listAttachments(t.ctx.db, 'F1')).toEqual([]);
  });

  it('con un comando de pie, crea el registro y le guarda la foto', async () => {
    expect(await t.say('', photo('gasté 8.900 - super - compra semanal'))).toBe(
      '✅ 💰 F2 guardado: Gasto · $ 8.900 · super · compra semanal · 19/11\n📎 Foto guardada en F2.',
    );
    expect(listAttachments(t.ctx.db, 'F2')).toHaveLength(1);
  });

  it('si el comando de pie está mal, no guarda nada', async () => {
    const reply = await t.say('', photo('gasté mucho - super'));
    expect(reply.startsWith('⚠️ Monto: no es un monto válido')).toBe(true);
    expect(reply.endsWith('📷 La foto no la guardé: mandala de nuevo cuando esté bien el registro.')).toBe(true);
    expect(listMovimientos(t.ctx.db)).toHaveLength(1);
  });

  it('registros que no existen y archivos que no son fotos', async () => {
    expect(await t.say('', photo('F9'))).toBe('⚠️ No existe el registro F9, así que no guardé la foto.');
    expect(await t.say('', { photo: { data: new Uint8Array([1]), mime: 'application/pdf' }, text: 'F1' })).toBe(
      '⚠️ Solo guardo fotos (JPG, PNG o WebP).',
    );
    expect(listAttachments(t.ctx.db, 'F1')).toEqual([]);
  });
});

describe('código en los mensajes del bot', () => {
  it('lo busca en la primera línea', () => {
    expect(codeInBotMessage('✅ 💰 F14 guardado: Gasto · $ 1.500')).toBe('F14');
    expect(codeInBotMessage('💰 *F3* · Finanzas\nTipo: Gasto')).toBe('F3');
    expect(codeInBotMessage('✏️ 💰 F2 corregido · Nota: ver F9 → —')).toBe('F2');
    expect(codeInBotMessage('📋 *Comandos*\n• *ver* F14')).toBeNull();
    expect(codeInBotMessage('MF14 y F14x')).toBeNull();
  });
});

describe('conexión con un transporte (lo que enchufa la fase 3b)', () => {
  function fakeTransport() {
    let deliver: ((message: IncomingMessage) => Promise<void>) | undefined;
    const sent: string[] = [];
    let failNext = false;
    const transport: BotTransport = {
      start: async (onMessage) => {
        deliver = onMessage;
      },
      send: async (to, reply) => {
        if (failNext) {
          failNext = false;
          throw new Error('se cortó WhatsApp');
        }
        sent.push(plain(`${to.from} ← ${reply.type === 'text' ? reply.text.split('\n')[0] : reply.caption}`));
      },
      stop: async () => {},
    };
    return {
      transport,
      sent,
      failNextSend: () => (failNext = true),
      receive: (text: string, from = GER) => deliver!({ from, text }),
    };
  }

  it('procesa los mensajes de a uno y en orden, y contesta al mismo chat', async () => {
    const fake = fakeTransport();
    await runBot(t.bot, fake.transport);
    // Llegan juntos: el «sí» tiene que procesarse después del «borrar».
    await Promise.all([fake.receive('gasté 100 - café'), fake.receive('borrar F1'), fake.receive('sí'), fake.receive('hola', OTRO)]);
    expect(fake.sent).toEqual([`${GER} ← ✅ 💰 F1 guardado: Gasto · $ 100 · café · 19/11`, `${GER} ← 🗑️ 💰 ¿Borro F1? Gasto · $ 100 · café · 19/11`, `${GER} ← 🗑️ F1 borrado.`]);
  });

  it('si falla un envío, avisa y sigue con el próximo mensaje', async () => {
    const fake = fakeTransport();
    const errors: unknown[] = [];
    await runBot(t.bot, fake.transport, (error) => errors.push(error));
    fake.failNextSend();
    await fake.receive('ayuda');
    await fake.receive('ver F1');
    expect(errors).toHaveLength(1);
    expect(fake.sent).toEqual([`${GER} ← ⚠️ No existe el registro F1.`]);
  });
});
