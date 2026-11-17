import { defineArea } from '../../area.ts';

export default defineArea({
  id: 'finanzas',
  name: 'Finanzas',
  prefix: 'F',
  emoji: '💰',
  order: 1,
  description: 'Ingresos y egresos: monto, tipo, categoría, fecha y nota. Saldo mensual, gastos por categoría y evolución.',
  // Los comandos del bot se agregan en la fase 2.
  commands: [],
});
