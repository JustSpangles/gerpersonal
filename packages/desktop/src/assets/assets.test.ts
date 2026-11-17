import { readdirSync, readFileSync } from 'node:fs';
import { loadAreaRegistry } from '@ger/shared/node';
import { ZONAS_CUERPO } from '@ger/shared/areas/salud/zonas.ts';
import { describe, expect, it } from 'vitest';

/** Estos tests cuidan que los SVG reemplazables sigan encajando con el código. */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('cuerpo.svg', () => {
  it('tiene exactamente las zonas de ZONAS_CUERPO', () => {
    const svg = read('./cuerpo.svg').replace(/<!--[\s\S]*?-->/g, '');
    const ids = [...svg.matchAll(/\sid="zona-([^"]+)"/g)].map((match) => match[1]);
    expect(ids.slice().sort()).toEqual(ZONAS_CUERPO.map((zona) => zona.id).sort());
  });
});

describe('íconos del menú', () => {
  it('cada ícono corresponde a un área que existe', async () => {
    const areas = await loadAreaRegistry();
    const icons = readdirSync(new URL('./icons/', import.meta.url)).filter((file) => file.endsWith('.svg'));
    for (const icon of icons) expect(areas.get(icon.replace(/\.svg$/, '')), icon).toBeDefined();
  });
});
