## Why

Al confirmar la revisión periódica de un documento (opción A del modal "Revisión Periódica"), el usuario no puede elegir la próxima fecha de revisión: `ConfirmarRevisionPeriodicaHandler` siempre recalcula `FechaRevisionProxima = DateTime.UtcNow.AddMonths(meses)` según el tipo de documento, ignorando cualquier preferencia del usuario — el endpoint ni siquiera acepta un body. El modal (`DocumentRevisionPeriodicaModal`) tampoco tiene ningún campo de fecha. Además, la fecha se guarda con hora (no como fecha de calendario, violando el criterio de `fix-fechas-utc`), y el toast de confirmación la formatea en la zona horaria del navegador en vez de UTC-calendario, lo que puede mostrar un día equivocado en UTC-5.

## What Changes

- **Decisión de Toño (2026-10-07):** el modal sugiere una fecha según el tipo de documento, y el usuario puede editarla. La fecha debe ser al menos 30 días después de hoy (mismo margen que RN-DOC-020). Para `REG`/`INF` es opcional.
- `PATCH /api/documents/{id}/confirmar-revision` acepta un body opcional `{ fechaRevisionProxima?: "YYYY-MM-DD" | null }`.
  - Si viene una fecha: debe ser ≥ hoy + 30 días, calculado como fecha de calendario en `America/Lima` (no UTC) para que el corte de día no dependa del servidor. Si no cumple, error de validación por campo.
  - Si no viene body (o es `null`): `POL/PRC/PLAN/INS/MAT` usan la fecha sugerida (hoy + periodicidad del tipo); `REG/INF` quedan en `null` — compatibilidad con clientes que no envían body.
- La fecha siempre se persiste como fecha de calendario (medianoche UTC del día elegido), nunca con hora — corrige la violación de `fix-fechas-utc` ya presente.
- El audit trail `REVISION_PERIODICA_CONFIRMADA` registra la fecha anterior (`ValorAnterior`) además de la nueva (`ValorNuevo`), formato `YYYY-MM-DD` — hoy solo registra la nueva.
- `DocumentRevisionPeriodicaModal`: la opción A gana un campo de fecha, precargado con la fecha sugerida según el tipo, editable, con `min` = hoy + 30 días; opcional y vacío por defecto en `REG`/`INF`.
- El toast de confirmación usa el formateador de fecha de calendario (UTC), no el formateador de timestamp en zona local — corrige el posible desfase de un día en UTC-5.
- MSW: mismo contrato de body y mismas reglas de validación.

**Verificado antes de implementar (ver design.md):** se confirmó leyendo el código que el cálculo actual para `PRC` da `hoy + 12 meses` (no literalmente "hoy") y para `REG`/`INF` da `null`. No se encontró un bug adicional de "queda literalmente en la fecha de hoy" — el reporte de Toño describe correctamente el síntoma real: el sistema asigna la fecha automáticamente y no permite elegirla, no que el valor guardado sea la fecha del día de la confirmación.

## Capabilities

### New Capabilities
- `document-revision-periodica`: `DocumentRevisionPeriodicaModal` (campo de fecha editable, sugerencia por tipo, validación de margen mínimo), `useConfirmarRevisionPeriodica` (envío de body, toast con fecha correcta), y el handler MSW de `confirmar-revision` (mismo contrato que el backend real).

### Modified Capabilities
- `be-documentos-api`: requirement "Confirmar revisión periódica" — acepta body opcional, valida margen mínimo de 30 días contra "hoy" en `America/Lima`, persiste como fecha de calendario, y el audit trail registra `ValorAnterior`/`ValorNuevo`.

## Impact

- `ShcMvpEndPoint/Features/Documentos/ConfirmarRevisionPeriodica/` (nuevo `ConfirmarRevisionPeriodicaCommand.cs` + validator, cambios en Handler y Endpoint).
- Constante compartida de periodicidad por tipo (backend) — unificar con `DOC_PERIODICIDAD_POR_TIPO` (frontend) para que ambos lados coincidan.
- `shc-controldoc/src/features/documents/components/DocumentRevisionPeriodicaModal.tsx`.
- `shc-controldoc/src/features/documents/hooks/useDocumentActions.ts` (`useConfirmarRevisionPeriodica`).
- `shc-controldoc/src/api/endpoints/documents.api.ts` (`confirmarRevisionPeriodica` con body).
- `shc-controldoc/src/mocks/handlers/documents.handlers.ts`.
- `shc-controldoc/src/i18n/es-PE.json`, `en-US.json`.
- Tests de integración backend y unitarios/componente frontend.
