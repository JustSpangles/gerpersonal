import { buildRegistry } from '@ger/shared';
import type { ComponentType } from 'react';
import { EmptyAreaView } from './EmptyAreaView.tsx';
import type { AreaViewProps } from './types.ts';

/**
 * Todo se descubre por carpeta; agregar un área no requiere tocar este archivo.
 * - Definiciones: `packages/shared/src/areas/<id>/definition.ts` (las mismas del núcleo).
 * - Pantallas:    `src/areas/<id>/View.tsx` (si falta, se usa la vista vacía).
 * - Íconos:       `src/assets/icons/<id>.svg` (si falta, se muestra el nombre).
 */

export const areas = buildRegistry(import.meta.glob('@shared/areas/*/definition.ts', { eager: true }));

const views = import.meta.glob<ComponentType<AreaViewProps>>('./*/View.tsx', { eager: true, import: 'default' });

export function getAreaView(areaId: string): ComponentType<AreaViewProps> {
  return views[`./${areaId}/View.tsx`] ?? EmptyAreaView;
}

const icons = import.meta.glob<string>('../assets/icons/*.svg', { eager: true, query: '?raw', import: 'default' });

export function getAreaIcon(areaId: string): string | undefined {
  return icons[`../assets/icons/${areaId}.svg`];
}

/** El área que ocupa el rectángulo grande del menú, con el cuerpo humano. */
export const BODY_AREA_ID = 'salud';
