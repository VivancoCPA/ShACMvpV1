## Why

El permiso para gestionar la revisión periódica de un documento (`canStartReview`/`canCancelReview` en la matriz de `(estado, docRole)`, y la ausencia total de gate en `confirmar-revision`) hoy depende del `docRole` del actor sobre ESE documento, no de su rol global. Como el `docRole` se resuelve con precedencia `AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD`, un `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` que fue autor, revisor o aprobador de un documento deja de ser `JEFE_CALIDAD` para ese documento y pierde el permiso en `PUBLICADO`. En una empresa con pocos Jefes esto puede dejar un documento vencido sin que nadie pueda iniciar su revisión — caso real detectado por Toño. Además, `PATCH /:id/confirmar-revision` no valida ningún permiso: cualquier usuario autenticado de la empresa puede confirmar la vigencia. Es urgente: bloquea la operación normal del módulo de Control Documentario.

## What Changes

- Las tres acciones de revisión periódica (iniciar, confirmar vigencia, cancelar) pasan a autorizarse **por rol global** (`JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`), no por `docRole` del documento — un Jefe que fue autor/revisor/aprobador de ESE documento conserva el permiso.
- Nueva regla centralizada en un solo lugar por capa: `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(UserRole)` (backend) y `canManagePeriodicReview(userRol)` (frontend, `permissions.ts`), usada en los 3 puntos de gate (backend, MSW, UI) en vez de los flags `canStartReview`/`canCancelReview` de la matriz `(estado, docRole)`.
- `ConfirmarRevisionPeriodicaHandler` (backend) y el handler MSW de `confirmar-revision` ganan su primer chequeo de permiso — hoy no validan nada.
- `CambiarEstadoDocumentoHandler` (backend) y el handler MSW de cambio de estado dejan de usar `permisos.CanStartReview`/`permisos.CanCancelReview` para las transiciones `PUBLICADO → EN_REVISION_PERIODICA` y `EN_REVISION_PERIODICA → BORRADOR`, y usan la nueva regla por rol.
- `DocumentActionPanel` (botón "Iniciar revisión periódica") y `DocumentListRow` (icono ↻) usan la nueva regla — el botón aparece para cualquier JCA/JCD aunque haya participado en el documento.
- La matriz `getDocumentPermissions`/`GetBasePermissions` por `(estado, docRole)` **no cambia**: sigue siendo la fuente de verdad del ciclo BORRADOR → PUBLICADO (enviar a revisión, aprobar, rechazar, firmar). Los flags `canStartReview`/`canCancelReview` quedan en la matriz por compatibilidad de tipo/tests, pero dejan de ser el gate real de estas 3 acciones.
- No es **BREAKING** a nivel de contrato de API: `DocumentPermissions`/`CanStartReview`/`CanCancelReview` nunca se serializan al cliente (confirmado leyendo `ObtenerDocumentoHandler`); son un tipo interno del handler.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `document-permissions`: nueva función pura `canManagePeriodicReview(userRol: UserRole): boolean`, exportada junto a `getDocumentPermissions`/`resolveDocRoleForUser`.
- `be-documentos-api`: `PATCH /:id/status` (transiciones `PUBLICADO → EN_REVISION_PERIODICA` y `EN_REVISION_PERIODICA → BORRADOR`) y `PATCH /:id/confirmar-revision` pasan a autorizar por rol global vía `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica`, no por `docRole`.
- `document-approval-flow`: el requirement de acciones en `PUBLICADO`/`EN_REVISION_PERIODICA` se actualiza para reflejar que el botón se autoriza por rol global, no por `docRole`/participación en el documento.
- `document-list-view`: el requirement de `DocumentListRow` se actualiza para declarar explícitamente la regla por rol (en vez de depender de la aproximación implícita de `userRoleToDocRole`).
- `document-msw-handlers`: nuevo requirement para el gate de permiso por rol en `PATCH /:id/status` (transiciones de revisión periódica) y `PATCH /:id/confirmar-revision`, hoy inexistente en ambos.

## Impact

- Backend: `Features/Documentos/Shared/DocumentPermissionResolver.cs`, `Features/Documentos/CambiarEstadoDocumento/CambiarEstadoDocumentoHandler.cs`, `Features/Documentos/ConfirmarRevisionPeriodica/ConfirmarRevisionPeriodicaHandler.cs` + `ConfirmarRevisionPeriodicaEndpoint.cs` (pasar `actorRolGlobal`).
- Frontend: `src/features/documents/permissions.ts`, `DocumentActionPanel.tsx`, `DocumentListRow.tsx`.
- MSW: `src/mocks/handlers/documents.handlers.ts` (`PATCH /:id/status`, `PATCH /:id/confirmar-revision`).
- Tests: backend (`DocumentosStateMachineEndpointTests.cs`, `DocumentosConfirmarRevisionPeriodicaEndpointTests.cs`), frontend (`permissions.test.ts`, `DocumentActionPanel.test.tsx` si existe, `documents.handlers.test.ts`).
