import { defineArea } from '../../area.ts';

export default defineArea({
  id: 'gimnasio',
  name: 'Gimnasio',
  prefix: 'G',
  emoji: '🏋️',
  order: 2,
  description: 'Ejercicios (series × repeticiones × peso), peso corporal, medidas y fotos de progreso. Récords y comparador de fotos.',
  // Los comandos del bot se agregan en la fase 5.
  commands: [],
});
