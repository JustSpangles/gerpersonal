import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from './area.ts';
import { CAMPOS_MOVIMIENTO } from './areas/finanzas/movimientos.ts';
import { applyDefaults, formatFieldValue, parseFieldValue, toInputText, validateValues } from './fields.ts';

const NOW = new Date('2026-11-16T15:00:00Z'); // 12:00 en Buenos Aires
const campo = (key: string) => CAMPOS_MOVIMIENTO.find((f) => f.key === key)!;

describe('validateValues', () => {
  it('acepta un registro completo y recorta espacios', () => {
    const result = validateValues(
      CAMPOS_MOVIMIENTO,
      { tipo: 'egreso', monto: 150000, categoria: '  comida ', nota: null, fecha: '2026-11-15' },
      'create',
    );
    expect(result).toEqual({
      ok: true,
      values: { tipo: 'egreso', monto: 150000, categoria: 'comida', nota: null, fecha: '2026-11-15' },
    });
  });

  it('al crear, avisa qué falta y qué está mal, campo por campo', () => {
    const result = validateValues(CAMPOS_MOVIMIENTO, { tipo: 'regalo', monto: 0, fecha: '2026-02-30', otro: 1 }, 'create');
    expect(result).toEqual({
      ok: false,
      errors: {
        tipo: 'tiene que ser egreso o ingreso',
        monto: 'tiene que ser mayor a 0',
        categoria: 'falta',
        fecha: 'tiene que ser una fecha AAAA-MM-DD',
        otro: 'campo desconocido',
      },
    });
  });

  it('al editar, todo es opcional pero no se pueden vaciar los obligatorios', () => {
    expect(validateValues(CAMPOS_MOVIMIENTO, { nota: null }, 'update')).toEqual({ ok: true, values: { nota: null } });
    expect(validateValues(CAMPOS_MOVIMIENTO, { categoria: null, fecha: null }, 'update')).toEqual({
      ok: false,
      errors: { categoria: 'falta', fecha: 'falta' },
    });
  });

  it('montos en centavos enteros', () => {
    expect(validateValues([campo('monto')], { monto: 15.5 }, 'create')).toMatchObject({ ok: false });
  });
});

describe('applyDefaults', () => {
  it('completa fecha con hoy (Argentina) y lo opcional con null', () => {
    expect(applyDefaults(CAMPOS_MOVIMIENTO, { tipo: 'ingreso', monto: 1, categoria: 'x' }, NOW)).toEqual({
      tipo: 'ingreso',
      monto: 1,
      categoria: 'x',
      nota: null,
      fecha: '2026-11-16',
    });
  });

  it('no pisa lo que vino', () => {
    expect(applyDefaults([campo('fecha')], { fecha: '2026-01-02' }, NOW)).toEqual({ fecha: '2026-01-02' });
  });

  it('hora "now" y enum con valor por defecto', () => {
    const fields: FieldDefinition[] = [
      { key: 'hora', type: 'time', default: 'now' },
      { key: 'cantidad', type: 'enum', options: ['poco', 'normal', 'mucho'], default: 'normal' },
    ];
    expect(applyDefaults(fields, {}, NOW)).toEqual({ hora: '12:00', cantidad: 'normal' });
  });
});

describe('parseFieldValue', () => {
  it('interpreta lo que se escribe', () => {
    expect(parseFieldValue(campo('monto'), '1.500,50')).toEqual({ ok: true, value: 150050 });
    expect(parseFieldValue(campo('tipo'), 'INGRESO')).toEqual({ ok: true, value: 'ingreso' });
    expect(parseFieldValue(campo('tipo'), 'gasto')).toEqual({ ok: true, value: 'egreso' });
    expect(parseFieldValue(campo('fecha'), 'ayer', NOW)).toEqual({ ok: true, value: '2026-11-15' });
    expect(parseFieldValue(campo('categoria'), '  super  ')).toEqual({ ok: true, value: 'super' });
    expect(parseFieldValue({ key: 'peso', type: 'number' }, '80,5')).toEqual({ ok: true, value: 80.5 });
  });

  it('vacío: null si es opcional, error si es obligatorio', () => {
    expect(parseFieldValue(campo('nota'), '   ')).toEqual({ ok: true, value: null });
    expect(parseFieldValue(campo('fecha'), '')).toEqual({ ok: true, value: null });
    expect(parseFieldValue(campo('categoria'), '')).toEqual({ ok: false, error: 'falta' });
  });

  it('errores en castellano', () => {
    expect(parseFieldValue(campo('monto'), 'mil')).toMatchObject({ ok: false, error: expect.stringContaining('monto válido') });
    expect(parseFieldValue(campo('monto'), '0')).toEqual({ ok: false, error: 'tiene que ser mayor a 0' });
    expect(parseFieldValue(campo('tipo'), 'otro')).toEqual({ ok: false, error: 'tiene que ser egreso o ingreso' });
    expect(parseFieldValue({ key: 'n', type: 'int', min: 1, max: 10 }, '11')).toEqual({ ok: false, error: 'tiene que ser 10 o menos' });
    expect(parseFieldValue({ key: 'n', type: 'int' }, '2,5')).toEqual({ ok: false, error: 'tiene que ser un número entero' });
  });
});

describe('mostrar y editar', () => {
  it('formato para mostrar', () => {
    expect(formatFieldValue(campo('monto'), 150000)).toBe('$ 1.500');
    expect(formatFieldValue(campo('fecha'), '2026-11-05')).toBe('05/11');
    expect(formatFieldValue(campo('nota'), null)).toBe('');
    expect(formatFieldValue(campo('tipo'), 'egreso')).toBe('Gasto');
  });

  it('texto editable que vuelve a dar el mismo valor', () => {
    for (const [key, value] of [
      ['monto', 150050],
      ['fecha', '2026-11-05'],
      ['tipo', 'egreso'],
    ] as const) {
      const field = campo(key);
      expect(parseFieldValue(field, toInputText(field, value))).toEqual({ ok: true, value });
    }
  });
});
