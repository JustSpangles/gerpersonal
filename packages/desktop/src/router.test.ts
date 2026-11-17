import { describe, expect, it } from 'vitest';
import { areaRoute, parseRoute, routeToHash } from './router.ts';

describe('rutas', () => {
  it('interpreta el hash', () => {
    expect(parseRoute('')).toEqual({ name: 'menu' });
    expect(parseRoute('#/')).toEqual({ name: 'menu' });
    expect(parseRoute('#/ajustes')).toEqual({ name: 'settings' });
    expect(parseRoute('#/area/finanzas')).toEqual(areaRoute('finanzas'));
    expect(parseRoute('#/area/salud?zona=cabeza')).toEqual(areaRoute('salud', { zona: 'cabeza' }));
  });

  it('cualquier cosa rara vuelve al menú', () => {
    expect(parseRoute('#/nada')).toEqual({ name: 'menu' });
    expect(parseRoute('#/area')).toEqual({ name: 'menu' });
    expect(parseRoute('#/area/a/b')).toEqual({ name: 'menu' });
    expect(parseRoute('#/area/%E0%A4%A')).toEqual({ name: 'menu' });
  });

  it('ida y vuelta', () => {
    for (const route of [
      { name: 'menu' } as const,
      { name: 'settings' } as const,
      areaRoute('sobre-mi'),
      areaRoute('salud', { zona: 'hombro-izquierdo' }),
    ]) {
      expect(parseRoute(routeToHash(route))).toEqual(route);
    }
  });
});
