import { defineArea } from '../../area.ts';

export default defineArea({
  id: 'salud',
  name: 'Salud',
  prefix: 'S',
  emoji: '🩺',
  order: 0,
  description: 'Zona del cuerpo, síntoma, intensidad 1–10, estado (activo, consultar o resuelto), notas y fotos. Historial por zona y resumen para el médico.',
  // Los comandos del bot se agregan en la fase 6.
  commands: [],
});
