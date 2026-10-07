## Why

PRC-CD-013 se creó con revisor y aprobador asignados y "se quedó en el aire": nadie recibió aviso de que le tocaba actuar. Lectura del código real confirma la causa en tres frentes: (1) `DocumentoNotificationSender` solo notifica al crear (cuando el revisor/aprobador todavía no pueden hacer nada) y en un rechazo opcional — ninguna transición real (enviar a revisión, aprobar revisión, publicar, cancelar revisión, iniciar revisión periódica, nueva versión) dispara aviso a quien le toca actuar; (2) el contador y el filtro de "pendientes" (`DocumentoSqlHelpers.BuildPendientesClause`, espejado en MSW) usan reglas de rol anteriores a la decisión D1 de `documentos-revisor-aprobador-reales` (revisor ∈ JCA/JCD/AUD/DIR, aprobador ∈ JCD/DIR) — `ALTA_DIRECCION` como aprobador nunca ve su pendiente, `AUDITOR_INTERNO` como revisor tampoco, y el autor nunca ve su propio BORRADOR sin enviar; (3) `RestaurarDocumentoEndpoint`/`RestaurarDocumentoHandler` no validan rol en el backend — cualquier usuario autenticado de la empresa puede restaurar un documento eliminado, aunque el frontend ya restringe el botón a `JEFE_CALIDAD_SYST`/`ALTA_DIRECCION`.

## What Changes

- Agregar notificaciones best-effort (try/catch, después de `SaveChangesAsync`, nunca al propio actor, sin duplicados, solo si el destinatario no es nulo) en las transiciones de documento que hoy no notifican a nadie: `BORRADOR → EN_REVISION` (revisor), `EN_REVISION → EN_APROBACION` (aprobador), `EN_APROBACION → PUBLICADO` (autor + revisor, informativo), `EN_REVISION → BORRADOR` sin motivo / cancelar revisión (autor + revisor), `PUBLICADO → EN_REVISION_PERIODICA` (autor), y nueva versión creada (revisor y aprobador heredados, como asignación nueva).
- Ajustar el texto de la notificación de asignación al crear/editar en BORRADOR: de "se te asignó" a un aviso de designación que aclara que se avisará de nuevo cuando sea su turno (para no invitar a un documento donde todavía no puede actuar).
- **BREAKING (regla de negocio):** reescribir `BuildPendientesClause` para que "pendiente" dependa únicamente de la asignación directa del actor (BORRADOR propio, revisor asignado en EN_REVISION, aprobador asignado en EN_APROBACION), salvo `EN_REVISION_PERIODICA` que sigue dependiendo del rol (`JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`, sin asignado individual). Elimina el corte temprano por `NonPendingRoles` en `ContarPendientesHandler` y el caso especial de `JEFE_CALIDAD_SYST` viendo todo `EN_REVISION` de la empresa sin ser el revisor asignado.
- Aplicar la cláusula de confidencialidad también en `ContarPendientesHandler` (hoy solo la aplica el listado), para que el badge coincida siempre con `GET /api/documents?pendientes=true`.
- Restringir `PATCH /api/documents/:id/restaurar` a `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` en el backend (hoy solo lo restringe el frontend) y en el handler MSW equivalente.
- Quitar/corregir el role-gate hardcodeado de roles 2026-anterior en `DocumentListFilters` (`CAN_SEE_PENDIENTES`) y en `Sidebar` (`PENDIENTES_BADGE_ROLES`), ambos limitados a `SUPERVISOR`/`JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`, para que cualquier rol con pendientes reales (p.ej. `ALTA_DIRECCION` aprobador, `AUDITOR_INTERNO` revisor, o el propio autor con un BORRADOR sin enviar) vea el filtro y el badge.

## Capabilities

### New Capabilities

(ninguna — todos los cambios son requisitos nuevos o modificados sobre capabilities existentes)

### Modified Capabilities

- `be-documentos-api`: nuevos requisitos de notificación en transiciones de estado, firma/publicación y nueva versión; reescritura de "Bandeja de pendientes por rol y asignación"; nuevo requisito de rol en "Eliminación y restauración (soft delete)".
- `document-msw-handlers`: mismos tres cambios reflejados en los handlers MSW (`documents.handlers.ts`), para que la paridad mock/backend real se mantenga (RN de siempre del proyecto).
- `document-list-view`: `DocumentListFilters` deja de ocultar el filtro "Mis pendientes" para roles que sí pueden tener pendientes bajo la nueva regla.
- `app-navigation`: el badge de pendientes de Documentos en `Sidebar` deja de ocultarse para esos mismos roles.

## Impact

- Backend: `Features/Documentos/Shared/DocumentoNotificationSender.cs` + `IDocumentoNotificationSender.cs` (nuevo método genérico de transición), `CambiarEstadoDocumentoHandler.cs`, `FirmarPublicarDocumentoHandler.cs`, `NuevaVersionDocumentoHandler.cs`, `CrearDocumentoHandler.cs`/`EditarDocumentoHandler.cs` (texto del mensaje), `Features/Documentos/Shared/DocumentoSqlHelpers.cs` (`BuildPendientesClause`), `ContarPendientesHandler.cs`, `RestaurarDocumentoEndpoint.cs`.
- Frontend: `src/mocks/handlers/documents.handlers.ts`, `src/features/documents/components/DocumentListFilters.tsx`, `src/components/layout/Sidebar.tsx`, i18n keys si cambia el texto del aviso de designación.
- No se agregan valores a `NotificacionTipo` (se reutilizan `ASIGNACION`/`CAMBIO_ESTADO`); no se toca el mecanismo de tiempo real (`notifications-realtime-hub`) — estas notificaciones siguen llegando por polling de 60s, no por SignalR.
- Decisiones abiertas para Toño, documentadas en `design.md`: (1) divergencia de la Matriz RACI M1 sobre quién puede restaurar (JCD aparece en la tabla pero la nota dice "solo JCA y DIR" — se implementa lo que ya hace el código/frontend, JCA+DIR); (2) si la notificación de rechazo al autor debería dejar de depender del flag `notificarAutor` del formulario de rechazo.
