# gerpersonal
Un programa para llevar registro de todas las areas de interes de mi vida

## Cómo usarlo (en la PC)

Requisitos: Node.js 22.18 o más nuevo.

```bash
npm install
```

1. **Núcleo** (base de datos + API). La primera vez crea `config.json` con un token:

   ```bash
   npm run dev:core
   ```

2. **Programa de PC** (Electron). La primera vez baja Electron:

   ```bash
   npm run dev:desktop
   ```

   En **Ajustes** poné la URL del núcleo (`http://localhost:3210` si corre en la misma PC) y el `apiToken` de `config.json`.

Otros comandos: `npm test`, `npm run typecheck`, `npm run dev:web` (la interfaz sola en el navegador).

La guía completa del proyecto está en [CLAUDE.md](CLAUDE.md).
