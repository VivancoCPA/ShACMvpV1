## Why

Cuando un documento se rechaza en `EN_REVISION` o `EN_APROBACION`, el motivo del rechazo viaja hasta el backend y se persiste, pero se guarda en `DocumentoAuditTrail.ValorAnterior` — un campo pensado para "valor anterior de un campo editado", no para un motivo — y nunca se muestra en ninguna pantalla. Además, el audit trail registra la transición de rechazo con la misma acción (`ESTADO_CAMBIADO`) que una cancelación de revisión sin motivo (Jefe de Calidad), por lo que ambos casos son indistinguibles en el historial. El autor recibe la notificación de rechazo, entra al documento y no tiene forma de saber qué corregir, y la trazabilidad de ISO 9001 §7.5 (quién rechazó, por qué) queda incompleta.

## What Changes

- **BREAKING** (contrato de datos, no de API pública): se agrega la columna `motivo` (nullable, máx. 500) a `documento_audit_trail` / `DocumentoAuditTrail`, con una migración EF que además migra los datos históricos de `ESTADO_CAMBIADO` con destino `BORRADOR` hacia las nuevas acciones.
- Nuevas acciones de audit trail, que reemplazan a `ESTADO_CAMBIADO` solo en las transiciones hacia `BORRADOR` desde `EN_REVISION`/`EN_APROBACION`:
  - `RECHAZADO_EN_REVISION` (revisor rechaza, con `motivo`).
  - `RECHAZADO_EN_APROBACION` (aprobador rechaza, con `motivo`).
  - `REVISION_CANCELADA` (Jefe de Calidad cancela revisión, sin `motivo`).
- `CambiarEstadoDocumentoHandler` deja de escribir el motivo en `ValorAnterior`; lo escribe en el nuevo campo `Motivo`, y elige la acción correcta según `esRechazo`/origen de la transición.
- `GET /api/documents/:id` expone `motivo` en cada entrada de audit trail (proyección Dapper de `DocumentoAuditTrailLoader`) y el tipo TS `AuditTrailEntry` gana el campo `motivo?: string`.
- La notificación de rechazo al autor (`NotificarRechazoAsync`) incluye un extracto del motivo (hasta 120 caracteres).
- Frontend: `DocumentAuditTrail` y `DocumentHistorial` muestran etiqueta, ícono distinguible y el motivo (cuando exista) para las tres nuevas acciones.
- Nuevo banner contextual en `DocumentDetailHeader` (mismo patrón que los banners de OBSOLETO/QE-vinculados/RESTRINGIDO ya existentes): si el documento está en `BORRADOR` y la última entrada de cambio de estado fue un rechazo, se muestra con quién rechazó, cuándo, y el motivo completo. Desaparece al reenviar a revisión.
- MSW: los handlers de cambio de estado (`mocks/handlers/documents.handlers.ts`) replican las nuevas acciones y el campo `motivo`; fixtures de documentos con rechazos existentes se actualizan.

## Capabilities

### New Capabilities

(ninguna — esta es una extensión de capacidades existentes, no un dominio nuevo)

### Modified Capabilities

- `be-documentos-api`: el requirement "Cambio de estado sin firma" gana las tres acciones de audit trail diferenciadas (`RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION`, `REVISION_CANCELADA`) con el campo `Motivo`, y el requirement de obtención del documento expone `motivo` en el audit trail devuelto.
- `document-types`: el requirement "Document-scoped AuditTrailEntry interface" gana el campo opcional `motivo`.
- `document-detail`: el requirement "DocumentAuditTrail section" y el de "Historial panel" ganan la presentación de las tres acciones nuevas con su motivo; nuevo requirement para el banner de rechazo visible en `DocumentDetailPage`.
- `document-msw-handlers`: nuevo requirement para el handler PATCH real (el único con consumidor en el frontend — el requirement existente documenta un `POST` legacy sin consumidores, divergencia detallada en `design.md`), con las nuevas acciones y el campo `motivo`.
- `document-msw-fixtures`: nuevo requirement para que las fixtures de rechazos/cancelaciones existentes usen las acciones dedicadas en vez de `ESTADO_CAMBIADO`.

## Impact

- Backend: `CambiarEstadoDocumentoHandler`, `DocumentoAuditTrail` (entidad + migración EF), `DocumentoAuditTrailLoader`, `IDocumentoNotificationSender`/`DocumentoNotificationSender` (payload de rechazo con motivo truncado), tests de `ShcMvpEndPoint.Tests/Features/Documentos`.
- Frontend: `types/documents.types.ts` (`AuditTrailEntry.motivo`), `DocumentAuditTrail.tsx`, `DocumentHistorial.tsx`, `DocumentDetailPage.tsx` (nuevo banner), i18n (`es-PE.json`/`en-US.json`, namespace `documents`), `mocks/handlers/documents.handlers.ts`, `mocks/fixtures/documents.fixtures.ts`.
- Sin impacto en otros dominios (`QualityEventAuditTrail`, `IncidenteAuditTrail`, `NoConformidadAuditTrail` son tablas separadas) ni en `DocumentVersionesTab.getPublisher` (solo filtra por `estadoNuevo === 'PUBLICADO'`, acción no tocada).
