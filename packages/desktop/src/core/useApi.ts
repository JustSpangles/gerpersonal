import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './client.ts';
import { useCore } from './CoreProvider.tsx';

export interface ApiQuery<T> {
  /** Último dato recibido (se conserva mientras se recarga, para que no parpadee). */
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload(): void;
}

/**
 * Pide `path` al núcleo y lo vuelve a pedir cuando cambia la ruta, cuando
 * vuelve la conexión o cuando se llama a `reload()`. Con `path = null` no pide nada.
 */
export function useApiQuery<T>(path: string | null): ApiQuery<T> {
  const { api, status } = useCore();
  const connected = status.state === 'ok';
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null || !connected) return;
    let current = true;
    setLoading(true);
    api
      .get<T>(path)
      .then((result) => {
        if (!current) return;
        setData(result);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof ApiError ? reason : new ApiError(0, String(reason)));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [api, path, version, connected]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Sin conexión no se pide nada: el error es el de la conexión.
  if (status.state === 'offline') return { data, error: new ApiError(0, status.message), loading: false, reload };
  if (status.state === 'unauthorized') return { data, error: new ApiError(401, 'El token no coincide con el del núcleo'), loading: false, reload };
  return { data, error, loading: loading || status.state === 'checking', reload };
}
