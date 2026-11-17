import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import { rendererConfig } from './vite.config.ts';

/**
 * Tres partes:
 * - main     (electron/main.ts):    proceso principal de Electron.
 * - preload  (electron/preload.ts): puente seguro entre Electron y la interfaz.
 * - renderer (index.html + src/):   la interfaz en React (config en vite.config.ts).
 */
export default defineConfig({
  main: {
    build: { rolldownOptions: { input: { index: resolve(__dirname, 'electron/main.ts') } } },
  },
  preload: {
    build: { rolldownOptions: { input: { index: resolve(__dirname, 'electron/preload.ts') } } },
  },
  renderer: rendererConfig,
});
