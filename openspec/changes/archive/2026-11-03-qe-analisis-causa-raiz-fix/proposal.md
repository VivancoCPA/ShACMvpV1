## Why

Cuando se edita un QE para cargar el análisis, ni los 5 Porqués ni el diagrama de Ishikawa se guardan. El frontend envía `cincoPorques`/`ishikawa` como listas, pero `ActualizarQualityEventCommand` los declara como `string?`. System.Text.Json no puede convertir el array en un string, así que el binding responde **400** y se rechaza toda la petición, incluida la `causaRaizDefinitiva` que va en la misma llamada. Además, la firma de la causa raíz (RN-QE-002) no prueba nada: `QEInvestigationSection` ignora el PIN y manda en el PATCH genérico `causaRaizFirmadaEn` (la hora del cliente) y `causaRaizAprobadaPorId`, y el backend los acepta sin verificar el PIN, el rol ni la identidad. Y aunque el PRD §1.3 (estado 3) asigna el análisis al responsable investigador, hoy solo el JCA puede editarlo.

## What Changes

- **Análisis tipado (D1):** `PATCH /api/quality-events/{id}` recibe y devuelve `cincoPorques: { pregunta, respuesta }[]` e `ishikawa: { categoria, causa }[]`. Se guardan como JSON en las columnas `text` que ya existen (`cinco_porques`, `ishikawa`), **sin migración**. El backend valida la estructura (5 porqués; 6 categorías sin repetir; máximo 2.000 caracteres por texto; `metodoAnalisis` ∈ {`5_PORQUES`, `ISHIKAWA`}) y limpia la lista de la herramienta que no está activa. Si una columna tiene texto viejo que no es JSON, la lectura devuelve `null` y registra un warning, nunca un 500.
- **Permiso de edición del análisis:** `metodoAnalisis`, `cincoPorques`, `ishikawa` y `causaRaizDefinitiva` solo se pueden editar en EN_INVESTIGACION o ANALISIS_COMPLETADO, y solo los edita el JCA o el `responsableInvestigacionId` del QE. Otro actor recibe 403; otro estado, 422 `ANALISIS_NO_EDITABLE`; cambiar una causa raíz ya firmada, 422 `CAUSA_RAIZ_FIRMADA`.
- **Audit trail resumido:** en lugar de guardar el JSON completo, se registra un resumen ("5 Porqués actualizado (3 de 5 respuestas completas)").
- **BREAKING (contrato):** `causaRaizAprobadaPorId` y `causaRaizFirmadaEn` salen del PATCH genérico. Si vienen en el body, se ignoran.
- **Aprobación con PIN verificado (D2):** endpoint nuevo `POST /api/quality-events/{id}/aprobar-causa-raiz` con body `{ pin }`, solo para JCA. Verifica el PIN en el servidor (`PIN_NO_CONFIGURADO` / `PIN_INCORRECTO`), exige una causa raíz guardada de 100 a 500 caracteres (`CAUSA_RAIZ_INVALIDA`) y que no esté firmada (`CAUSA_RAIZ_FIRMADA`). El servidor fija quién firma y cuándo, y registra `CAUSA_RAIZ_APROBADA` en el audit trail.
- **Frontend:** `QEInvestigationSection` deja editar al responsable asignado, muestra "Análisis guardado" o el error del servidor, firma con el endpoint nuevo (errores de PIN dentro del modal, aviso de PIN no configurado y enlace "¿Olvidaste tu PIN?"), guarda los cambios pendientes antes de abrir el modal y muestra "Pendiente de aprobación del Jefe de Calidad" a quien no es JCA.
- **MSW:** el PATCH ignora los campos de firma, y se agrega el handler `aprobar-causa-raiz` con verificación de PIN y de rol.

## Capabilities

### New Capabilities

_Ninguna._ La aprobación de la causa raíz ya es parte del contrato del QE; se corrige dentro de las capabilities que la cubren.

### Modified Capabilities

- `be-quality-events-api`: el PATCH genérico recibe el análisis tipado, valida estructura, estado y actor, y ya no acepta campos de firma; endpoint nuevo `aprobar-causa-raiz` con PIN verificado; lectura de `cincoPorques`/`ishikawa` como arrays, tolerante a datos viejos.
- `quality-event-investigation`: edición por JCA o responsable asignado; aprobación solo por JCA vía el endpoint nuevo con errores de PIN en el modal; feedback de guardado; estado "pendiente de aprobación".
- `quality-event-api`: función `aprobarCausaRaiz(id, pin)` y `QualityEventUpdateInput` sin campos de firma.
- `quality-event-hooks`: hook `useAprobarCausaRaiz`.
- `quality-event-msw-handlers`: PATCH sin campos de firma y handler `POST /:id/aprobar-causa-raiz`.

## Impact

- **Backend (`ShcMvpEndPoint/`):**
  - nuevo slice `Features/QualityEvents/AprobarCausaRaizQE/`;
  - DTOs `CincoPorqueItem`/`IshikawaItem`/`IshikawaCategoria` y serialización del análisis;
  - validator nuevo para `ActualizarQualityEventCommand`;
  - cambios en `ActualizarQualityEventCommand/Handler/Endpoint`, en la entidad `QualityEvent` (arrays de solo lectura y columnas crudas con `[JsonIgnore]`) y en `ObtenerQualityEventHandler` (warning);
  - registro en `EndpointExtensions.cs`;
  - tests de integración.
- **Frontend (`shc-controldoc/src/`):** `QEInvestigationSection.tsx` (+ test), `qualityEvent.types.ts`, `quality-events.api.ts`, nuevo `useAprobarCausaRaiz.ts`, i18n es-PE/en-US (`qualityEvents`).
- **MSW:** `quality-events.handlers.ts` (los fixtures ya usan arrays).
- **PDF:** `buildQualityEventPdf.ts` ya imprime una fila por porqué o por categoría, y el `ExportarPdfQE` del backend no lee el análisis, así que no cambian.
- **Sin migración.** Depende de `responsableInvestigacionId` (`qe-precarga-incidente-responsable`). El change `qe-asistente-ia` se aplica después de este.
