import { describe, expect, it } from 'vitest';
import { defineArea, type CommandDefinition } from './area.ts';
import { commandHelp, createCommandMatcher, createKeywordIndex, parseCommandArgs, splitFields, writtenFields } from './commands.ts';
import { loadAreaRegistry } from './node.ts';
import { buildRegistry } from './registry.ts';

// 19/11/2026 13:30 en Buenos Aires.
const NOW = new Date('2026-11-19T16:30:00Z');

const registry = await loadAreaRegistry();
const finanzas = registry.get('finanzas')!;
const gasto = finanzas.commands.find((c) => c.id === 'gasto')!;

/** Un área de prueba con el comando del ejemplo de CLAUDE.md. */
const comida = buildRegistry({
  'areas/comida/definition.ts': {
    default: defineArea({
      id: 'comida',
      name: 'Comida',
      prefix: 'C',
      emoji: '🍽️',
      order: 1,
      description: 'Prueba',
      commands: [
        {
          id: 'comida',
          description: 'Anotar una comida',
          keywords: ['comí', 'me comí'],
          fields: [
            { key: 'nombre', type: 'text', required: true },
            { key: 'cantidad', type: 'enum', options: ['poco', 'normal', 'mucho'], default: 'normal' },
            { key: 'hambre', type: 'int', min: 1, max: 10 },
            { key: 'hora', type: 'time', default: 'now' },
          ],
          example: 'comí milanesa con puré - normal - 13:30',
        },
      ],
    }),
  },
}).get('comida')!;
const comi = comida.commands[0] as CommandDefinition;

describe('palabras clave', () => {
  const find = createKeywordIndex([
    ['comí', 'comida'],
    ['me duele', 'dolor'],
    ['me', 'corto'],
  ]);

  it('no distingue mayúsculas ni tildes y devuelve el resto tal cual', () => {
    expect(find('Comí  Milanesa con PURÉ - mucho')).toEqual({ value: 'comida', rest: 'Milanesa con PURÉ - mucho' });
    expect(find('comi')).toEqual({ value: 'comida', rest: '' });
    expect(find('  COMI   ')).toEqual({ value: 'comida', rest: '' });
  });

  it('acepta palabras clave de varias palabras y gana la más larga', () => {
    expect(find('Me   duele la cabeza')).toEqual({ value: 'dolor', rest: 'la cabeza' });
    expect(find('me olvidé')).toEqual({ value: 'corto', rest: 'olvidé' });
  });

  it('la palabra clave tiene que ser la palabra entera', () => {
    expect(find('comíamos')).toBeNull();
    expect(find('hola comí')).toBeNull();
    expect(find('')).toBeNull();
  });

  it('no acepta palabras clave repetidas', () => {
    expect(() => createKeywordIndex([['Comí', 1], ['comi', 2]])).toThrow(/repetida/);
  });
});

describe('buscar el comando', () => {
  const match = createCommandMatcher(registry);

  it('encuentra los comandos de Finanzas por cualquiera de sus palabras clave', () => {
    expect(match('Gasté 1.500 - Café')).toMatchObject({ command: { id: 'gasto' }, keyword: 'gasté', args: '1.500 - Café' });
    expect(match('pague 200 - luz')).toMatchObject({ command: { id: 'gasto' }, keyword: 'pagué' });
    expect(match('COBRÉ 350000 - sueldo')).toMatchObject({ area: { id: 'finanzas' }, command: { id: 'ingreso' } });
    expect(match('cobre')).toMatchObject({ command: { id: 'ingreso' }, keyword: 'cobré', args: '' });
  });

  it('devuelve null si no es un comando de un área', () => {
    expect(match('hola')).toBeNull();
    expect(match('ver F1')).toBeNull();
  });
});

describe('separar campos', () => {
  it('corta en « - » y deja enteros los guiones sin espacios', () => {
    expect(splitFields('pan-queque - mucho')).toEqual(['pan-queque', 'mucho']);
    expect(splitFields('  1500 -   comida ')).toEqual(['1500', 'comida']);
    expect(splitFields('-5 grados')).toEqual(['-5 grados']);
  });

  it('acepta los guiones largos que ponen algunos teclados', () => {
    expect(splitFields('1500 – comida — nota')).toEqual(['1500', 'comida', 'nota']);
  });

  it('un campo vacío queda vacío (para saltear un opcional)', () => {
    expect(splitFields('1500 - comida - - ayer')).toEqual(['1500', 'comida', '', 'ayer']);
    expect(splitFields('- comida')).toEqual(['', 'comida']);
    expect(splitFields('1500 -')).toEqual(['1500', '']);
    expect(splitFields('   ')).toEqual([]);
  });
});

describe('interpretar los campos de un comando', () => {
  it('los fijos no se escriben', () => {
    expect(writtenFields(gasto).map((f) => f.key)).toEqual(['monto', 'categoria', 'nota', 'fecha']);
  });

  it('interpreta cada campo y suma los valores fijos', () => {
    expect(parseCommandArgs(gasto, '1.500,50 - comida - almuerzo con Juan - ayer', NOW)).toEqual({
      ok: true,
      values: { tipo: 'egreso', monto: 150050, categoria: 'comida', nota: 'almuerzo con Juan', fecha: '2026-11-18' },
    });
  });

  it('los opcionales del final se pueden omitir y los del medio dejar vacíos', () => {
    expect(parseCommandArgs(gasto, '1500 - comida', NOW)).toEqual({
      ok: true,
      values: { tipo: 'egreso', monto: 150000, categoria: 'comida' },
    });
    expect(parseCommandArgs(gasto, '1500 - comida - - 16/11', NOW)).toEqual({
      ok: true,
      values: { tipo: 'egreso', monto: 150000, categoria: 'comida', nota: null, fecha: '2026-11-16' },
    });
  });

  it('dice qué campo está mal', () => {
    expect(parseCommandArgs(gasto, 'mil - comida - - el lunes', NOW)).toEqual({
      ok: false,
      errors: {
        monto: 'no es un monto válido (ej.: 1.500 o 1500,50)',
        fecha: 'no es una fecha válida (ej.: 16/11, ayer o 2026-11-16)',
      },
    });
    expect(parseCommandArgs(gasto, '0 - comida', NOW)).toEqual({ ok: false, errors: { monto: 'tiene que ser mayor a 0' } });
  });

  it('avisa lo que falta y lo que sobra', () => {
    expect(parseCommandArgs(gasto, '1500', NOW)).toEqual({ ok: false, errors: { categoria: 'falta' } });
    expect(parseCommandArgs(gasto, '- comida', NOW)).toEqual({ ok: false, errors: { monto: 'falta' } });
    const sobran = parseCommandArgs(gasto, '1 - a - b - hoy - otra', NOW);
    expect(sobran).toEqual({ ok: false, errors: { _: expect.stringContaining('escribiste 5 y lleva hasta 4') } });
  });

  it('sirve para cualquier tipo de campo', () => {
    expect(parseCommandArgs(comi, 'milanesa con puré - MUCHO - 8 - 21', NOW)).toEqual({
      ok: true,
      values: { nombre: 'milanesa con puré', cantidad: 'mucho', hambre: 8, hora: '21:00' },
    });
    expect(parseCommandArgs(comi, 'fideos - bastante - 11', NOW)).toEqual({
      ok: false,
      errors: { cantidad: 'tiene que ser poco, normal o mucho', hambre: 'tiene que ser 10 o menos' },
    });
  });
});

describe('mensaje de formato', () => {
  it('se arma desde los campos y el ejemplo', () => {
    expect(commandHelp(finanzas, gasto)).toBe(
      [
        '💰 *Anotar un gasto*',
        'gasté monto - categoría - nota - fecha',
        '• Monto: en pesos. Ej.: 1.500 o 1500,50',
        '• Categoría: ej.: comida, transporte, sueldo',
        '• Nota: opcional',
        '• Fecha: opcional (si no va: hoy). Ej.: ayer o 16/11',
        'Ejemplo: gasté 1.500 - comida - almuerzo con Juan - ayer',
        '_También sirve: gasto, pagué_',
      ].join('\n'),
    );
  });

  it('muestra la palabra clave que se usó y las demás como alternativa', () => {
    const help = commandHelp(finanzas, gasto, 'pagué');
    expect(help.split('\n')[1]).toBe('pagué monto - categoría - nota - fecha');
    expect(help).toContain('_También sirve: gasté, gasto_');
  });

  it('explica opciones, límites y valores por defecto según el tipo', () => {
    expect(commandHelp(comida, comi)).toBe(
      [
        '🍽️ *Anotar una comida*',
        'comí nombre - cantidad - hambre - hora',
        '• Nombre',
        '• Cantidad: opcional (si no va: normal). Poco, normal o mucho',
        '• Hambre: opcional. Del 1 al 10',
        '• Hora: opcional (si no va: ahora). Ej.: 13:30',
        'Ejemplo: comí milanesa con puré - normal - 13:30',
        '_También sirve: me comí_',
      ].join('\n'),
    );
  });
});
