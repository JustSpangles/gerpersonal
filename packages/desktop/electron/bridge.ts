/**
 * Contrato entre el proceso principal de Electron y la interfaz.
 * Este archivo no importa nada de Electron ni de Node: lo usan los dos lados.
 */

/** Configuración del programa de PC. Se guarda en la carpeta de datos de Electron. */
export interface DesktopConfig {
  /** URL del núcleo: IP local en casa o IP de Tailscale afuera. */
  coreUrl: string;
  /** El mismo `apiToken` del config.json del núcleo. */
  apiToken: string;
}

/** Lo que la interfaz ve como `window.gerDesktop` (solo dentro de Electron). */
export interface DesktopBridge {
  getConfig(): Promise<DesktopConfig>;
  saveConfig(config: DesktopConfig): Promise<DesktopConfig>;
}

export const DEFAULT_DESKTOP_CONFIG: DesktopConfig = {
  coreUrl: 'http://localhost:3210',
  apiToken: '',
};

/**
 * Limpia una URL escrita a mano: agrega http:// si falta y saca la barra final.
 * Devuelve null si no es una URL http(s) válida.
 */
export function normalizeCoreUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Convierte cualquier cosa leída de disco en una configuración válida. */
export function sanitizeConfig(raw: unknown): DesktopConfig {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const coreUrl = typeof value.coreUrl === 'string' ? normalizeCoreUrl(value.coreUrl) : null;
  return {
    coreUrl: coreUrl ?? DEFAULT_DESKTOP_CONFIG.coreUrl,
    apiToken: typeof value.apiToken === 'string' ? value.apiToken.trim() : '',
  };
}
