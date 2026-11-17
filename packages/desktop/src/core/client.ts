import type { ApiErrorBody, AreasResponse, HealthResponse } from '@ger/shared';
import type { DesktopConfig } from '../../electron/bridge.ts';

/** Cliente de la API del núcleo. El programa de PC no tiene base propia. */

export class ApiError extends Error {
  override name = 'ApiError';
  /** Código HTTP, o 0 si no hubo respuesta (núcleo apagado, sin red…). */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 8000;

export function createApiClient(config: DesktopConfig, fetchImpl: Fetch = fetch): ApiClient {
  return {
    async get<T>(path: string): Promise<T> {
      let response: Response;
      try {
        response = await fetchImpl(`${config.coreUrl}${path}`, {
          headers: { Authorization: `Bearer ${config.apiToken}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new ApiError(0, `No se pudo conectar con el núcleo en ${config.coreUrl}`);
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as Partial<ApiErrorBody> | null;
        throw new ApiError(response.status, body?.error ?? `El núcleo respondió ${response.status}`);
      }
      return (await response.json()) as T;
    },
  };
}

export type ConnectionStatus =
  | { state: 'checking' }
  | { state: 'ok'; version: string }
  | { state: 'unauthorized' }
  | { state: 'offline'; message: string };

/** Prueba la conexión: primero que el núcleo responda, después que el token sirva. */
export async function checkConnection(config: DesktopConfig, fetchImpl: Fetch = fetch): Promise<ConnectionStatus> {
  const api = createApiClient(config, fetchImpl);
  try {
    const health = await api.get<HealthResponse>('/health');
    await api.get<AreasResponse>('/areas');
    return { state: 'ok', version: health.version };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { state: 'unauthorized' };
    return { state: 'offline', message: error instanceof Error ? error.message : String(error) };
  }
}
