import {
  addMonths,
  applyDefaults,
  fieldLabel,
  formatCode,
  isValidISODate,
  isValidMonth,
  monthRange,
  normalizeText,
  monthOf,
  parseCode,
  todayISO,
  validateValues,
  type FieldValues,
} from '@ger/shared';
import finanzas from '@ger/shared/areas/finanzas/definition.ts';
import {
  CAMPOS_MOVIMIENTO,
  TIPOS_MOVIMIENTO,
  type FiltrosMovimientos,
  type Movimiento,
  type MovimientoInput,
  type ResumenFinanzas,
  type ResumenMes,
  type TipoMovimiento,
  type TotalCategoria,
} from '@ger/shared/areas/finanzas/movimientos.ts';
import { z } from 'zod';
import { transaction, type Db } from '../../db/database.ts';
import { nextCode } from '../../records/codes.ts';
import { NotFoundError, ValidationError } from '../../records/errors.ts';

/**
 * Finanzas: toda la lógica de los movimientos (ingresos y egresos).
 * El bot y la API solo llaman a estas funciones. Cada una valida lo que
 * recibe, así da igual de dónde vengan los datos.
 *
 * Es la plantilla para las demás áreas: crear, ver, listar, editar, borrar
 * y estadísticas, con el código del registro (F1, F2…) como identificador.
 */

const PREFIX = finanzas.prefix;
const LABELS = Object.fromEntries(CAMPOS_MOVIMIENTO.map((field) => [field.key, fieldLabel(field)]));

interface Row {
  code: string;
  tipo: TipoMovimiento;
  monto: number;
  categoria: string;
  nota: string | null;
  fecha: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'code, tipo, monto, categoria, nota, fecha, created_at, updated_at';

function toMovimiento(row: Row): Movimiento {
  return {
    code: row.code,
    tipo: row.tipo,
    monto: row.monto,
    categoria: row.categoria,
    nota: row.nota,
    fecha: row.fecha,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validate(input: unknown, mode: 'create' | 'update'): FieldValues {
  const result = validateValues(CAMPOS_MOVIMIENTO, input, mode);
  if (!result.ok) throw new ValidationError(result.errors, LABELS);
  return result.values;
}

/** `f12` → `F12`; cualquier otra cosa (u otro prefijo) no existe. */
function normalizeCode(code: string): string | null {
  const parsed = parseCode(code);
  return parsed && parsed.prefix === PREFIX ? formatCode(parsed.prefix, parsed.number) : null;
}

/**
 * Si ya hay una categoría que se escribe igual salvo mayúsculas o tildes,
 * se usa esa (`Comida` → `comida`), así los gráficos no la parten en dos.
 */
function resolveCategoria(db: Db, categoria: string, exceptCode?: string): string {
  const wanted = normalizeText(categoria);
  const rows = db
    .prepare('SELECT DISTINCT categoria FROM finanzas_movimientos WHERE code <> ?')
    .all(exceptCode ?? '') as { categoria: string }[];
  return rows.find((row) => normalizeText(row.categoria) === wanted)?.categoria ?? categoria.replace(/\s+/g, ' ');
}

// --- Registros -----------------------------------------------------------------

export function createMovimiento(db: Db, input: MovimientoInput, now: Date = new Date()): Movimiento {
  const values = applyDefaults(CAMPOS_MOVIMIENTO, validate(input, 'create'), now);
  const timestamp = now.toISOString();

  return transaction(db, () => {
    const code = nextCode(db, PREFIX);
    const row = db
      .prepare(
        `INSERT INTO finanzas_movimientos (code, tipo, monto, categoria, nota, fecha, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`,
      )
      .get(
        code,
        values.tipo!,
        values.monto!,
        resolveCategoria(db, String(values.categoria)),
        values.nota ?? null,
        values.fecha!,
        timestamp,
        timestamp,
      ) as unknown as Row;
    return toMovimiento(row);
  });
}

/** El movimiento con ese código, o `null` si no existe. */
export function findMovimiento(db: Db, code: string): Movimiento | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const row = db.prepare(`SELECT ${COLUMNS} FROM finanzas_movimientos WHERE code = ?`).get(normalized) as Row | undefined;
  return row ? toMovimiento(row) : null;
}

export function getMovimiento(db: Db, code: string): Movimiento {
  const movimiento = findMovimiento(db, code);
  if (!movimiento) throw new NotFoundError(`No existe el movimiento ${code.trim().toUpperCase()}`);
  return movimiento;
}

const filtrosSchema = z.strictObject({
  desde: z.string().refine(isValidISODate, 'tiene que ser una fecha AAAA-MM-DD').optional(),
  hasta: z.string().refine(isValidISODate, 'tiene que ser una fecha AAAA-MM-DD').optional(),
  tipo: z.enum(TIPOS_MOVIMIENTO, { error: 'tiene que ser egreso o ingreso' }).optional(),
  categoria: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});

/** Movimientos filtrados, del más nuevo al más viejo. */
export function listMovimientos(db: Db, filtros: FiltrosMovimientos = {}): Movimiento[] {
  const parsed = filtrosSchema.safeParse(filtros);
  if (!parsed.success) {
    const errors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? '_'), issue.message]));
    throw new ValidationError(errors);
  }
  const { desde, hasta, tipo, categoria, limit } = parsed.data;

  const where: string[] = [];
  const params: (string | number)[] = [];
  const filter = (clause: string, value: string | undefined) => {
    if (value === undefined) return;
    where.push(clause);
    params.push(value);
  };
  filter('fecha >= ?', desde);
  filter('fecha <= ?', hasta);
  filter('tipo = ?', tipo);
  filter('categoria = ?', categoria);

  const rows = db
    .prepare(
      `SELECT ${COLUMNS} FROM finanzas_movimientos
       ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY fecha DESC, id DESC LIMIT ?`,
    )
    .all(...params, limit) as unknown as Row[];
  return rows.map(toMovimiento);
}

/** Cambia uno o más campos. Lo que no viene queda como estaba. */
export function updateMovimiento(db: Db, code: string, patch: Partial<MovimientoInput>, now: Date = new Date()): Movimiento {
  const values = validate(patch, 'update');
  const current = getMovimiento(db, code);
  if (typeof values.categoria === 'string') values.categoria = resolveCategoria(db, values.categoria, current.code);

  const keys = Object.keys(values).filter((key) => values[key] !== undefined);
  if (keys.length === 0) return current;

  const row = db
    .prepare(
      `UPDATE finanzas_movimientos SET ${keys.map((key) => `${key} = ?`).join(', ')}, updated_at = ?
       WHERE code = ? RETURNING ${COLUMNS}`,
    )
    .get(...keys.map((key) => values[key] ?? null), now.toISOString(), current.code) as unknown as Row;
  return toMovimiento(row);
}

/** Borra el movimiento y lo devuelve (para confirmar qué se borró). Su código no se reutiliza. */
export function deleteMovimiento(db: Db, code: string): Movimiento {
  const current = getMovimiento(db, code);
  db.prepare('DELETE FROM finanzas_movimientos WHERE code = ?').run(current.code);
  return current;
}

// --- Consultas y estadísticas ---------------------------------------------------

/** Categorías usadas (opcionalmente de un tipo), de la más usada a la menos. */
export function listCategorias(db: Db, tipo?: TipoMovimiento): string[] {
  if (tipo !== undefined && !TIPOS_MOVIMIENTO.includes(tipo)) {
    throw new ValidationError({ tipo: 'tiene que ser egreso o ingreso' });
  }
  const rows = db
    .prepare(
      `SELECT categoria FROM finanzas_movimientos
       ${tipo ? 'WHERE tipo = ?' : ''}
       GROUP BY categoria ORDER BY COUNT(*) DESC, MAX(fecha) DESC, categoria`,
    )
    .all(...(tipo ? [tipo] : [])) as { categoria: string }[];
  return rows.map((row) => row.categoria);
}

export interface OpcionesResumen {
  /** Mes a resumir, AAAA-MM. Por defecto, el actual. */
  mes?: string;
  /** Cuántos meses mostrar en la evolución (contando el pedido). Por defecto, 12. */
  meses?: number;
}

const SIGNED = "CASE tipo WHEN 'ingreso' THEN monto ELSE -monto END";

/** Totales del mes, por categoría y la evolución de los últimos meses. */
export function getResumen(db: Db, opciones: OpcionesResumen = {}, now: Date = new Date()): ResumenFinanzas {
  const mes = opciones.mes ?? monthOf(todayISO(now));
  const cantidad = opciones.meses ?? 12;
  const errors: Record<string, string> = {};
  if (!isValidMonth(mes)) errors.mes = 'tiene que ser un mes AAAA-MM';
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 120) errors.meses = 'tiene que ser un número entre 1 y 120';
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);

  const primero = addMonths(mes, -(cantidad - 1));
  const desde = monthRange(primero).desde;
  const hasta = monthRange(mes).hasta;

  // Saldo de todo lo anterior al primer mes, para arrancar el acumulado.
  const anterior = db.prepare(`SELECT COALESCE(SUM(${SIGNED}), 0) AS saldo FROM finanzas_movimientos WHERE fecha < ?`).get(desde) as {
    saldo: number;
  };

  const porMes = new Map(
    (
      db
        .prepare(
          `SELECT substr(fecha, 1, 7) AS mes,
                  COALESCE(SUM(CASE tipo WHEN 'ingreso' THEN monto END), 0) AS ingresos,
                  COALESCE(SUM(CASE tipo WHEN 'egreso' THEN monto END), 0) AS egresos
           FROM finanzas_movimientos WHERE fecha BETWEEN ? AND ? GROUP BY 1`,
        )
        .all(desde, hasta) as { mes: string; ingresos: number; egresos: number }[]
    ).map((row) => [row.mes, row]),
  );

  const meses: ResumenMes[] = [];
  let acumulado = anterior.saldo;
  for (let i = 0; i < cantidad; i++) {
    const m = addMonths(primero, i);
    const row = porMes.get(m);
    const ingresos = row?.ingresos ?? 0;
    const egresos = row?.egresos ?? 0;
    acumulado += ingresos - egresos;
    meses.push({ mes: m, ingresos, egresos, saldo: ingresos - egresos, saldoAcumulado: acumulado });
  }

  const delMes = monthRange(mes);
  const categorias = db
    .prepare(
      `SELECT tipo, categoria, SUM(monto) AS total FROM finanzas_movimientos
       WHERE fecha BETWEEN ? AND ? GROUP BY tipo, categoria ORDER BY total DESC, categoria`,
    )
    .all(delMes.desde, delMes.hasta) as { tipo: TipoMovimiento; categoria: string; total: number }[];
  const porCategoria: Record<TipoMovimiento, TotalCategoria[]> = { egreso: [], ingreso: [] };
  for (const row of categorias) porCategoria[row.tipo].push({ categoria: row.categoria, total: row.total });

  const ultimo = meses.at(-1)!;
  return {
    mes,
    totales: { ingresos: ultimo.ingresos, egresos: ultimo.egresos, saldo: ultimo.saldo },
    porCategoria,
    meses,
  };
}
