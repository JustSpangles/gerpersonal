import type { ApiErrorBody, AreasResponse, HealthResponse } from '@ger/shared';
import type { DesktopConfig } from '../../electron/bridge.ts';

/** Cliente de la API del núcleo. El programa de PC no tiene base propia. */

export class ApiError extends Error {
  override name = 'ApiError';
  /** Código HTTP, o 0 si no hubo respuesta (núcleo apagado, sin red…). */
  readonly status: number;
  /** Errores por campo cuando los datos no son válidos (400). */
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete(path: string): Promise<void>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 8000;

export function createApiClient(config: DesktopConfig, fetchImpl: Fetch = fetch): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${config.apiToken}` };
    // Sin cuerpo no se manda Content-Type: el núcleo rechaza un JSON vacío.
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetchImpl(`${config.coreUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ApiError(0, `No se pudo conectar con el núcleo en ${config.coreUrl}`);
    }
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as Partial<ApiErrorBody> | null;
      throw new ApiError(response.status, error?.error ?? `El núcleo respondió ${response.status}`, error?.campos);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
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
