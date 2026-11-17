import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DesktopConfig } from '../../electron/bridge.ts';
import { checkConnection, createApiClient, type ApiClient, type ConnectionStatus } from './client.ts';
import { loadDesktopConfig, saveDesktopConfig } from './config.ts';

/** Estado de la conexión con el núcleo, disponible en toda la interfaz. */

interface CoreContextValue {
  config: DesktopConfig;
  status: ConnectionStatus;
  api: ApiClient;
  refresh(): Promise<void>;
  saveConfig(config: DesktopConfig): Promise<void>;
}

const CoreContext = createContext<CoreContextValue | null>(null);

const RECHECK_MS = 30_000;

export function CoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<DesktopConfig | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({ state: 'checking' });

  useEffect(() => {
    void loadDesktopConfig().then(setConfig);
  }, []);

  const refresh = useCallback(async () => {
    if (config) setStatus(await checkConnection(config));
  }, [config]);

  useEffect(() => {
    if (!config) return;
    setStatus({ state: 'checking' });
    void refresh();
    const timer = setInterval(() => void refresh(), RECHECK_MS);
    return () => clearInterval(timer);
  }, [config, refresh]);

  const saveConfig = useCallback(async (next: DesktopConfig) => {
    setConfig(await saveDesktopConfig(next));
  }, []);

  const value = useMemo(
    () => (config ? { config, status, api: createApiClient(config), refresh, saveConfig } : null),
    [config, status, refresh, saveConfig],
  );

  if (!value) return null;
  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>;
}

export function useCore(): CoreContextValue {
  const value = useContext(CoreContext);
  if (!value) throw new Error('useCore() tiene que usarse dentro de <CoreProvider>');
  return value;
}
