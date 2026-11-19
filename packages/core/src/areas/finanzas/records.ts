import type { FieldValues } from '@ger/shared';
import { CAMPOS_MOVIMIENTO, type Movimiento, type MovimientoInput } from '@ger/shared/areas/finanzas/movimientos.ts';
import { defineAreaRecords, type CreateFromCommand, type RecordView } from '../../records/areaRecords.ts';
import { createMovimiento, deleteMovimiento, findMovimiento, updateMovimiento } from './service.ts';

/**
 * Finanzas para el bot: `ver`, `editar` y `borrar` con códigos F…, y los
 * comandos `gasté`/`cobré`. Solo llama al servicio, que valida todo lo que
 * recibe: por eso los valores genéricos se le pasan tal cual.
 */

function view(movimiento: Movimiento): RecordView {
  return {
    code: movimiento.code,
    fields: CAMPOS_MOVIMIENTO,
    values: {
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      categoria: movimiento.categoria,
      nota: movimiento.nota,
      fecha: movimiento.fecha,
    },
  };
}

/** Los valores vienen sin tipo propio; el servicio los valida igual que si vinieran de la API. */
const asInput = <T>(values: FieldValues) => values as unknown as T;

// Los dos comandos crean un movimiento; el tipo lo pone la palabra clave (`fixed`).
const crear: CreateFromCommand = (db, values, now) => view(createMovimiento(db, asInput<MovimientoInput>(values), now));

export default defineAreaRecords({
  find(db, code) {
    const movimiento = findMovimiento(db, code);
    return movimiento ? view(movimiento) : null;
  },
  update: (db, code, patch, now) => view(updateMovimiento(db, code, asInput<Partial<MovimientoInput>>(patch), now)),
  delete: (db, code) => view(deleteMovimiento(db, code)),
  commands: { gasto: crear, ingreso: crear },
});
