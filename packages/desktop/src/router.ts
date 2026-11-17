import { useMemo, useSyncExternalStore } from 'react';

/**
 * Navegación mínima por hash: `#/`, `#/ajustes`, `#/area/salud?zona=cabeza`.
 * Funciona igual en Electron (archivo local) y en el navegador.
 */

export type Route =
  | { name: 'menu' }
  | { name: 'settings' }
  | { name: 'area'; areaId: string; query: Record<string, string> };

export function areaRoute(areaId: string, query: Record<string, string> = {}): Route {
  return { name: 'area', areaId, query };
}

export function parseRoute(hash: string): Route {
  const [path = '', search = ''] = hash.replace(/^#/, '').split('?');
  let parts: string[];
  try {
    parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { name: 'menu' };
  }

  if (parts.length === 1 && parts[0] === 'ajustes') return { name: 'settings' };
  if (parts.length === 2 && parts[0] === 'area' && parts[1]) {
    return areaRoute(parts[1], Object.fromEntries(new URLSearchParams(search)));
  }
  return { name: 'menu' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'menu':
      return '#/';
    case 'settings':
      return '#/ajustes';
    case 'area': {
      const search = new URLSearchParams(route.query).toString();
      return `#/area/${encodeURIComponent(route.areaId)}${search ? `?${search}` : ''}`;
    }
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parseRoute(hash), [hash]);
}
