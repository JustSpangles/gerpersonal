import { defineArea } from '../../area.ts';

export default defineArea({
  id: 'alimentacion',
  name: 'Alimentación',
  prefix: 'C',
  emoji: '🍽️',
  order: 4,
  description: 'Comida, cantidad, hora y características. Registro diario y resumen semanal.',
  // Los comandos del bot se agregan en la fase 6.
  commands: [],
});
