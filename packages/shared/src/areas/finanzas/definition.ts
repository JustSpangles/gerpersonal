import { defineArea } from '../../area.ts';
import { CAMPOS_MOVIMIENTO } from './movimientos.ts';

export default defineArea({
  id: 'finanzas',
  name: 'Finanzas',
  prefix: 'F',
  emoji: '💰',
  order: 1,
  description: 'Ingresos y egresos: monto, tipo, categoría, fecha y nota. Saldo mensual, gastos por categoría y evolución.',
  // Los dos comandos comparten los campos; solo cambia el tipo, que lo pone la palabra clave.
  commands: [
    {
      id: 'gasto',
      description: 'Anotar un gasto',
      keywords: ['gasté', 'gasto', 'pagué'],
      fields: CAMPOS_MOVIMIENTO,
      fixed: { tipo: 'egreso' },
      example: 'gasté 1.500 - comida - almuerzo con Juan - ayer',
    },
    {
      id: 'ingreso',
      description: 'Anotar un ingreso',
      keywords: ['cobré', 'ingreso'],
      fields: CAMPOS_MOVIMIENTO,
      fixed: { tipo: 'ingreso' },
      example: 'cobré 350.000 - sueldo',
    },
  ],
});
