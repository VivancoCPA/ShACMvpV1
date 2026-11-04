## Context

El PRD §1.7 y QE-AC-005 piden un asistente de IA que sugiera la causa raíz probable, un borrador de los 5 Porqués y entre 2 y 3 acciones, a partir de datos operativos del QE y de QEs similares. Hoy:

- `QEInvestigationSection.tsx` tiene un botón "Asistir con IA" siempre deshabilitado (requirement placeholder en `quality-event-investigation`).
- `QualityEventAuditTrail.GeneradoPorIA` y la marca "Generado por IA" de `QEAuditTrail.tsx` ya existen.
- `qe-analisis-causa-raiz-fix` (implementado y sincronizado; falta archivarlo) dejó el análisis tipado (`cincoPorques: {pregunta, respuesta}[]`), los permisos de edición (JCA o responsable) y la aprobación con PIN (`aprobar-causa-raiz`).
- El backend (.NET 10, slices verticales, `ApiExceptionHandler` que mapea excepciones de dominio a códigos HTTP) no tiene ninguna integración externa de IA ni un endpoint de "funcionalidades".

Instrucción de origen: `INSTRUCCIONES — QE: asistente de IA para el análisis de causa raíz (PRD §1.7)`, del 2026-10-26.

## Goals / Non-Goals

**Goals**
- Sugerencia de IA bajo demanda que nunca se guarda sola, con un etiquetado visible y un audit trail que distingue lo que vino de la IA de lo que se editó a mano.
- Minimización de datos: solo se envían datos operativos.
- Degradación limpia: sin clave, el botón no se muestra; ante un error, el flujo manual sigue intacto.
- Tests sin llamadas a la API real.

**Non-Goals**
- La sugerencia de Ishikawa por IA (posible mejora futura; el PRD solo pide los 5 Porqués).
- La anonimización automática del texto libre.
- Un tablero de costos o de consumo.

## Decisions

### D1 — Salida estructurada con `output_config.format` en lugar de `tool_choice` forzado (divergencia)

La instrucción pide forzar la herramienta `registrar_sugerencia` con `tool_choice: { type: "tool" }`. Según la referencia vigente de la API (verificada el 2026-10-29), **Claude Sonnet 5.5 rechaza con un 400 el `tool_choice` `any`/`tool`**. La alternativa documentada para "quiero el JSON con esta forma" son las salidas estructuradas: `output_config: { format: { type: "json_schema", schema } }`. Garantizan una respuesta JSON que valida contra el esquema, sin herramientas.

- **Esquema:** el mismo de la instrucción (`causaRaizProbable`, `cincoPorques[{pregunta, respuesta}]`, `accionesSugeridas[{descripcion, tipo, rolResponsableSugerido, plazoDiasHabiles}]`), con `additionalProperties: false` y todos los campos `required`.
- **Validación en el servidor:** las restricciones numéricas (exactamente 5 porqués, 2 o 3 acciones, de 100 a 500 caracteres en la causa, de 50 a 500 en cada acción) se validan después de recibir la respuesta, porque el subconjunto de JSON Schema que aceptan las salidas estructuradas no garantiza `minItems`/`maxItems`/`minLength` arbitrarios. Si no se cumplen, se lanza `AsistenteIANoDisponibleException`. El system prompt también pide esas cantidades.
- **Alternativa descartada:** `tool_choice: auto` + `strict: true` + una instrucción en el prompt. Funciona, pero el modelo podría no llamar a la herramienta. Las salidas estructuradas son más directas.

### D2 — SDK oficial `Anthropic` (NuGet) con `HttpClient` inyectable

Se usa el SDK oficial de C# (`Anthropic`, versión estable más reciente al aplicar), no `HttpClient` a mano.

- **Cliente:** el SDK se construye con un `HttpClient` del `IHttpClientFactory` (cliente con nombre `Anthropic`), así los tests reemplazan el `HttpMessageHandler` primario por uno falso que captura el request y devuelve respuestas fijas. Ningún test llama a la API real.
- **Fallback:** si la versión del SDK no expone un `HttpClient` configurable, se cae a `HttpClient` tipado contra `POST /v1/messages`, con los headers de la instrucción. La decisión final queda registrada en este documento al aplicar (ver la sección de resolución, más abajo).
- **Timeout y reintentos:** `MaxRetries = 0` (los reintentos del SDK multiplicarían el tiempo de espera por 3) y timeout = `TimeoutSeconds`. Además, un `CancellationTokenSource` vinculado al `ct` del request corta a los `TimeoutSeconds` exactos.

### D3 — Modelo, esfuerzo y rechazos

- **Modelo:** el default es `claude-sonnet-5-5`, el identificador vigente de Sonnet según la referencia de la API al 2026-10-29. El PRD v1.0 nombra `claude-sonnet-4-6`, que está desactualizado. Es configurable en `Anthropic:Model`.
- **Esfuerzo:** `output_config.effort = "low"` y el thinking adaptativo por defecto (se omite el parámetro, que en Sonnet 5.5 no acepta `disabled`), para cumplir los < 15 s. `MaxTokens = 2000` (configurable). Si se llega al límite de tokens (`stop_reason = max_tokens`), se trata como no disponible.
- **Rechazos:** `stop_reason = "refusal"` se trata como `IA_NO_DISPONIBLE`. No se activa el fallback server-side (`fallbacks`), para no sumar una dependencia beta en un endpoint con un presupuesto de 15 s; un análisis de causa raíz operativo es un caso de rechazo muy improbable. Si al aplicar el SDK lo soporta de forma trivial, se puede reconsiderar.

### D4 — Prompt y minimización de datos (PRD §1.7)

- **System prompt** en español, fijo y sin datos variables (para el cache de prefijo, aunque con menos de 1K tokens no llegue a cachear). Dice que es un asistente de análisis de causa raíz para un operador logístico de minerales bajo ISO 9001 e ISO 45001, que responde siempre en español, que las acciones describen **la acción** y no el problema (PRD §2.2), y que no invente datos personales ni nombres de personas.
- **El user message** lleva un JSON con:
  - del QE: `tipo`, `severidad`, `origen`, el **nombre** del área (resuelto contra `Areas` de la misma empresa; si no se encuentra, se envía `null`, nunca el id), `mineralInvolucrado`, `descripcion` y `descripcionAmpliada`;
  - del incidente de origen (si `IncidenteId` existe y es de la misma empresa): `tipo`, `huboLesionados`, `numPersonasAfectadas`, `condicionesEntorno` y `equiposInvolucrados`. **Nunca** `personalInvolucrado` ni `testigos`;
  - QEs similares: hasta 5, de la misma `EmpresaId` y el mismo `AreaId`, con `Id != qe.Id`, `DeletedAt == null`, `CausaRaizFirmadaEn != null` y `CreadoEn >= now - 12 meses`, ordenados por `CreadoEn` descendente. De cada uno, solo `tipo`, `descripcion` (recortada a 300 caracteres) y `causaRaizDefinitiva`.
- Nunca se envían nombres, emails ni ids de usuarios. El contexto se arma en una clase `ContextoQE` (record) que **no tiene campos** para esos datos, así un test que serializa el request lo prueba.
- **Riesgo residual:** el texto libre (descripciones) puede contener nombres escritos por un usuario. Ver Riesgos.

### D5 — Endpoint `POST /api/quality-events/{id}/asistente-ia`

Las validaciones van en este orden (el rol se valida en el handler, igual que en `AprobarCausaRaizQE`, para que otra empresa dé 404 antes que 403):

1. QE inexistente o de otra empresa → 404.
2. Actor que no es JCA (rol del token) ni `ResponsableInvestigacionId` → 403.
3. Estado distinto de EN_INVESTIGACION/ANALISIS_COMPLETADO → 422 `ANALISIS_NO_EDITABLE`; causa raíz ya firmada → 422 `CAUSA_RAIZ_FIRMADA`.
4. Sin `ApiKey` → 503 `IA_NO_CONFIGURADA`.
5. Límite diario: se cuentan las entradas `ASISTENTE_IA_CONSULTADO` del QE cuyo `Timestamp` cae en el día calendario de hoy en `America/Lima`, convertido a un rango UTC (`[inicioDiaLima, inicioDiaLima+1d)`). Si `>= MaxLlamadasPorQEPorDia`, responde 429 `IA_LIMITE_DIARIO`.
6. Llamada al cliente. `AsistenteIANoDisponibleException` → 503 `IA_NO_DISPONIBLE`, con el mensaje "El asistente no está disponible en este momento. Puedes completar el análisis manualmente."
7. **Éxito:** se agrega `ASISTENTE_IA_CONSULTADO` al audit trail (`GeneradoPorIA = true`, actor, `ValorNuevo` = el modelo usado), se guarda y se responde 200 con `{ causaRaizProbable, cincoPorques, accionesSugeridas, modelo, generadoEn }`. **No se modifica ningún campo del QE.**

Las llamadas fallidas **no** cuentan para el límite, porque solo se registra la consulta exitosa: el audit trail refleja sugerencias que el usuario efectivamente recibió. La carrera entre contar e insertar con dos requests simultáneos puede permitir N+1 llamadas; se acepta (el límite es de costo, no de seguridad).

### D6 — Excepciones nuevas de dominio

- `ServiceUnavailableBusinessException(message, errorCode)` → 503.
- `TooManyRequestsBusinessException(message, errorCode)` → 429.

Las dos se mapean en `ApiExceptionHandler` con `ApiResponse.Fail(message, errorCode)`. `AsistenteIANoDisponibleException` es interna del feature (la lanza el cliente) y el handler la traduce a la de 503. El cliente registra el detalle técnico con `LogWarning`: tipo de error y status HTTP. **Nunca** registra la clave, los headers ni el contenido del prompt.

### D7 — `GET /api/config/funcionalidades`

Slice nuevo `Features/Config/Funcionalidades`, autenticado, que devuelve `ApiResponse.Ok(new { asistenteIA = !string.IsNullOrWhiteSpace(options.ApiKey) })`. Se eligió un endpoint propio porque no existe uno de configuración general que se pueda reutilizar. No requiere empresa activa: es configuración del servidor, no de la empresa.

### D8 — `origenIA` en el PATCH genérico (extiende `ActualizarQualityEvent`)

El command recibe `OrigenIA? OrigenIA` con `CausaRaiz` y `CincoPorques` (`"IA"` o `"IA_EDITADO"`, validados por FluentValidation; otro valor da 400). En `TrackChange` de `causaRaizDefinitiva`/`cincoPorques`:

- con `IA`: `GeneradoPorIA = true`;
- con `IA_EDITADO`: `GeneradoPorIA = false` y `ValorNuevo += " (sugerencia IA editada)"`.

`origenIA` sin el campo correspondiente en el body se ignora.

**RNG-004:** guardar sigue requiriendo el permiso normal (JCA o responsable). La validación formal la da la **aprobación con PIN del JCA** (`aprobar-causa-raiz`): ninguna sugerencia de IA llega a `causaRaizDefinitiva` *firmada* sin la firma del JCA, y el audit trail conserva tanto el origen IA como la firma humana.

### D9 — Frontend

- **Disponibilidad:** `useFuncionalidades()` es un `useQuery(['config', 'funcionalidades'])` con `staleTime: Infinity`. Si falla, se trata como `asistenteIA = false` (el botón no aparece).
- **Botón:** visible solo si `asistenteIA && isCausaRaizEditable` (los mismos permisos que el servidor: JCA o responsable, estado editable, sin firma). Mientras `useAsistenteIA().isPending`, muestra un spinner con "Analizando…".
- **Panel:** `QEAISuggestionPanel` dentro de la sección, con la etiqueta visible, el ícono `Sparkles` y un fondo `bg-surface-cream dark:bg-surface-dark-soft` con borde `border-amber`. Tiene tres bloques, cada uno descartable por separado, y el estado de la sugerencia vive en `useState` de la sección (no se persiste).
- **"Usar" en la causa raíz:** hace `setValue('causaRaizDefinitiva', sugerida, { shouldDirty: true })`.
- **"Usar" en los 5 Porqués:**
  - si el método activo es ISHIKAWA, se cambia a `5_PORQUES`;
  - si hay alguna respuesta no vacía (o hay datos de Ishikawa), se pide confirmación con un toast de acción, el mismo patrón que `handleToolSwitch` (nunca `confirm()`);
  - luego se copian las 5 filas con `pregunta` + `respuesta`.
  
  Las preguntas sugeridas se muestran como texto de ayuda bajo el label de cada fila, porque hoy solo `respuesta` es editable.
- **Marcas "IA" / "IA (editado)":** se derivan con `useMemo`/render y sin `useEffect`, comparando `watch()` con el valor sugerido que se aplicó, guardado en un estado `aplicado: { causaRaiz?: string; cincoPorques?: CincoPorques[] }`. Igual a lo aplicado → `IA`; distinto → `IA_EDITADO`. Al guardar, `origenIA` se arma con esa misma función y solo incluye los campos aplicados.
- **"Crear AC":** solo se muestra a quien puede crear AC (hoy, el JCA en EN_INVESTIGACION, ANALISIS_COMPLETADO o EN_EJECUCION, la misma regla de `QEACSection`). Abre `AgregarQEACModal`, exportado desde `QEACSection.tsx` con la prop nueva `defaultValues`, precargado con `descripcion`. El rol y los días sugeridos se muestran como ayuda encima del formulario, junto con el tipo sugerido (ver D10). Usa `useCreateQEAccion(qe.id)` y al guardar se invalida lo mismo que hoy.
- **Errores:** `IA_NO_DISPONIBLE`/`IA_NO_CONFIGURADA` muestran un toast con el mensaje del servidor; `IA_LIMITE_DIARIO` muestra un toast con `t('errors.IA_LIMITE_DIARIO')`. En ningún caso se toca el formulario.

### D10 — `tipo` de acción sin campo en la AC (divergencia)

La instrucción pide precargar la AC "con la descripción y el tipo", pero `AccionCorrectivaQE` y `createQEAccionSchema` **no tienen un campo `tipo`** (CORRECTIVA/PREVENTIVA/MEJORA), solo `titulo`, `descripcion`, `responsableId`, `prioridad` y `plazoFecha`. Agregarlo implicaría una migración y un cambio de contrato fuera del alcance. Por eso se precarga `descripcion`, y el `tipo` sugerido se muestra como ayuda junto con el rol y el plazo. `titulo` queda vacío, para que lo defina el usuario.

### D11 — Documentación y secretos

- El `.csproj` no tenía `UserSecretsId`, y sin él `dotnet user-secrets set` falla. Se agrega con `dotnet user-secrets init` (el valor es un GUID, no un secreto).
- No existía un `README.md` del backend: se crea `ShcMvpEndPoint/README.md` con la sección "Asistente IA" (cómo configurar la clave en desarrollo y en producción, y qué pasa si falta).
- `appsettings.Development.json.example` recibe la sección `Anthropic` con `ApiKey` vacía.
- Antes de cerrar, se verifica con grep que ningún `appsettings*.json` contenga `sk-ant`.

### D12 — Proveedor simulado (actualización del 2026-10-30)

A pedido de Toño, para la etapa de pruebas, `Anthropic:Proveedor` admite `"Anthropic"` (default, API real, necesita `ApiKey`) y `"Simulado"` (sin red, sin clave, sin costo). `appsettings.json` deja `"Anthropic"`; `appsettings.Development.json.example` sugiere `"Simulado"`.

- **`AsistenteCausaRaizSimulado`** implementa `IAsistenteCausaRaizClient`: espera 800 ms (`Task.Delay`, para que se vea el spinner) y devuelve una sugerencia fija en español que cumple el mismo esquema que la real (causa de 100–500 caracteres que menciona `tipo` y el nombre del área del contexto, 5 porqués, 3 acciones —CORRECTIVA, PREVENTIVA, MEJORA— de 50–500 caracteres). `modelo = "simulado"`, que el handler guarda tal cual en `ValorNuevo` de `ASISTENTE_IA_CONSULTADO`: nunca se confunde con una sugerencia real.
- **Camino de error:** si `descripcion` o `descripcionAmpliada` contiene `[simular-error-ia]`, lanza `AsistenteIANoDisponibleException` → 503 `IA_NO_DISPONIBLE`, igual que una falla real. Se miran las dos descripciones porque `descripcion` no es editable fuera de ABIERTO (RN-QE-006) y `descripcionAmpliada` sí.
- **Selección en DI por request:** se registran ambos clientes y `IAsistenteCausaRaizClient` se resuelve con una factory que lee `IOptions<AnthropicOptions>.Value.EsSimulado`. No se decide leyendo `builder.Configuration` en `Program.cs`, porque los overrides de `WebApplicationFactory.ConfigureAppConfiguration` de los tests no son visibles en ese punto; así los tests pueden levantar un host simulado y otro real sobre la misma base.
- **`EstaConfigurado`** pasa a ser `EsSimulado || ApiKey no vacía`; lo usan tanto `funcionalidades.asistenteIA` como el 503 `IA_NO_CONFIGURADA`, que ya no aplica en modo simulado.
- **`funcionalidades`** agrega `asistenteIASimulado` (= `EsSimulado`). El frontend agrega el sufijo `detail.investigation.ia.simulado` a la etiqueta del panel. MSW devuelve `asistenteIASimulado: false` (se presenta como proveedor real: el mock ya es una sugerencia fija).
- **Producción:** con `Production` y `Simulado` se registra un warning al arrancar; no se bloquea.
- **Comparación de `Proveedor`:** sin distinguir mayúsculas; cualquier valor distinto de `Simulado` se trata como `Anthropic`.
- **Modelo para pruebas reales:** el README sugiere `claude-haiku-5-5` en desarrollo (el más barato), con referencia a la página de precios para confirmar el identificador. El default de `appsettings.json` sigue siendo `claude-sonnet-5-5`.
- **Tests:** el host derivado simulado comparte el `FakeAnthropicHandler`, configurado para lanzar si se invoca; el test verifica además que no capturó ningún request. Todos los hosts derivados fijan `Anthropic:Proveedor` explícitamente, porque el `appsettings.Development.json` local (no versionado) puede traer `Simulado`.

## Risks / Trade-offs

- **Texto libre con nombres** → la descripción y la descripción ampliada podrían incluir nombres escritos por un usuario, y se envían tal cual. **Riesgo conocido y aceptado** en este change; mitigación futura: anonimización automática, fuera de alcance.
- **Costo por llamada** → límite de `MaxLlamadasPorQEPorDia` por QE y día; las llamadas fallidas no se cuentan.
- **Latencia > 15 s** → effort `low`, un timeout duro y sin reintentos. Si se supera, se responde 503 y el usuario sigue a mano.
- **Restricciones del esquema no garantizadas por la API** → validación en el servidor (D1), que convierte la falla en 503.
- **Carrera en el límite diario** → se pueden colar N+1 llamadas con requests simultáneos; se acepta.
- **Cambio del identificador del modelo** → configurable sin recompilar.
- **`Simulado` olvidado en producción** → warning al arrancar, la etiqueta "(modo simulado…)" en el panel y `modelo = "simulado"` en el audit trail hacen visible el error.

## Migration Plan

- **Sin migración de base de datos.**
- **Despliegue:** configurar `Anthropic__ApiKey` en el entorno. Sin la clave, la funcionalidad queda oculta.
- **Rollback:** quitar la clave (oculta el botón) o revertir el change. Las entradas `ASISTENTE_IA_CONSULTADO` del audit trail quedan como histórico.

## Open Questions

Ninguna bloqueante.

## Resolución al aplicar

- **SDK:** se usa `Anthropic` 13.3.0 (NuGet). `AnthropicClient` acepta `HttpClient`, `MaxRetries` y `Timeout`, así que no fue necesario el fallback a `HttpClient` tipado. En esta versión los mensajes se construyen como `new UserMessageParam { Content = ... }`, no con `new() { Role = ... }`, y `StopReason` se lee con `.Raw()`.
- **Escapado del contexto:** el JSON del contexto se serializa con `JavaScriptEncoder.UnsafeRelaxedJsonEscaping`. Sin esto, los acentos llegaban al modelo como `é` dentro del texto del mensaje (lo detectó el test de minimización de datos).
- **Audit trail en el frontend:** `QEAuditTrail` solo mostraba el nombre del campo en `CAMPO_EDITADO`, así que el sufijo "(sugerencia IA editada)" no se veía. Se agregó la marca `detail.auditTrail.sugerenciaIAEditada` cuando `valorNuevo` termina con ese sufijo. Además, la clave real de la acción es `detail.auditTrail.acciones.*`, no `auditTrail.acciones.*`; la spec delta se corrigió.
- **MSW PATCH:** el handler genérico no registraba audit trail de `CAMPO_EDITADO`. Ahora lo registra solo para `causaRaizDefinitiva` y `cincoPorques` (los campos que pueden venir de la IA), con `generadoPorIA` o el sufijo según `origenIA`.
- **Constante compartida:** `AC_CREATE_VISIBLE_STATES` se movió a `constants/accionCorrectivaQE.constants.ts` (la regla `react-refresh/only-export-components` impide exportarla desde `QEACSection.tsx`).
- **Tests del backend:** los hosts derivados (`WithWebHostBuilder`, con clave de prueba y `FakeAnthropicHandler`) se cachean y se arrancan antes de cualquier login, sin hosted services y con los logs de EF en Warning. Arrancar uno por test superaba los 5 minutos de vida del access token, y los tests fallaban con 401.
- **Modo simulado (2026-10-30):** ver D12. El header de autenticación sigue siendo el que pone el SDK (la instrucción menciona `Authorization: Bearer`; con el SDK oficial no se arma a mano, D2).
- **Lint/tsc preexistentes:** `tsc --noEmit` y `npm run lint` reportan errores que ya existían en el árbol de trabajo, fuera de este change (fixtures/handlers de `documents`, `NormativaVinculadaCombobox`, `QEHeaderSection`, `qualityEventPermissions`, tests de `QECierreSection`/`QEHeaderSection`/`QualityEventForm`). Los archivos de este change no agregan errores.
