import { describe, expect, it } from 'vitest';
import { DEFAULT_DESKTOP_CONFIG, normalizeCoreUrl, sanitizeConfig } from './bridge.ts';

describe('URL del núcleo', () => {
  it('agrega http:// y saca la barra final', () => {
    expect(normalizeCoreUrl('192.168.0.50:3210')).toBe('http://192.168.0.50:3210');
    expect(normalizeCoreUrl(' http://100.64.1.2:3210/ ')).toBe('http://100.64.1.2:3210');
    expect(normalizeCoreUrl('https://nucleo.tail1234.ts.net')).toBe('https://nucleo.tail1234.ts.net');
  });

  it('rechaza lo que no es http(s)', () => {
    expect(normalizeCoreUrl('')).toBeNull();
    expect(normalizeCoreUrl('ftp://x')).toBeNull();
    expect(normalizeCoreUrl('http://')).toBeNull();
  });
});

describe('sanitizeConfig', () => {
  it('usa valores por defecto si el archivo está vacío o roto', () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_DESKTOP_CONFIG);
    expect(sanitizeConfig({ coreUrl: 42, apiToken: ['x'] })).toEqual(DEFAULT_DESKTOP_CONFIG);
  });

  it('limpia espacios', () => {
    expect(sanitizeConfig({ coreUrl: ' 10.0.0.2:3210 ', apiToken: ' abc ' })).toEqual({
      coreUrl: 'http://10.0.0.2:3210',
      apiToken: 'abc',
    });
  });
});
