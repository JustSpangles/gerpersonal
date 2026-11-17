import type { AreaDefinition } from '@ger/shared';

/** Props que recibe la pantalla de cada área (`src/areas/<id>/View.tsx`). */
export interface AreaViewProps {
  area: AreaDefinition;
  /** Parámetros de la ruta, p. ej. `{ zona: 'cabeza' }` en Salud. */
  query: Record<string, string>;
}
