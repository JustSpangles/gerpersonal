import { describe, expect, it } from 'vitest';
import { normalizeText } from './text.ts';

describe('normalizeText', () => {
  it('saca tildes y mayúsculas', () => {
    expect(normalizeText('Comí')).toBe('comi');
    expect(normalizeText('COMÍ')).toBe('comi');
    expect(normalizeText('  Sí ')).toBe('si');
    expect(normalizeText('Año')).toBe('ano');
  });

  it('colapsa espacios', () => {
    expect(normalizeText('ver   C14')).toBe('ver c14');
  });
});
