# Conversación de ejemplo con el bot

Son las respuestas **reales** del bot. Este archivo lo arma `conversation.test.ts` mandándole cada mensaje
al bot, sin WhatsApp de por medio. Si cambia alguna respuesta, el test falla; para aceptar el cambio:
`npx vitest run -u`.

La charla es el jueves 19/11/2026 desde las 13:30 (un minuto entre mensaje y mensaje) y la base arranca vacía.
En WhatsApp, `*así*` se ve en **negrita** y `_así_` en _cursiva_.

## Qué sabe hacer

**Ger:** `ayuda`

```
📋 *Comandos*

💰 *Finanzas*
• *gasté* (gasto, pagué): anotar un gasto
• *cobré* (ingreso): anotar un ingreso

🔧 *Con cualquier registro*
• *ver* F14: muestra el registro y sus fotos
• *editar* F14 monto - 1.500: corrige un campo
• *borrar* F14: lo borra (te pido que confirmes)
• 📷 Una foto con el código de pie (F14), o respondiendo a uno de mis mensajes, queda guardada en ese registro

Mandame solo la palabra clave (ej.: *gasté*) y te explico el formato.
_Más adelante: Salud, Gimnasio, Trabajo (gasista), Alimentación, Calendario y Sobre mí._
```

## Anotar gastos e ingresos

**Ger:** `gasté`

```
💰 *Anotar un gasto*
gasté monto - categoría - nota - fecha
• Monto: en pesos. Ej.: 1.500 o 1500,50
• Categoría: ej.: comida, transporte, sueldo
• Nota: opcional
• Fecha: opcional (si no va: hoy). Ej.: ayer o 16/11
Ejemplo: gasté 1.500 - comida - almuerzo con Juan - ayer
_También sirve: gasto, pagué_
```

**Ger:** `gasté 1.500 - comida - almuerzo con Juan - ayer`

```
✅ 💰 F1 guardado: Gasto · $ 1.500 · comida · almuerzo con Juan · 18/11
```

**Ger:** `Cobré 350.000 - sueldo`

```
✅ 💰 F2 guardado: Ingreso · $ 350.000 · sueldo · 19/11
```

**Ger:** `pagué 12.000,50 - Luz - - 15/11`

```
✅ 💰 F3 guardado: Gasto · $ 12.000,50 · Luz · 15/11
```

## Cuando algo está mal

**Ger:** `gasté mil - comida`

```
⚠️ Monto: no es un monto válido (ej.: 1.500 o 1500,50)

💰 *Anotar un gasto*
gasté monto - categoría - nota - fecha
• Monto: en pesos. Ej.: 1.500 o 1500,50
• Categoría: ej.: comida, transporte, sueldo
• Nota: opcional
• Fecha: opcional (si no va: hoy). Ej.: ayer o 16/11
Ejemplo: gasté 1.500 - comida - almuerzo con Juan - ayer
_También sirve: gasto, pagué_
```

**Ger:** `gasté 2500`

```
⚠️ Falta: categoría

💰 *Anotar un gasto*
gasté monto - categoría - nota - fecha
• Monto: en pesos. Ej.: 1.500 o 1500,50
• Categoría: ej.: comida, transporte, sueldo
• Nota: opcional
• Fecha: opcional (si no va: hoy). Ej.: ayer o 16/11
Ejemplo: gasté 1.500 - comida - almuerzo con Juan - ayer
_También sirve: gasto, pagué_
```

**Ger:** `gaste 800 - café - - el lunes`

```
⚠️ Fecha: no es una fecha válida (ej.: 16/11, ayer o 2026-11-16)

💰 *Anotar un gasto*
gasté monto - categoría - nota - fecha
• Monto: en pesos. Ej.: 1.500 o 1500,50
• Categoría: ej.: comida, transporte, sueldo
• Nota: opcional
• Fecha: opcional (si no va: hoy). Ej.: ayer o 16/11
Ejemplo: gasté 1.500 - comida - almuerzo con Juan - ayer
_También sirve: gasto, pagué_
```

## Fotos

**Ger:** 📷 _foto_ respondiendo a «✅ 💰 F1 guardado: Gasto · $ 1.500 · com…»

```
📎 Foto guardada en F1.
```

**Ger:** 📷 _foto_ con el pie `F3`

```
📎 Foto guardada en F3.
```

**Ger:** 📷 _foto_ con el pie `gasté 8.900 - super - compra semanal`

```
✅ 💰 F4 guardado: Gasto · $ 8.900 · super · compra semanal · 19/11
📎 Foto guardada en F4.
```

**Ger:** 📷 _foto_

```
📷 ¿De qué registro es la foto? No la guardé: mandala de nuevo con el código de pie (ej.: F14) o respondiendo a mi mensaje de ese registro.
```

## Ver, corregir y borrar

**Ger:** `ver F1`

```
💰 *F1* · Finanzas
Tipo: Gasto
Monto: $ 1.500
Categoría: comida
Nota: almuerzo con Juan
Fecha: 18/11
📎 1 foto
_Para corregir: editar F1 campo - valor_
```
```
📷 [foto 2026-11/F1_2026-11-19_13-38.jpg] F1
```

**Ger:** `editar F1 monto - 1.800`

```
✏️ 💰 F1 corregido · Monto: $ 1.500 → $ 1.800
Gasto · $ 1.800 · comida · almuerzo con Juan · 18/11
```

**Ger:** `editar F3 nota - factura de octubre`

```
✏️ 💰 F3 corregido · Nota: — → factura de octubre
Gasto · $ 12.000,50 · Luz · factura de octubre · 15/11
```

**Ger:** `editar F1 color - rojo`

```
⚠️ F1 no tiene el campo «color». Tiene: tipo, monto, categoría, nota y fecha.
Formato: editar F1 campo - valor
```

**Ger:** `borrar F2`

```
🗑️ 💰 ¿Borro F2? Ingreso · $ 350.000 · sueldo · 19/11
Respondé *sí* para borrarlo. Cualquier otra cosa lo cancela.
```

**Ger:** `sí`

```
🗑️ F2 borrado.
```

**Ger:** `borrar F4`

```
🗑️ 💰 ¿Borro F4? Gasto · $ 8.900 · super · compra semanal · 19/11 · con 1 foto
Respondé *sí* para borrarlo. Cualquier otra cosa lo cancela.
```

**Ger:** `gasté 300 - café`

```
👌 No borré F4.
```
```
✅ 💰 F5 guardado: Gasto · $ 300 · café · 19/11
```

**Ger:** `ver F2`

```
⚠️ No existe el registro F2.
```

## Otras cosas

**Ger:** `hola!`

```
🤔 No entendí «hola!». Escribí *ayuda* para ver los comandos.
```

**Ger:** 🎤 _audio_

```
🤔 Por ahora entiendo texto y fotos. Escribí *ayuda* para ver los comandos.
```

**Otro número:** `ayuda`

_(no hay respuesta: ese número no está en la lista blanca)_
