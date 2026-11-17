import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Configuración de la interfaz (React). La usa electron-vite para la app y
 * también `npm run dev:web`, que abre la interfaz sola en el navegador.
 */
export const rendererConfig = defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    // Para descubrir las definiciones de áreas con import.meta.glob.
    alias: { '@shared': resolve(__dirname, '../shared/src') },
  },
  build: { rolldownOptions: { input: resolve(__dirname, 'index.html') } },
});

export default rendererConfig;
