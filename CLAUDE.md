# CLAUDE.md — App Personal + Bot de WhatsApp

Guía del proyecto para Claude. Leela completa antes de tocar código.
Idioma del proyecto: **español** (UI, mensajes del bot, comentarios). Nombres de código en inglés o español, pero consistentes dentro de cada archivo.

---

## 1. Qué es

Sistema personal de organización de vida de Ger, con dos puertas de entrada a la misma lógica:

1. **Bot de WhatsApp**: carga rápida de datos por comandos de texto y fotos, y recordatorios automáticos.
2. **Programa de PC**: interfaz visual para ver, editar y analizar todo (gráficos, historial y fotos).

Regla de oro: **una acción = una función de servicio**. El bot y la UI llaman a los mismos servicios. Nunca se duplica lógica de negocio.

---

## 2. Arquitectura

```
                ┌──────────── NÚCLEO (Node + TypeScript) ────────────┐
WhatsApp  ───►  │  bot/ (Baileys) ──┐                                │
                │                   ├──► areas/*/service ──► SQLite  │
PC (UI)   ───►  │  api/ (HTTP) ─────┘                      + /media  │
                │  scheduler/ (node-cron): resumen 7 AM, avisos      │
                └────────────────────────────────────────────────────┘
```

### Despliegue
- **Núcleo** (bot + API + scheduler + DB): corre en un **celular Android dedicado** con chip propio, usando **Termux**. Siempre prendido, enchufado, con Wi-Fi.
  - `termux-wake-lock` y optimización de batería desactivada para Termux.
  - Arranque automático con **Termux:Boot**.
- **Programa de PC** (Electron): es un **cliente**. No tiene base propia; consume la API del núcleo.
  - En casa: por IP local.
  - Fuera de casa: con **Tailscale**.
  - La URL del núcleo es configurable (`config.json` o pantalla de ajustes).
- El núcleo también debe poder correr en la PC (modo desarrollo) o en un VPS sin cambios de código.

### Fuente de verdad y respaldos
- La base **original** vive en el núcleo (celular): `data/app.db` + `data/media/`.
- **Respaldo diario**: al abrir el programa de PC, este pide al núcleo una copia (`GET /backup`) de la DB y de las fotos nuevas, y la guarda en `backups/AAAA-MM-DD/`. Conserva las últimas **30** copias.
- Restaurar = copiar un respaldo a `data/` en un núcleo nuevo.

---

## 3. Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (strict) en todo el proyecto |
| Núcleo | Node.js 22+ |
| DB | SQLite (`node:sqlite` nativo o `better-sqlite3`; elegir el que compile en Termux) |
| Validación | Zod (los esquemas de campos se reutilizan en bot, API y UI) |
| API | Fastify (o Express), JSON sobre HTTP |
| Bot | Baileys (WhatsApp no oficial, vinculado por QR) |
| Tareas programadas | node-cron |
| PC | Electron + React + Vite |
| Gráficos | Recharts (o Chart.js) |
| Tests | Vitest |

Monorepo con **npm workspaces**:

```
/
├─ CLAUDE.md
├─ package.json
├─ packages/
│  ├─ shared/        # tipos, definiciones de áreas/campos (Zod), parser de comandos
│  ├─ core/          # núcleo: db, api, bot, scheduler, servicios
│  └─ desktop/       # Electron + React
└─ data/             # (gitignored) app.db, media/
```

---

## 4. Estructura modular por áreas

Cada área es autocontenida y se **registra sola** en el registro central. Agregar un área = agregar una carpeta. No se toca el resto.

```
packages/shared/src/areas/<area>/definition.ts   # campos, comandos, prefijo de código
packages/core/src/areas/<area>/schema.sql        # tablas
packages/core/src/areas/<area>/service.ts        # lógica (crear, listar, editar, borrar, stats)
packages/core/src/areas/<area>/commands.ts       # (opcional) comportamiento extra del bot
packages/desktop/src/areas/<area>/View.tsx       # pantalla del área
packages/desktop/src/areas/<area>/charts.tsx     # gráficos
```

Cada definición de comando declara **sus campos una sola vez**, y de ahí se derivan:
- el mensaje de formato del bot,
- el parser del comando,
- la validación,
- el formulario de la UI.

Ejemplo de definición (orientativo):

```ts
defineCommand({
  area: 'comida',
  keywords: ['comí', 'comi'],
  prefix: 'C',
  fields: [
    { key: 'nombre',   type: 'text',   required: true },
    { key: 'cantidad', type: 'enum',   options: ['poco', 'normal', 'mucho'], default: 'normal' },
    { key: 'hora',     type: 'time',   default: 'now' },
  ],
  example: 'comí milanesa con puré - normal - 13:30',
});
```

---

## 5. Áreas

| Área | Prefijo | Ícono en menú | Contenido |
|---|---|---|---|
| Finanzas | `F` | Billetera | Ingresos y egresos: monto, tipo, categoría, fecha y nota. Gráficos: saldo mensual, torta por categoría, evolución. |
| Gimnasio | `G` | Barra con discos | Ejercicios (series × repeticiones × peso), peso corporal, medidas y fotos de progreso. Gráficos por ejercicio, récords y comparador de fotos. |
| Alimentación | `C` | Plato de comida | Comida, cantidad, hora y características (etiquetas; nutrientes a futuro). Registro diario y resumen semanal. |
| Salud | `S` | Cuerpo humano (rectángulo grande) | Zona del cuerpo, síntoma, intensidad 1–10, estado (activo/consultar/resuelto), notas y fotos. Historial por zona. Marcar "para el médico" y generar un resumen. |
| Calendario | `E` | Calendario | Eventos y responsabilidades con fecha y hora. Avisos previos. |
| Sobre mí | `D` | Texto "SOBRE MI" | Diario libre + ánimo 1–5. Línea de tiempo y gráfico de ánimo. **Exportable** (JSON/Markdown) para análisis con IA. |
| Trabajo (gasista) | `T` | Texto "GAS" | **Estudio**: temas cargados por Ger; cada día el sistema elige uno, pregunta y registra la respuesta (repetición espaciada: lo que se falla vuelve antes). **Experiencia**: aprendizajes del trabajo, con fotos y etiquetas. |

---

## 6. Códigos de registro

- Cada registro recibe un código **prefijo + número correlativo por área**: `C14`, `F203`, `S3`.
- Los números nunca se reutilizan, aunque se borre el registro.
- Se muestran en el bot (en cada confirmación) y en la UI (en cada fila o tarjeta).

Tabla común de adjuntos para fotos de cualquier área:

```sql
attachments(id, record_code, file_path, mime, created_at)
```

---

## 7. Bot de WhatsApp — reglas

### Formato de comandos
- Sintaxis: `<palabra clave> campo1 - campo2 - campo3`
- Separador: **` - `** (guion con espacios), para que un nombre como "pan-queque" no se rompa.
- Palabras clave insensibles a mayúsculas y tildes (`comí` = `comi` = `Comí`).
- **Solo la palabra clave** (`comí`) → el bot responde con el formato y un ejemplo.
- Los campos opcionales van al final y toman su valor por defecto si se omiten (por ejemplo, hora = ahora).
- Si un campo es inválido, el bot dice **cuál** y repite el formato.
- Solo responde al **número de Ger** (lista blanca en la configuración). Ignora todo lo demás.

### Comandos globales
- `ayuda` → lista de todos los comandos por área.
- `ver <código>` → muestra el registro y sus fotos.
- `editar <código> <campo> - <valor>` → corrige un campo.
- `borrar <código>` → pide confirmación (`sí`) y borra.
- **Foto con texto `<código>`** → se adjunta a ese registro.
- **Foto respondiendo (citando) un mensaje de confirmación del bot** → se adjunta a ese registro.

### Respuestas
- Confirmación: `✅ C14 guardado: milanesa · normal · 13:30`
- Cortas, con emoji del área y siempre con el código.

### Mensajes automáticos (scheduler)
- **07:00 todos los días**: resumen del día (eventos, tema de estudio de gasista, vencimientos y una invitación a escribir en el diario).
- Aviso previo a cada evento (por defecto, 1 h antes; configurable).
- Zona horaria: `America/Argentina/Buenos_Aires`.

---

## 8. Programa de PC — UI

- **Menú principal**: un rectángulo grande con un cuerpo humano (SVG con zonas clickeables → Salud de esa zona) y cuadrados para cada área: billetera, barra con discos, "GAS", plato, calendario y "SOBRE MI".
- Cada cuadro abre la vista del área: valores, gráficos, historial, texto y fotos, y un formulario para agregar o editar (generado desde la definición de campos).
- **Versión actual: simplificada.** Prioridad: que funcione y esté bien estructurada.
- Todo lo visual pasa por un **tema central** (`desktop/src/theme/`: colores, tipografías, espaciados) y **componentes base** reutilizables. Más adelante Ger va a reemplazar el diseño con el suyo (Figma → SVG): eso solo debería requerir cambiar el tema, los íconos y los componentes base.
- Íconos y el cuerpo humano en `desktop/src/assets/` como SVG, reemplazables.

---

## 9. Fases

1. **Esqueleto**: monorepo, DB y migraciones, registro de áreas, API base, Electron con menú principal (cuadros y cuerpo) y vistas vacías.
2. **Finanzas completa** (servicio, API, UI y gráficos, comandos). Sirve como **plantilla** para el resto.
3. **Bot**: conexión por QR, parser genérico, `ayuda`/`ver`/`editar`/`borrar`, fotos por código y por cita. Comandos de Finanzas.
4. **Calendario** + scheduler (resumen 7 AM y avisos).
5. Gimnasio y Sobre mí.
6. Salud (mapa del cuerpo), Alimentación y Trabajo (estudio con repetición espaciada).
7. Despliegue en Android/Termux, Tailscale y respaldo diario en la PC.

### Estado actual
- [ ] Fase 1
- [ ] Fase 2
- [ ] Fase 3
- [ ] Fase 4
- [ ] Fase 5
- [ ] Fase 6
- [ ] Fase 7

(Actualizar esta lista al terminar cada fase.)

---

## 10. Convenciones de trabajo para Claude

- **Una área o una fase por sesión.** Pedidos chicos y concretos.
- Antes de crear algo nuevo, **copiar el patrón de Finanzas** (desde la fase 2).
- Toda la lógica va en `service.ts`, con **tests en Vitest**. El bot y la API son capas finas.
- Migraciones de DB numeradas (`001_init.sql`, `002_finanzas.sql`…). Nunca editar una migración ya aplicada.
- No agregar dependencias sin motivo. Deben funcionar en **Termux (ARM)**.
- Fechas en ISO 8601 en la DB. Mostrar en formato argentino (`dd/mm`, 24 h).
- Montos en **centavos (enteros)** en la DB. Mostrar en pesos con separador argentino.
- Secretos y datos (`data/`, sesión de Baileys, `config.json`) siempre en `.gitignore`.
- Al terminar una tarea: correr los tests, actualizar "Estado actual" y anotar en este archivo las decisiones nuevas.
