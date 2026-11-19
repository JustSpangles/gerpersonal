import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  formatDate,
  formatMonth,
  formatMonthShort,
  isValidISODate,
  monthRange,
  nowTime,
  parseDateInput,
  parseTimeInput,
  todayISO,
} from './dates.ts';

// 16/11/2026 01:30 en UTC = 15/11/2026 22:30 en Buenos Aires (UTC−3).
const NOW = new Date('2026-11-16T01:30:00Z');

describe('hoy y ahora', () => {
  it('usan la zona horaria de Argentina, no la de la máquina', () => {
    expect(todayISO(NOW)).toBe('2026-11-15');
    expect(nowTime(NOW)).toBe('22:30');
    expect(todayISO(NOW, 'UTC')).toBe('2026-11-16');
  });
});

describe('parseDateInput', () => {
  it.each([
    ['hoy', '2026-11-15'],
    ['ayer', '2026-11-14'],
    ['Anteayer', '2026-11-13'],
    ['mañana', '2026-11-16'],
    ['3/11', '2026-11-03'],
    ['03/11/25', '2025-11-03'],
    ['3-11-2024', '2024-11-03'],
    ['2026-02-28', '2026-02-28'],
    ['29/2/2028', '2028-02-29'],
  ])('%s → %s', (text, iso) => {
    expect(parseDateInput(text, NOW)).toBe(iso);
  });

  it.each(['', 'antes', '31/11', '29/02/2027', '2026-13-01', '1/1/1'])('rechaza "%s"', (text) => {
    expect(parseDateInput(text, NOW)).toBeNull();
  });
});

describe('parseTimeInput', () => {
  it.each([
    ['13:30', '13:30'],
    ['9.05', '09:05'],
    ['13', '13:00'],
    ['9hs', '09:00'],
    ['ahora', '22:30'],
  ])('%s → %s', (text, time) => {
    expect(parseTimeInput(text, NOW)).toBe(time);
  });

  it.each(['24:00', '12:60', 'mediodía', '1:3'])('rechaza "%s"', (text) => {
    expect(parseTimeInput(text, NOW)).toBeNull();
  });
});

describe('cuentas y formato', () => {
  it('días y meses', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2028-02')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(isValidISODate('2026-02-30')).toBe(false);
  });

  it('formato argentino', () => {
    expect(formatDate('2026-11-05')).toBe('05/11');
    expect(formatDate('2026-11-05', { year: true })).toBe('05/11/2026');
    expect(formatMonth('2026-11')).toBe('noviembre 2026');
    expect(formatMonthShort('2026-09')).toBe('sep');
  });
});
