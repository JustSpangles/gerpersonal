import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyInput, formatMoneyShort, parseMoney } from './money.ts';

describe('parseMoney', () => {
  it.each([
    ['1500', 150000],
    ['1.500', 150000],
    ['1.500,50', 150050],
    ['1500,5', 150050],
    ['$ 1.500', 150000],
    ['$1500', 150000],
    ['12.345.678', 1234567800],
    ['1500.50', 150050],
    ['1.5', 150],
    ['0,99', 99],
    ['0', 0],
  ])('%s → %i centavos', (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });

  it.each(['', 'abc', '-100', '1,2,3', '1.50.0', '15,', '1500.', '1,500.50', '12.34.567', '1,505'])('rechaza "%s"', (text) => {
    expect(parseMoney(text)).toBeNull();
  });
});

describe('formato de montos', () => {
  it('muestra pesos con punto de miles y centavos solo si hay', () => {
    expect(formatMoney(150000)).toBe('$ 1.500');
    expect(formatMoney(150050)).toBe('$ 1.500,50');
    expect(formatMoney(5)).toBe('$ 0,05');
    expect(formatMoney(-123456789)).toBe('-$ 1.234.567,89');
  });

  it('para editar, sin el signo $ y reversible', () => {
    expect(formatMoneyInput(150050)).toBe('1.500,50');
    for (const cents of [1, 99, 100, 150000, 150050, 1234567800]) {
      expect(parseMoney(formatMoneyInput(cents))).toBe(cents);
    }
  });

  it('corto para ejes de gráficos', () => {
    expect(formatMoneyShort(85000)).toBe('$ 850');
    expect(formatMoneyShort(1500000)).toBe('$ 15 mil');
    expect(formatMoneyShort(125000000)).toBe('$ 1,3 M');
    expect(formatMoneyShort(-35000000)).toBe('-$ 350 mil');
  });
});
