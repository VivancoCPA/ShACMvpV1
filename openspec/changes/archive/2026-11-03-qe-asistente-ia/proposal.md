## Why

El asistente de IA para el análisis de causa raíz que piden el PRD §1.7 y QE-AC-005 nunca se construyó. Hoy `QEInvestigationSection` muestra el botón "Asistir con IA" siempre deshabilitado, con el tooltip "Próximamente disponible", y el backend no tiene ninguna integración con Claude. Toño decidió implementarlo ahora (D3) sobre el análisis ya tipado de `qe-analisis-causa-raiz-fix`, del que depende este change.

## What Changes

- **Configuración:** sección `Anthropic` en `appsettings.json` (`ApiKey` vacía, `Model`, `MaxTokens`, `TimeoutSeconds`, `MaxLlamadasPorQEPorDia`), validada al arrancar con `AnthropicOptions`. La clave nunca va al repositorio: en desarrollo va en `user-secrets` y en producción en `Anthropic__ApiKey`. Si falta, la funcionalidad queda desactivada y la app no falla.
- **Cliente de IA:** `IAsistenteCausaRaizClient`, que llama a la API de Claude (Messages) y obtiene una salida estructurada con la causa raíz probable, los 5 Porqués y 2 o 3 acciones sugeridas. Un timeout, un 5xx, un 429, un rechazo o una respuesta que no cumple el esquema se convierten en `AsistenteIANoDisponibleException`. El log nunca incluye la clave ni el prompt completo.
- **Endpoint nuevo `POST /api/quality-events/{id}/asistente-ia`:**
  - responde 404 si el QE es de otra empresa;
  - 403 si el actor no es el JCA ni el responsable asignado;
  - 422 si el estado no es EN_INVESTIGACION o ANALISIS_COMPLETADO, o si la causa raíz ya está firmada;
  - 503 `IA_NO_CONFIGURADA` o `IA_NO_DISPONIBLE`;
  - 429 `IA_LIMITE_DIARIO` cuando se supera el máximo de consultas por QE y día (hora de Lima).
  
  Solo envía datos operativos: nunca `personalInvolucrado`, `testigos`, nombres, emails ni ids de usuarios. Incluye hasta 5 QEs similares de la misma empresa y la misma área de los últimos 12 meses. No guarda nada en el QE; registra `ASISTENTE_IA_CONSULTADO` en el audit trail, con `GeneradoPorIA = true`.
- **Endpoint nuevo `GET /api/config/funcionalidades`:** devuelve `{ asistenteIA, asistenteIASimulado }` según haya clave configurada o modo simulado.
- **Modo simulado (actualización del 2026-10-30):** `Anthropic:Proveedor = "Simulado"` reemplaza el cliente real por `AsistenteCausaRaizSimulado`, que no llama a ninguna API, no necesita clave ni tiene costo, y devuelve una sugerencia fija con el mismo esquema (`modelo = "simulado"`). `[simular-error-ia]` en la descripción fuerza el 503. El panel del frontend agrega "(modo simulado — no es una sugerencia real)". En producción con `Simulado` solo se registra un warning.
- **PATCH genérico:** acepta un `origenIA` opcional (`causaRaiz` / `cincoPorques`: `IA` o `IA_EDITADO`). Con `IA`, el audit trail registra `GeneradoPorIA = true`. Con `IA_EDITADO`, el audit trail agrega el sufijo " (sugerencia IA editada)". RNG-004 se cumple porque ninguna sugerencia se vuelve causa raíz definitiva sin la aprobación con PIN del JCA.
- **Frontend:**
  - el botón "Asistir con IA" queda activo, u oculto si la funcionalidad está desactivada;
  - muestra el spinner "Analizando…" mientras espera;
  - la sugerencia aparece en un panel con la etiqueta "Sugerencia generada por IA — requiere validación";
  - cada bloque tiene "Usar"/"Descartar", con confirmación antes de reemplazar unos 5 Porqués que ya tienen datos;
  - "Crear AC" abre el formulario de alta de AC precargado;
  - los campos que vienen de la IA muestran la marca "IA" o "IA (editado)";
  - nunca se guarda nada automáticamente;
  - se elimina el tooltip "Próximamente disponible".
- **MSW:** los handlers de `funcionalidades` y `asistente-ia` (sugerencia fija con `delay(800)`) y un toggle en los fixtures para simular el 503.

## Capabilities

### New Capabilities

- `be-asistente-ia`: configuración `Anthropic`, cliente de IA con salida estructurada y manejo de errores, endpoint `asistente-ia` (permisos, estado, minimización de datos, QEs similares, límite diario, audit trail) y endpoint `config/funcionalidades`.
- `quality-event-asistente-ia`: hooks `useFuncionalidades`/`useAsistenteIA`, el panel de sugerencias en `QEInvestigationSection` (Usar/Descartar/Crear AC), las marcas IA / IA (editado) y el envío de `origenIA` al guardar.

### Modified Capabilities

- `be-quality-events-api`: el PATCH genérico acepta `origenIA` y marca el audit trail según el origen.
- `quality-event-investigation`: se elimina el requirement del botón placeholder "Asistir con IA"; el envío de "Guardar investigación" incluye `origenIA`.
- `quality-event-api`: funciones `getFuncionalidades()` y `asistirCausaRaizIA(id)`, y `origenIA` en `QualityEventUpdateInput`.
- `quality-event-msw-handlers`: handlers de `funcionalidades` y `asistente-ia`, con el toggle de error.
- `quality-event-audit-trail`: etiqueta de la acción `ASISTENTE_IA_CONSULTADO`.

## Impact

- **Backend (`ShcMvpEndPoint/`):**
  - paquete NuGet `Anthropic` (SDK oficial);
  - `UserSecretsId` en el `.csproj`;
  - `AnthropicOptions` y el cliente en `Features/QualityEvents/AsistenteIA/`;
  - slices nuevos `AsistirCausaRaizIA` y `Features/Config/Funcionalidades`;
  - excepciones nuevas para 503 y 429 en `ApiExceptionHandler`;
  - `ActualizarQualityEvent` (command y handler);
  - registro en `EndpointExtensions`/`Program.cs`;
  - `appsettings.json`, `appsettings.Development.json.example` y un `README.md` del backend nuevo;
  - tests de integración con un `HttpMessageHandler` falso.
- **Frontend (`shc-controldoc/src/`):**
  - `QEInvestigationSection.tsx` (+ test);
  - export reutilizable de `AgregarQEACModal` (en `QEACSection.tsx`) con valores precargados;
  - `quality-events.api.ts`, `qualityEvent.types.ts`, hooks nuevos `useFuncionalidades`/`useAsistenteIA`;
  - i18n es-PE/en-US (`qualityEvents`);
  - `QEAuditTrail`.
- **MSW:** `quality-events.handlers.ts` (o un handler de config nuevo) y fixtures.
- **Externo:** API key de Anthropic, salida HTTPS a `api.anthropic.com` y costo por llamada. Ningún test llama a la API real.
- **Sin migración.**
