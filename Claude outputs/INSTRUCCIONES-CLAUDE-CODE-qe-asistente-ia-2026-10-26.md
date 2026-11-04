# INSTRUCCIONES PARA CLAUDE CODE — QE: asistente de IA para el análisis de causa raíz (PRD §1.7)

- **Fecha:** 2026-10-26
- **Autor:** Cowork (para Toño)
- **Origen:** Toño reportó que el asistente de IA del QE no está activado. En el código, el botón "Asistir con IA" está deshabilitado a propósito (tooltip "Próximamente disponible") y no existe ninguna integración en el backend.
- **Change OpenSpec:** `qe-asistente-ia`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** se aplica **después** de `qe-analisis-causa-raiz-fix`, porque necesita que el análisis se guarde como listas tipadas.
- **Requisitos externos, a cargo de Toño:**
  - una **API key de Anthropic**;
  - salida HTTPS desde el servidor hacia `api.anthropic.com`;
  - el uso tiene costo por cada llamada.

---

## 1. Diagnóstico confirmado leyendo el código

- `shc-controldoc/src/features/quality-events/components/QEInvestigationSection.tsx` (alrededor de las líneas 233–241): el botón "Asistir con IA" está siempre `disabled`, con el tooltip `detail.investigation.asistirIATooltip` = "Próximamente disponible".
- En el backend no hay ninguna referencia a Anthropic ni a Claude, ni endpoint, ni configuración.
- `QualityEventAuditTrail.GeneradoPorIA` ya existe, y `QEAuditTrail.tsx` ya muestra la marca "Generado por IA".
- El PRD §1.7 y QE-AC-005 piden lo siguiente:
  - **Entrada:** descripción, área, tipo, mineral y QEs similares de los últimos 12 meses del mismo proceso. **Sin datos personales.**
  - **Salida:**
    - (a) la causa raíz probable;
    - (b) un borrador de los 5 Porqués;
    - (c) 2 o 3 acciones correctivas sugeridas, con responsable y plazo estimados.
  - **Etiqueta visible:** "Sugerencia generada por IA — requiere validación". El investigador revisa cada campo antes de guardar.
  - **Audit trail:** debe distinguir lo generado por IA de lo editado a mano.
  - **Fallback:** si la IA no está disponible, se trabaja a mano y el flujo no se bloquea.
  - **Respuesta** en español, en menos de **15 segundos**.
  - **RNG-004:** lo generado por la IA no se guarda sin que lo revise y confirme alguien con rol de Jefe de Calidad o superior.

---

## 2. Decisión de Toño

- **D3:** implementarlo ahora.
  - El backend llama a la API de Claude, con la clave en `user-secrets` (desarrollo) o en variables de entorno.
  - Solo se envían datos operativos, sin nombres.
  - La salida se presenta marcada como "Sugerencia IA" y es editable.
  - **Si no hay clave configurada, el botón se oculta** y el flujo manual sigue igual.

---

## 3. Qué implementar

### 3.1 Configuración (`ShcMvpEndPoint/`)

- Agregar una sección `Anthropic` en `appsettings.json`, **sin la clave**:
  ```json
  "Anthropic": {
    "ApiKey": "",
    "Model": "claude-sonnet-5-5",
    "MaxTokens": 2000,
    "TimeoutSeconds": 15,
    "MaxLlamadasPorQEPorDia": 10
  }
  ```
- La clave **nunca** va en el repositorio. En desarrollo se guarda con `dotnet user-secrets set "Anthropic:ApiKey" "<clave>"`; en producción, con la variable `Anthropic__ApiKey`. Documentarlo en el README del backend y en `appsettings.Development.json.example`, sin el valor.
- El modelo es configurable. El PRD v1.0 nombra `claude-sonnet-4-6`, que ya está desactualizado; se usa el valor de la configuración. **Antes de fijar el default, confirmar el identificador vigente en https://docs.claude.com.** Si el default cambia, anotarlo en `design.md`.
- Crear una clase de opciones `AnthropicOptions`, con `IOptions<>`, y validarla al arrancar: si falta la clave, no se lanza ningún error; la funcionalidad simplemente queda desactivada.

### 3.2 Cliente de IA (`Features/QualityEvents/AsistenteIA/` o `Shared/IA/`)

- `IAsistenteCausaRaizClient` con `Task<SugerenciaCausaRaiz> SugerirAsync(ContextoQE ctx, CancellationToken ct)`.
- **Implementación** con `HttpClient` tipado (`AddHttpClient`) contra `POST https://api.anthropic.com/v1/messages`:
  - headers `Authorization: Bearer <clave>` (el header recomendado hoy en https://platform.claude.com/docs/en/manage-claude/authentication; `x-api-key` es el header legado), `anthropic-version: 2023-06-01` y `content-type: application/json`. Mandar solo uno de los dos headers de autenticación;
  - timeout igual a `TimeoutSeconds`.
  - Se puede usar el SDK oficial de .NET si existe y está estable; dejar la elección en `design.md`.
- **Salida estructurada:** definir una herramienta (`tools`) llamada `registrar_sugerencia`, con un `input_schema` JSON que tenga:
  - `causaRaizProbable`: string de 100 a 500 caracteres;
  - `cincoPorques`: exactamente 5 objetos `{ pregunta, respuesta }`;
  - `accionesSugeridas`: de 2 a 3 objetos `{ descripcion` (50 a 500 caracteres), `tipo` (CORRECTIVA, PREVENTIVA o MEJORA), `rolResponsableSugerido` (texto, por ejemplo "Supervisor de área"), `plazoDiasHabiles` (número) `}`.
  
  Forzarla con `tool_choice: { type: "tool", name: "registrar_sugerencia" }` y leer el bloque `tool_use` de la respuesta.
- **System prompt**, en español. Debe indicar:
  - que el modelo es un asistente de análisis de causa raíz para un operador logístico de minerales, bajo ISO 9001 e ISO 45001;
  - que responda **siempre en español**;
  - que las acciones describan **la acción**, no el problema (PRD §2.2);
  - que **no** invente datos personales ni nombres de personas.
- **Errores:**
  - timeout, 5xx, 429 o una respuesta que no cumple el esquema se convierten en `AsistenteIANoDisponibleException`;
  - el endpoint la traduce en **503** con el código `IA_NO_DISPONIBLE` y el mensaje "El asistente no está disponible en este momento. Puedes completar el análisis manualmente.";
  - el detalle técnico va al log, **sin** la clave y sin el contenido completo del prompt.

### 3.3 Endpoint `POST /api/quality-events/{id}/asistente-ia` (slice `AsistirCausaRaizIA`)

**Validaciones**
- Un QE de otra empresa responde 404.
- Permiso: JCA **o** el responsable asignado (los mismos que editan el análisis según `qe-analisis-causa-raiz-fix`); cualquier otro, 403.
- Estado: EN_INVESTIGACION o ANALISIS_COMPLETADO, y sin causa raíz firmada. Si no se cumple, 422.
- Sin `ApiKey` configurada: 503 `IA_NO_CONFIGURADA`. No debería pasar, porque el frontend oculta el botón.
- **Límite de uso:** como máximo `MaxLlamadasPorQEPorDia` llamadas por QE y día calendario de Lima. Se cuentan con las entradas de audit trail `ASISTENTE_IA_CONSULTADO`. Al superarlo, 429 `IA_LIMITE_DIARIO`.

**Contexto que se envía (minimización de datos, PRD §1.7)**
- Del QE: `tipo`, `severidad`, `origen`, el **nombre** del área (no el id), `mineralInvolucrado`, `descripcion` y `descripcionAmpliada`.
- Si viene de un incidente: `tipo` del incidente, `huboLesionados`, `numPersonasAfectadas`, `condicionesEntorno` y `equiposInvolucrados`.
- **No se envían** `personalInvolucrado` ni `testigos`, porque son nombres.
- **QEs similares:** hasta 5 QEs de la **misma empresa** y la **misma área**, de los últimos 12 meses, con `causaRaizDefinitiva` aprobada. De cada uno, solo `tipo`, `descripcion` (recortada a 300 caracteres) y `causaRaizDefinitiva`.
- **Nunca** se envían nombres, emails ni ids de usuarios.
- **Riesgo residual:** los campos de texto libre (las descripciones) podrían contener nombres que escribió un usuario. Anotarlo en `design.md` como riesgo conocido. No se implementa anonimización automática en este change.

**Efecto**
- Llama al cliente y devuelve 200 con `{ causaRaizProbable, cincoPorques, accionesSugeridas, modelo, generadoEn }`.
- **No guarda nada en el QE.** La sugerencia viaja al frontend, donde el usuario la revisa.
- Registra en el audit trail `ASISTENTE_IA_CONSULTADO` con `GeneradoPorIA = true`, el actor y `ValorNuevo` = el modelo usado.

### 3.4 Guardado con trazabilidad de IA (extiende `ActualizarQualityEvent`)

- Agregar al command un campo opcional `OrigenIA: { causaRaiz?: "IA" | "IA_EDITADO", cincoPorques?: "IA" | "IA_EDITADO" }`. Lo envía el frontend cuando el valor que se guarda vino de una sugerencia.
- Al registrar en el audit trail el cambio de esos campos, poner `GeneradoPorIA = true` si el origen es `IA`. Si es `IA_EDITADO`, dejar `GeneradoPorIA = false` y agregar al final de `ValorNuevo` " (sugerencia IA editada)".
- **RNG-004:** guardar sigue requiriendo el permiso normal de edición (JCA o responsable). La validación formal la da la **aprobación con PIN del JCA** (`aprobar-causa-raiz`), así que ninguna sugerencia de IA llega a ser causa raíz definitiva sin la firma del JCA. Documentarlo así en `design.md`.

### 3.5 Frontend (`shc-controldoc/src/features/quality-events/`)

**Disponibilidad**
- Nuevo endpoint `GET /api/config/funcionalidades` (o agregar el dato a uno de configuración que ya exista) que devuelva `{ asistenteIA: boolean }` según haya o no `ApiKey`. Hook `useFuncionalidades`.
- Si `asistenteIA` es false: el botón **no se muestra**.
- Si es true: el botón está activo para quien puede editar el análisis.

**Botón "Asistir con IA"** (`QEInvestigationSection.tsx`)
- Llama a `useAsistenteIA(qeId)` (mutación).
- Mientras espera, muestra un spinner con "Analizando…". Si pasan 15 segundos, el servidor ya responde 503.
- Si hay errores:
  - `IA_NO_DISPONIBLE`: toast con el mensaje del servidor; el formulario no se toca.
  - `IA_LIMITE_DIARIO`: toast "Se alcanzó el límite diario de consultas a la IA para este QE."

**Presentación de la sugerencia**
- Se muestra en un **panel de sugerencias** dentro de la sección, que no pisa directamente el formulario. El panel lleva la etiqueta visible **"Sugerencia generada por IA — requiere validación"**, con el ícono `Sparkles` y un fondo diferenciado.
- Para cada bloque, el usuario elige qué hacer:
  - **Causa raíz probable:** "Usar" (la copia al campo de causa raíz) o "Descartar".
  - **5 Porqués:** "Usar" (cambia el método a 5_PORQUES y copia las 5 filas; si había datos, pide confirmación antes de reemplazarlos) o "Descartar".
  - **Acciones sugeridas:** cada una tiene "Crear AC", que abre el formulario de alta de AC del QE (el de `QEACSection`) **precargado** con la descripción y el tipo. El usuario elige al responsable real y la fecha; el rol y los días sugeridos se muestran como ayuda.
- Los campos que vienen de la IA muestran una marca "IA" junto al label. Si el usuario los edita, la marca cambia a "IA (editado)". Ese estado se calcula comparando con el valor sugerido y se envía como `origenIA` al guardar (§3.4).
- **No se guarda nada automáticamente.** El usuario siempre presiona "Guardar análisis".

**i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.investigation.ia.etiqueta` | Sugerencia generada por IA — requiere validación | AI-generated suggestion — requires validation |
| `detail.investigation.ia.analizando` | Analizando… | Analyzing… |
| `detail.investigation.ia.usar` | Usar | Use |
| `detail.investigation.ia.descartar` | Descartar | Discard |
| `detail.investigation.ia.crearAC` | Crear AC | Create CA |
| `detail.investigation.ia.marca` | IA | AI |
| `detail.investigation.ia.marcaEditada` | IA (editado) | AI (edited) |
| `detail.investigation.ia.confirmarReemplazo` | ¿Reemplazar los 5 Porqués actuales por la sugerencia? | Replace the current 5 Whys with the suggestion? |
| `errors.IA_LIMITE_DIARIO` | Se alcanzó el límite diario de consultas a la IA para este QE. | The daily AI query limit for this QE was reached. |

- Eliminar el tooltip "Próximamente disponible".
- Agregar las etiquetas del audit trail `ASISTENTE_IA_CONSULTADO` ("Consulta al asistente IA").

### 3.6 MSW

- `GET /api/config/funcionalidades` devuelve `{ asistenteIA: true }`.
- `POST /api/quality-events/:id/asistente-ia` devuelve una sugerencia fija de ejemplo después de un `delay(800)`.
- Agregar un toggle en los fixtures para probar el 503.

---

## 4. Tests

**Backend**, con `HttpMessageHandler` falso. **Ningún test llama a la API real.**
- Respuesta válida con `tool_use`: 200 con los tres bloques, y el audit trail registra `ASISTENTE_IA_CONSULTADO` con `GeneradoPorIA = true`.
- El contexto enviado (capturando el request) **no** contiene `personalInvolucrado`, `testigos`, nombres, emails ni ids de usuarios, y sí contiene el nombre del área y hasta 5 QEs similares **de la misma empresa**.
- Timeout, 500, 429 o un esquema inválido: 503 `IA_NO_DISPONIBLE`, y el log no contiene la clave.
- Sin `ApiKey`: 503 `IA_NO_CONFIGURADA`, y `funcionalidades.asistenteIA` es false.
- Permisos: el JCA y el responsable pueden; otro SUPERVISOR recibe 403; con la causa raíz firmada, 422; otra empresa, 404.
- Límite diario: la llamada N+1 del mismo día recibe 429.
- Guardar con `origenIA.causaRaiz = "IA"` deja el audit con `GeneradoPorIA = true`; con `"IA_EDITADO"`, el audit lleva el sufijo "(sugerencia IA editada)".

**Frontend**
- Con `asistenteIA = false`, el botón no aparece.
- Al hacer clic, se ve el spinner y luego el panel con la etiqueta. "Usar" en la causa raíz la copia y la marca como "IA"; si después se edita, pasa a "IA (editado)".
- "Usar" en los 5 Porqués con datos previos pide confirmación.
- "Crear AC" abre el formulario precargado.
- Un 503 muestra el toast y el formulario queda intacto.

---

## 5. Fuera de alcance

- La sugerencia de **Ishikawa** por IA: el PRD solo pide los 5 Porqués. Anotarlo en `design.md` como posible mejora.
- La anonimización automática de texto libre.
- Un tablero de costos o de consumo de la IA.

---

## 6. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- **Nunca** commitear la clave. Verificar que `appsettings*.json` no la contenga.
- Antes de la prueba manual:
  1. Configurar la clave: `dotnet user-secrets set "Anthropic:ApiKey" "<clave>"`, en la carpeta del proyecto del backend.
  2. **Detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5.
  3. Si el endpoint nuevo devuelve 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. **Sin clave:** el botón "Asistir con IA" no aparece y el análisis manual funciona igual.
  2. **Con clave:** en un QE en EN_INVESTIGACION, hacer clic en "Asistir con IA". En menos de 15 segundos aparece el panel con la etiqueta, la causa probable, los 5 Porqués y 2 o 3 acciones, todo en español.
  3. "Usar" en la causa raíz y en los 5 Porqués, editar una respuesta y guardar. El audit trail muestra la consulta a la IA, y luego los cambios con la marca IA o "sugerencia IA editada".
  4. "Crear AC" en una acción sugerida: el formulario de AC aparece precargado. Elegir al responsable real y guardar.
  5. Aprobar la causa raíz con PIN (del change anterior): la firma es del JCA.
  6. Desconectar la red o poner una clave inválida: aparece el toast "El asistente no está disponible…" y el formulario no cambia.
- Toño avisa con **"listo"** para que Cowork verifique.
