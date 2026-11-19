import type { FieldDefinition } from '../../area.ts';

/**
 * Finanzas: un movimiento es un ingreso o un egreso.
 * Campos, tipos y contratos de la API, compartidos por el núcleo y la PC.
 */

export const TIPOS_MOVIMIENTO = ['egreso', 'ingreso'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/** Campos de un movimiento, en el orden en que se escriben en el bot. */
export const CAMPOS_MOVIMIENTO: FieldDefinition[] = [
  {
    key: 'tipo',
    label: 'Tipo',
    type: 'enum',
    options: [...TIPOS_MOVIMIENTO],
    optionLabels: { egreso: 'Gasto', ingreso: 'Ingreso' },
    required: true,
  },
  { key: 'monto', label: 'Monto', type: 'money', required: true, hint: 'En pesos. Ej.: 1.500 o 1500,50' },
  { key: 'categoria', label: 'Categoría', type: 'text', required: true, hint: 'Ej.: comida, transporte, sueldo' },
  { key: 'nota', label: 'Nota', type: 'text' },
  { key: 'fecha', label: 'Fecha', type: 'date', default: 'today' },
];

export interface Movimiento {
  /** Código del registro: F1, F2… */
  code: string;
  tipo: TipoMovimiento;
  /** En centavos, siempre positivo (el signo lo da el tipo). */
  monto: number;
  categoria: string;
  nota: string | null;
  /** AAAA-MM-DD */
  fecha: string;
  /** ISO 8601 (UTC) */
  createdAt: string;
  updatedAt: string;
}

/** Valores para crear un movimiento (`fecha` y `nota` son opcionales). */
export interface MovimientoInput {
  tipo: TipoMovimiento;
  monto: number;
  categoria: string;
  nota?: string | null;
  fecha?: string | null;
}

export interface FiltrosMovimientos {
  /** Desde esta fecha (incluida), AAAA-MM-DD. */
  desde?: string;
  /** Hasta esta fecha (incluida), AAAA-MM-DD. */
  hasta?: string;
  tipo?: TipoMovimiento;
  categoria?: string;
  limit?: number;
}

export interface TotalesFinanzas {
  ingresos: number;
  egresos: number;
  /** ingresos − egresos */
  saldo: number;
}

export interface TotalCategoria {
  categoria: string;
  total: number;
}

export interface ResumenMes extends TotalesFinanzas {
  /** AAAA-MM */
  mes: string;
  /** Saldo de todos los movimientos hasta el último día del mes. */
  saldoAcumulado: number;
}

export interface ResumenFinanzas {
  /** Mes consultado, AAAA-MM. */
  mes: string;
  totales: TotalesFinanzas;
  /** Totales del mes por categoría, de mayor a menor. */
  porCategoria: Record<TipoMovimiento, TotalCategoria[]>;
  /** Los últimos meses hasta el consultado (incluido), del más viejo al más nuevo. */
  meses: ResumenMes[];
}

// Respuestas de la API (`/areas/finanzas/...`).
export interface MovimientosResponse {
  movimientos: Movimiento[];
}
export interface MovimientoResponse {
  movimiento: Movimiento;
}
export interface CategoriasResponse {
  categorias: string[];
}
