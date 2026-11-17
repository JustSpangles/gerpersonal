import { describe, expect, it } from 'vitest';
import { formatCode, parseCode } from './codes.ts';

describe('códigos de registro', () => {
  it('arma el código con prefijo y número', () => {
    expect(formatCode('C', 14)).toBe('C14');
    expect(formatCode('F', 203)).toBe('F203');
  });

  it('rechaza prefijos o números inválidos', () => {
    expect(() => formatCode('c', 1)).toThrow();
    expect(() => formatCode('CC', 1)).toThrow();
    expect(() => formatCode('C', 0)).toThrow();
    expect(() => formatCode('C', 1.5)).toThrow();
  });

  it('interpreta códigos escritos a mano', () => {
    expect(parseCode('C14')).toEqual({ prefix: 'C', number: 14 });
    expect(parseCode(' f203 ')).toEqual({ prefix: 'F', number: 203 });
  });

  it('devuelve null si no es un código', () => {
    expect(parseCode('C')).toBeNull();
    expect(parseCode('14')).toBeNull();
    expect(parseCode('C0')).toBeNull();
    expect(parseCode('CC14')).toBeNull();
    expect(parseCode('C14x')).toBeNull();
  });
});
