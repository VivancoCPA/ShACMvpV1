# INSTRUCCIONES PARA CLAUDE CODE — Asistente IA del QE: sugerir también el diagrama de Ishikawa

- **Fecha:** 2026-11-03
- **Autor:** Cowork (para Toño)
- **Origen:** Toño preguntó por qué el asistente de IA solo funciona con el método de los 5 Porqués y no con el diagrama de Ishikawa.
- **Change OpenSpec:** `qe-asistente-ia-ishikawa`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** va sobre `qe-asistente-ia` y `qe-analisis-causa-raiz-fix`, que ya están implementados. Si alguno sigue sin archivar, archivarlo primero.
- **Sin migración.**

---

## 1. Diagnóstico confirmado leyendo el código

Es **comportamiento por diseño**, no un bug. El PRD §1.7 solo pide un "borrador de 5 Porqués", y en `qe-asistente-ia` el Ishikawa quedó explícitamente fuera de alcance (§5). En el código implementado:

- **Backend.** En `Features/QualityEvents/AsistenteIA/`, ningún archivo menciona Ishikawa:
  - `AnthropicAsistenteCausaRaizClient.cs`:
    - el system prompt pide `cincoPorques` (línea 29);
    - el esquema de salida estructurada (`output_config.format`, desde la línea 148 aprox.) exige `["causaRaizProbable", "cincoPorques", "accionesSugeridas"]`;
    - la validación pide exactamente 5 porqués (líneas 128–130);
    - el record privado es `RespuestaIA(CausaRaizProbable, CincoPorques, AccionesSugeridas)`.
  - `AsistenteIAModels.cs`: `SugerenciaCausaRaiz` tiene `List<CincoPorqueItem> CincoPorques`, sin Ishikawa.
  - `AsistenteCausaRaizSimulado.cs` devuelve solo 5 Porqués.
- **Comando de guardado.** En `ActualizarQualityEventCommand.cs:30`, `OrigenIA(string? CausaRaiz, string? CincoPorques)` no tiene un campo para Ishikawa.
- **Frontend** (`components/QEInvestigationSection.tsx`):
  - la consulta (línea 397 aprox.) no envía el método elegido;
  - el panel solo tiene los bloques `causaRaiz`, `cincoPorques` y `acciones` (líneas 515–542);
  - `usarCincoPorques` (líneas 428–431) **fuerza** `metodoAnalisis = '5_PORQUES'` y limpia el Ishikawa. Por eso, aunque el usuario tenga elegido Ishikawa, al usar la sugerencia la pantalla cambia a 5 Porqués;
  - `origenIA` solo calcula `causaRaiz` y `cincoPorques` (líneas 301 y 338–342).

---

## 2. Decisión de Toño

- La IA sugiere **según el método elegido** en el QE:
  - con **5_PORQUES** elegido, devuelve los 5 Porqués, como hoy;
  - con **ISHIKAWA** elegido, devuelve las **6 categorías** en lugar de los 5 Porqués.
- La causa raíz probable y las acciones sugeridas se mantienen en los dos casos.
- Sigue siendo **una sola consulta**, del mismo costo.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/Features/QualityEvents/`)

**a) Pedido**

- `POST /api/quality-events/{id}/asistente-ia` acepta un body **opcional** `{ metodo: "5_PORQUES" | "ISHIKAWA" }`.
  - Si no viene, usar `qe.MetodoAnalisis`, y si ese también es null, `5_PORQUES`. Así los clientes actuales siguen funcionando.
  - Un valor inválido responde 400.
- Pasar el método al cliente: `SugerirAsync(ContextoQE ctx, string metodo, CancellationToken ct)`, o agregar el método a `ContextoQE`, lo que quede más limpio. Dejar anotado en `design.md` cuál se eligió.

**b) Modelo de respuesta** (`AsistenteIAModels.cs`)

- `SugerenciaCausaRaiz` agrega `List<IshikawaItem>? Ishikawa` y `CincoPorques` pasa a ser nullable. Viene **exactamente uno de los dos**, según el método.
- Reutilizar `IshikawaItem` y `IshikawaCategoria` de `qe-analisis-causa-raiz-fix` (`Shared/AnalisisCausaRaizDtos.cs`). **No** duplicar el enum.

**c) Cliente real** (`AnthropicAsistenteCausaRaizClient.cs`)

- Hay que mantener el mecanismo actual de salida estructurada (`output_config.format`, divergencia D1 de `qe-asistente-ia`) y **elegir el esquema según el método**:
  - **5_PORQUES:** el esquema actual, sin cambios.
  - **ISHIKAWA:** `required: ["causaRaizProbable", "ishikawa", "accionesSugeridas"]`, donde `ishikawa` es un array de **exactamente 6** objetos `{ categoria, causa }`:
    - `categoria` es un `enum` con los 6 literales de `IshikawaCategoria`, copiados del enum real del backend, que coincide con el frontend;
    - `causa` es un string de 20 a 500 caracteres.
- **System prompt:** agregar el bloque correspondiente al método:
  - **Ishikawa:** "Completa las 6 categorías del diagrama de Ishikawa (Método, Máquina, Material, Mano de obra, Medición, Medio ambiente), una vez cada una. Si una categoría no aplica al evento, indícalo explícitamente con una frase breve (por ejemplo: 'No se identifican causas en esta categoría para este evento') en lugar de inventar una causa."
  - **5 Porqués:** queda el texto actual.
- **Validación** en un método aparte:
  - **Ishikawa:** 6 ítems, las 6 categorías **sin repetir**, ninguna `causa` vacía. Si no cumple, se lanza `AsistenteIANoDisponibleException`, igual que hoy.
  - Mantener la validación actual de los 5 Porqués.
- **Mapeo:** el record privado `RespuestaIA` agrega `List<IshikawaIA>? Ishikawa`, con `IshikawaIA(string? Categoria, string? Causa)`. Mapear a `IshikawaItem`, con trim y parseo del enum, de forma insensible a mayúsculas.

**d) Simulado** (`AsistenteCausaRaizSimulado.cs`)

- Con `ISHIKAWA`, devolver 6 causas fijas en español, una por categoría, coherentes con el tipo y el área del contexto. Por lo menos una debe ser la frase de "no aplica", para que se ejercite ese caso.
- Con `5_PORQUES`, como hoy.
- El texto `[simular-error-ia]` sigue funcionando con los dos métodos.

**e) Handler** (`AsistirCausaRaizIAHandler.cs`)

- En `ASISTENTE_IA_CONSULTADO`, agregar el método a `ValorNuevo`, por ejemplo `"claude-sonnet-5-5 · ISHIKAWA"` o `"simulado · 5_PORQUES"`.
- El límite diario se mantiene: cuenta todas las consultas, sin distinguir el método.

**f) Guardado con trazabilidad**

- En `ActualizarQualityEventCommand.cs`, `OrigenIA` agrega `string? Ishikawa`, que acepta `"IA"` o `"IA_EDITADO"`.
- En `ActualizarQualityEventHandler`, aplicar al `TrackChange` de `ishikawa` el mismo tratamiento que ya tienen `cincoPorques` y `causaRaiz`:
  - `GeneradoPorIA = true` si el origen es `"IA"`;
  - el sufijo "(sugerencia IA editada)" si es `"IA_EDITADO"`.

### 3.2 Frontend (`shc-controldoc/src/features/quality-events/`)

**a) Consulta**

- `hooks/useAsistenteIA.ts` y `api/quality-events.api.ts`: enviar `{ metodo }` con el valor **actual** del formulario (`watch('metodoAnalisis')`), no con el guardado.
  - Si el usuario cambió de método y no guardó, la sugerencia sigue lo que se ve en pantalla.
- Agregar `ishikawa?: Ishikawa[]` al tipo de la sugerencia, en `types/qualityEvent.types.ts`.

**b) Panel de sugerencias** (`QEInvestigationSection.tsx`)

- Agregar el bloque **"Diagrama de Ishikawa"**, que se muestra cuando la sugerencia trae `ishikawa`. Va en una lista con las 6 categorías, con su etiqueta i18n existente (`detail.investigation.ishikawaCategoria.*`) y la causa.
- Tiene los botones "Usar" y "Descartar", igual que el bloque de los 5 Porqués.
- `ocultarBloque` acepta también `'ishikawa'`.

**c) Usar la sugerencia**

- **`usarCincoPorques`:** ya **no** fuerza el método por las suyas. Como la sugerencia corresponde al método elegido, al usarla el método ya es 5_PORQUES. Si aun así llega con otro método (por ejemplo, porque el usuario cambió de método mientras esperaba la respuesta), pedir confirmación: "La sugerencia es de 5 Porqués; ¿cambiar el método?".
- **Nuevo `usarIshikawa(filas)`**, simétrico al anterior:
  - aplica las 6 filas **en el orden de `ISHIKAWA_CATEGORIAS`** del componente, buscando por `categoria` y no por la posición;
  - limpia `cincoPorques` con `buildDefaultCincoPorques()` y deja `metodoAnalisis = 'ISHIKAWA'`;
  - si ya había datos, pide la misma confirmación de reemplazo. Agregar una variante de la clave: `detail.investigation.ia.confirmarReemplazoIshikawa`, "¿Reemplazar el diagrama de Ishikawa actual por la sugerencia?".
  - Registrar `aplicadoIA.ishikawa = filas`.

**d) Marca IA y `origenIA`**

- Calcular `origenIshikawa` con el mismo `origenCampo(...)` que se usa para los 5 Porqués, comparando por categoría.
- Las causas que vienen de la IA muestran la marca "IA", y si se editan, "IA (editado)".
- Al guardar con método ISHIKAWA, enviar `origenIA.ishikawa`.
- La condición `if (origenIA.causaRaiz || origenIA.cincoPorques)` debe incluir también `ishikawa`.

**e) i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.investigation.ia.bloqueIshikawa` | Diagrama de Ishikawa sugerido | Suggested Ishikawa diagram |
| `detail.investigation.ia.confirmarReemplazoIshikawa` | ¿Reemplazar el diagrama de Ishikawa actual por la sugerencia? | Replace the current Ishikawa diagram with the suggestion? |
| `detail.investigation.ia.confirmarCambioMetodo` | La sugerencia es de {{metodo}}; ¿cambiar el método? | The suggestion is for {{metodo}}; switch method? |

### 3.3 MSW (`mocks/handlers/quality-events.handlers.ts`)

- `POST /api/quality-events/:id/asistente-ia` lee `body.metodo`:
  - con `ISHIKAWA`, devuelve 6 categorías fijas;
  - con `5_PORQUES` o sin método, responde como hoy.
- Actualizar los tests de `quality-events.handlers.test.ts` (alrededor de la línea 1304).

---

## 4. Tests

**Backend**, con `HttpMessageHandler` falso. **Nunca la API real.**
- Con `metodo = ISHIKAWA`:
  - el request a la API lleva el esquema de Ishikawa (capturar el body y verificar `required` y las 6 categorías);
  - una respuesta válida devuelve 200 con `ishikawa` (6) y `cincoPorques = null`.
- Con `metodo = 5_PORQUES` o sin body: el comportamiento actual no cambia (regresión).
- Validación de Ishikawa: 5 categorías, una repetida, una causa vacía o una categoría desconocida producen 503 `IA_NO_DISPONIBLE`.
- Un `metodo` inválido devuelve 400.
- Simulado con ISHIKAWA: 6 categorías, una con la frase de "no aplica", sin HTTP. El audit trail registra `"simulado · ISHIKAWA"`.
- Guardado con `origenIA.ishikawa = "IA"`: el audit de `ishikawa` queda con `GeneradoPorIA = true`. Con `"IA_EDITADO"`, lleva el sufijo.

**Frontend**
- Con Ishikawa elegido, "Asistir con IA" envía `{ metodo: 'ISHIKAWA' }`.
- El panel muestra el bloque Ishikawa y **no** el de 5 Porqués.
- "Usar" completa las 6 categorías en su lugar, deja el método en Ishikawa y no cambia a 5 Porqués.
- Con datos previos, pide confirmación.
- Si se edita una causa, la marca pasa a "IA (editado)" y se envía `origenIA.ishikawa = 'IA_EDITADO'`.
- Con 5 Porqués elegido, todo sigue como hoy (regresión).

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5.
- **Prueba manual con MSW apagado**, primero en **modo simulado** y después, si hay clave, con `claude-haiku-5-5`:
  1. En un QE en EN_INVESTIGACION, elegir **Ishikawa** y hacer clic en "Asistir con IA". El panel muestra "Diagrama de Ishikawa sugerido" con las 6 categorías, la causa probable y las acciones.
  2. "Usar" en el Ishikawa: las 6 categorías quedan completas en el formulario y el método **sigue siendo Ishikawa**.
  3. Editar una causa, guardar y recargar con F5. El Ishikawa se mantiene, y el audit trail muestra la consulta (`· ISHIKAWA`) y el cambio con "sugerencia IA editada".
  4. Cambiar a 5 Porqués y consultar otra vez: llegan 5 Porqués, como antes.
  5. Con IA real: verificar que las causas estén en español y que, si alguna categoría no aplica, se diga explícitamente en lugar de inventar una causa.
- Toño avisa con **"listo"** para que Cowork verifique.
