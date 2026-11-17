import { describe, expect, it } from 'vitest';
import { defineArea, type AreaDefinitionInput } from './area.ts';
import { loadAreaRegistry } from './node.ts';
import { AreaRegistryError, buildRegistry } from './registry.ts';

function area(overrides: Partial<AreaDefinitionInput> = {}): AreaDefinitionInput {
  return defineArea({
    id: 'prueba',
    name: 'Prueba',
    prefix: 'P',
    emoji: '🧪',
    order: 1,
    description: 'Área de prueba',
    ...overrides,
  });
}

const mod = (definition: unknown) => ({ default: definition });

describe('registro de áreas', () => {
  it('descubre las 7 áreas del proyecto, ordenadas', async () => {
    const registry = await loadAreaRegistry();
    expect(registry.all.map((a) => a.id)).toEqual([
      'salud',
      'finanzas',
      'gimnasio',
      'trabajo',
      'alimentacion',
      'calendario',
      'sobre-mi',
    ]);
    expect(registry.all.map((a) => a.prefix).join('')).toBe('SFGTCED');
  });

  it('busca por id y por prefijo', async () => {
    const registry = await loadAreaRegistry();
    expect(registry.get('finanzas')?.prefix).toBe('F');
    expect(registry.byPrefix('c')?.id).toBe('alimentacion');
    expect(registry.get('nada')).toBeUndefined();
  });

  it('acepta rutas de Vite y de Windows', () => {
    const registry = buildRegistry({
      '@shared/areas/prueba/definition.ts': mod(area()),
      'C:\\repo\\areas\\otra\\definition.ts': mod(area({ id: 'otra', prefix: 'O' })),
    });
    expect(registry.all).toHaveLength(2);
  });

  it('completa comandos vacíos por defecto', () => {
    const registry = buildRegistry({ 'areas/prueba/definition.ts': mod(area()) });
    expect(registry.get('prueba')?.commands).toEqual([]);
  });

  it('exige que el id coincida con la carpeta', () => {
    expect(() => buildRegistry({ 'areas/otra-carpeta/definition.ts': mod(area()) })).toThrow(/nombre de la carpeta/);
  });

  it('rechaza prefijos repetidos', () => {
    expect(() =>
      buildRegistry({
        'areas/prueba/definition.ts': mod(area()),
        'areas/otra/definition.ts': mod(area({ id: 'otra' })),
      }),
    ).toThrow(/prefijo "P" ya lo usa prueba/);
  });

  it('rechaza prefijos inválidos', () => {
    expect(() => buildRegistry({ 'areas/prueba/definition.ts': mod(area({ prefix: 'pp' })) })).toThrow(AreaRegistryError);
  });

  it('rechaza un módulo sin export por defecto', () => {
    expect(() => buildRegistry({ 'areas/prueba/definition.ts': {} })).toThrow(/por defecto/);
  });

  it('rechaza palabras clave repetidas, aunque cambien las tildes', () => {
    const comando = (id: string, keyword: string) => ({
      id,
      description: 'x',
      keywords: [keyword],
      fields: [],
      example: keyword,
    });
    expect(() =>
      buildRegistry({
        'areas/prueba/definition.ts': mod(area({ commands: [comando('a', 'comí')] })),
        'areas/otra/definition.ts': mod(area({ id: 'otra', prefix: 'O', commands: [comando('b', 'COMI')] })),
      }),
    ).toThrow(/"COMI" ya la usa prueba\/a/);
  });

  it('no deja usar palabras de los comandos globales', () => {
    const commands = [{ id: 'a', description: 'x', keywords: ['Ayuda'], fields: [], example: 'ayuda' }];
    expect(() => buildRegistry({ 'areas/prueba/definition.ts': mod(area({ commands })) })).toThrow(/comandos globales/);
  });

  it('valida los campos de los comandos', () => {
    const commands = [
      {
        id: 'comida',
        description: 'Registrar una comida',
        keywords: ['comí'],
        fields: [
          { key: 'nombre', type: 'text' as const, required: true },
          { key: 'cantidad', type: 'enum' as const, options: ['poco', 'normal', 'mucho'], default: 'normal' },
          { key: 'hora', type: 'time' as const, default: 'now' as const },
        ],
        example: 'comí milanesa con puré - normal - 13:30',
      },
    ];
    expect(buildRegistry({ 'areas/prueba/definition.ts': mod(area({ commands })) }).all[0]?.commands).toHaveLength(1);

    const enumMalo = [{ ...commands[0]!, fields: [{ key: 'cantidad', type: 'enum' as const, options: ['poco'], default: 'mucho' }] }];
    expect(() => buildRegistry({ 'areas/prueba/definition.ts': mod(area({ commands: enumMalo })) })).toThrow(/una de las opciones/);

    const repetido = [{ ...commands[0]!, fields: [commands[0]!.fields[0]!, commands[0]!.fields[0]!] }];
    expect(() => buildRegistry({ 'areas/prueba/definition.ts': mod(area({ commands: repetido })) })).toThrow(/"nombre" está repetido/);
  });
});
