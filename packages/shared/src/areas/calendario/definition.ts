import { defineArea } from '../../area.ts';

export default defineArea({
  id: 'calendario',
  name: 'Calendario',
  prefix: 'E',
  emoji: '📅',
  order: 5,
  description: 'Eventos y responsabilidades con fecha y hora, con avisos previos.',
  // Los comandos del bot se agregan en la fase 4.
  commands: [],
});
