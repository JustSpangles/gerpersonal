/**
 * Zonas del cuerpo para el área Salud.
 *
 * Izquierda y derecha son las de Ger (no las de quien mira la figura).
 * El SVG del cuerpo del programa de PC marca cada zona con `id="zona-<id>"`;
 * un test verifica que el dibujo y esta lista coincidan.
 */
export const ZONAS_CUERPO = [
  { id: 'cabeza', nombre: 'Cabeza' },
  { id: 'cuello', nombre: 'Cuello' },
  { id: 'hombro-derecho', nombre: 'Hombro derecho' },
  { id: 'hombro-izquierdo', nombre: 'Hombro izquierdo' },
  { id: 'pecho', nombre: 'Pecho' },
  { id: 'abdomen', nombre: 'Abdomen' },
  { id: 'pelvis', nombre: 'Pelvis' },
  { id: 'brazo-derecho', nombre: 'Brazo derecho' },
  { id: 'brazo-izquierdo', nombre: 'Brazo izquierdo' },
  { id: 'mano-derecha', nombre: 'Mano derecha' },
  { id: 'mano-izquierda', nombre: 'Mano izquierda' },
  { id: 'pierna-derecha', nombre: 'Pierna derecha' },
  { id: 'pierna-izquierda', nombre: 'Pierna izquierda' },
  { id: 'pie-derecho', nombre: 'Pie derecho' },
  { id: 'pie-izquierdo', nombre: 'Pie izquierdo' },
] as const;

export type ZonaCuerpo = (typeof ZONAS_CUERPO)[number]['id'];

export function nombreZona(id: string): string | undefined {
  return ZONAS_CUERPO.find((zona) => zona.id === id)?.nombre;
}
