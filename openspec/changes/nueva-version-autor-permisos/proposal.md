## Why

Al crear una nueva versión de un documento y enviarla a revisión, `PATCH /api/documents/{id}/status` responde `403`. Causa raíz confirmada: `NuevaVersionDocumentoHandler` copia `AutorId`/`RevisorId`/`AprobadorId` del documento origen en vez de registrar como autor a quien crea la versión; cuando ese actor era el revisor o aprobador asignado del original (caso típico de un Jefe de Calidad/Control Documentario), el backend lo resuelve como `docRole REVISOR`/`APROBADOR` — de solo lectura en `BORRADOR` — y rechaza el envío a revisión. Además, `POST /:id/nueva-version` no valida permisos (cualquier usuario autenticado de la empresa puede crear una versión) y `BORRADOR → EN_REVISION` no exige que haya revisor y aprobador asignados, dejando documentos sin nadie que los pueda aprobar.

## What Changes

- **Decisión de Toño (2026-10-07):** el autor de la nueva versión es quien la crea, no el autor original.
- `NuevaVersionDocumentoHandler`: `AutorId = actorId`; `RevisorId`/`AprobadorId` se heredan del origen solo si son distintos del nuevo autor y siguen siendo candidatos válidos (activos, con asignación activa, rol elegible) — si no, quedan `null`.
- `POST /:id/nueva-version` exige que el actor sea el autor del documento origen o tenga rol global `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`; cualquier otro usuario recibe `403`.
- `PATCH /:id/status` (`BORRADOR → EN_REVISION`) exige `RevisorId` y `AprobadorId` asignados; si falta alguno responde un error de validación por campo (`400`, mismo formato que `FieldValidationException`), no `403`. Aplica a todo documento, no solo a nuevas versiones.
- `DocumentActionPanel` (frontend): `canSendToReview`/`canDelete`/`canCancelReview`/`canStartPeriodic` usan la misma precedencia de `docRole` que el backend (`AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD → OPERARIO`), vía un resolver compartido con `DocumentDetailPage`, en vez de un flag `isJefeCalidad` suelto por rol global.
- Aviso en el detalle de un `BORRADOR` sin revisor o sin aprobador, con enlace a "Editar"; "Enviar a revisión" deshabilitado con el motivo visible.
- Tras crear una nueva versión con algún campo vacío, aviso al usuario y navegación al formulario de edición en vez del detalle.
- MSW: misma lógica de autor/herencia, permiso de creación de nueva versión, y validación de asignación al enviar a revisión.

**No cambia:** el orden de precedencia de `ResolveDocRole`/`getDocRoleForUser` (`AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD`) — un JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO que es revisor o aprobador asignado de un `BORRADOR` ajeno sigue sin poder enviarlo a revisión; es el comportamiento esperado, documentado en `design.md`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `be-documentos-api`: requirement "Nueva versión" (autor = quien la crea; herencia condicionada de revisor/aprobador; permiso de creación restringido a autor origen o JCA/JCD global) y requirement "Cambio de estado sin firma" (validación de revisor/aprobador asignados al enviar a revisión).
- `document-approval-flow`: requirements "BORRADOR state actions" y "EN_REVISION state actions" (precedencia de `docRole` correcta en `DocumentActionPanel`, no solo rol global); requirement "Status change MSW handlers" (validación de asignación al enviar a revisión); nuevo requirement para el handler MSW de `nueva-version` (autor/herencia/permiso, espejo del backend real).

## Impact

- `ShcMvpEndPoint/Features/Documentos/NuevaVersionDocumento/NuevaVersionDocumentoHandler.cs`, `NuevaVersionDocumentoEndpoint.cs`.
- `ShcMvpEndPoint/Features/Documentos/CambiarEstadoDocumento/CambiarEstadoDocumentoHandler.cs`.
- `ShcMvpEndPoint/Features/Documentos/Shared/DocumentoAsignacionService.cs` (reuso de elegibilidad, sin duplicar lógica).
- `shc-controldoc/src/features/documents/permissions.ts` (nuevo resolver de `docRole` compartido).
- `shc-controldoc/src/features/documents/components/DocumentActionPanel.tsx`, `DocumentDetailPage.tsx`, `DocumentNuevaVersionModal.tsx`, `useDocumentActions.ts`.
- `shc-controldoc/src/mocks/handlers/documents.handlers.ts`.
- `shc-controldoc/src/i18n/es-PE.json`, `en-US.json` (aviso de asignación faltante).
- Tests de integración backend y unitarios/componente frontend.
