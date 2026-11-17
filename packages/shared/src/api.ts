import type { AreaDefinition } from './area.ts';

/** Contratos de la API HTTP del núcleo, compartidos con el programa de PC. */

export interface HealthResponse {
  ok: true;
  name: string;
  version: string;
  /** Hora del núcleo, ISO 8601 (UTC). */
  time: string;
}

export interface AreasResponse {
  areas: AreaDefinition[];
}

export interface AreaResponse {
  area: AreaDefinition;
}

export interface ApiErrorBody {
  error: string;
}
