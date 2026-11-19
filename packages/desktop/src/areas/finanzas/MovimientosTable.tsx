import { formatDate, formatMoney } from '@ger/shared';
import type { Movimiento } from '@ger/shared/areas/finanzas/movimientos.ts';
import { Button } from '../../components/index.ts';
import styles from './MovimientosTable.module.css';

interface MovimientosTableProps {
  movimientos: readonly Movimiento[];
  onEdit(movimiento: Movimiento): void;
  onDelete(movimiento: Movimiento): void;
}

/** Lista de movimientos con su código, como en las confirmaciones del bot. */
export function MovimientosTable({ movimientos, onEdit, onDelete }: MovimientosTableProps) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Código</th>
          <th scope="col">Fecha</th>
          <th scope="col">Categoría</th>
          <th scope="col">Nota</th>
          <th scope="col" className={styles.amount}>
            Monto
          </th>
          <th scope="col">
            <span className={styles.hidden}>Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {movimientos.map((m) => (
          <tr key={m.code}>
            <td className={styles.code}>{m.code}</td>
            <td>{formatDate(m.fecha)}</td>
            <td>{m.categoria}</td>
            <td className={styles.note}>{m.nota}</td>
            <td className={`${styles.amount} ${m.tipo === 'ingreso' ? styles.income : ''}`}>
              {m.tipo === 'ingreso' ? '+' : '−'}
              {formatMoney(m.monto)}
            </td>
            <td className={styles.actions}>
              <Button variant="ghost" size="sm" onClick={() => onEdit(m)} aria-label={`Editar ${m.code}`}>
                Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(m)} aria-label={`Borrar ${m.code}`}>
                Borrar
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
