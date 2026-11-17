import {
  DEFAULT_DESKTOP_CONFIG,
  sanitizeConfig,
  type DesktopBridge,
  type DesktopConfig,
} from '../../electron/bridge.ts';

declare global {
  interface Window {
    /** Solo existe dentro de Electron (ver electron/preload.ts). */
    gerDesktop?: DesktopBridge;
  }
}

const STORAGE_KEY = 'gerpersonal.config';

/**
 * Dentro de Electron la configuración vive en un config.json de la carpeta de
 * datos de la app. Fuera de Electron (abrir la interfaz en el navegador para
 * desarrollo) se usa localStorage.
 */
export async function loadDesktopConfig(): Promise<DesktopConfig> {
  if (window.gerDesktop) return window.gerDesktop.getConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeConfig(JSON.parse(raw)) : { ...DEFAULT_DESKTOP_CONFIG };
  } catch {
    return { ...DEFAULT_DESKTOP_CONFIG };
  }
}

export async function saveDesktopConfig(config: DesktopConfig): Promise<DesktopConfig> {
  if (window.gerDesktop) return window.gerDesktop.saveConfig(config);
  const clean = sanitizeConfig(config);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Sin localStorage (modo privado): queda solo en memoria.
  }
  return clean;
}
