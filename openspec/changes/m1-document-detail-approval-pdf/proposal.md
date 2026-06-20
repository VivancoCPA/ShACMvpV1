## Why

El módulo M1 (Control Documentario) tiene la lista y el formulario de creación implementados, pero carece de la página de detalle, el flujo de aprobación y los controles de seguridad documental requeridos por el addendum SHAC-PRD-003-ADD-01. Sin esto, los documentos creados no pueden avanzar en su ciclo de vida ni ser descargados con trazabilidad, bloqueando la validación end-to-end del M1.

## What Changes

- **Nueva página** `/documentos/:id` con layout dos columnas: cabecera + tabs (Detalle / Historial / Audit Trail) a la izquierda, panel de acciones sticky a la derecha.
- **Flujo de aprobación completo**: transiciones de estado (BORRADOR → EN_REVISION → EN_APROBACION → PUBLICADO), firma electrónica con PIN, rechazo con motivo, revisión periódica y nueva versión.
- **Firma electrónica** (RN-DOC-004): modal con contraseña, validación en MSW, registro de hash SHA-256 mock y timestamp.
- **Seguridad documental** (addendum §RN-DOC-007 a RN-DOC-012): badge de confidencialidad, filtrado de acceso, URLs firmadas con TTL 15min, trazabilidad de descargas en audit trail, marca de agua dinámica en PDF mock.
- **Historial de versiones** y **Audit Trail** completos incluyendo entradas DESCARGA y VISUALIZACION.
- **Nuevos MSW handlers**: PATCH /status, POST /sign, DELETE, GET /download-url, POST /audit/access.
- **Fixtures actualizados** con `confidencialidad`, `rolesAutorizados`, `historialVersiones` y `auditTrail` poblados.

## Capabilities

### New Capabilities

- `document-detail`: Página de detalle con cabecera informativa, badge de confidencialidad, banners contextuales (OBSOLETO, QEs vinculados, RESTRINGIDO) y tabs de Detalle, Historial y Audit Trail.
- `document-approval-flow`: Panel de acciones con transiciones de estado por rol, modal de firma electrónica (DocumentSignatureModal) y modal de rechazo (DocumentRejectModal).
- `document-pdf-security`: Utilidad `documentPdf.ts` que implementa el flujo mock de URL firmada → registro de acceso → generación de PDF con marca de agua dinámica (RN-DOC-007/008/009).

### Modified Capabilities

- `document-types-schemas-constants-permissions`: Se añaden handlers MSW para los 5 nuevos endpoints y se enriquecen los fixtures con `confidencialidad`, `rolesAutorizados`, `historialVersiones` y `auditTrail`.

## Impact

- **Archivos nuevos**: `DocumentDetailPage.tsx`, `DocumentDetailHeader.tsx`, `DocumentActionPanel.tsx`, `DocumentSignatureModal.tsx`, `DocumentRejectModal.tsx`, `DocumentHistorial.tsx`, `DocumentAuditTrail.tsx`, `DocumentConfidencialidadBadge.tsx`, `useDocumentDetail.ts`, `useDocumentActions.ts`, `documentAction.schema.ts`, `documentPdf.ts`.
- **Archivos modificados**: `documents.handlers.ts` (+5 handlers), `documents.fixtures.ts` (+campos addendum), `documents.api.ts` (+4 mutations), `es-PE.json` / `en-US.json` (+35 claves i18n en namespace `documents`).
- **Sin cambios**: tipos, schemas de creación, `getDocumentPermissions()`, `StatusBadge`, `RevisionSemaforo`, router (la ruta `/documentos/:id` ya existe como placeholder).
- **Dependencia externa**: Backend .NET no existe; todo se implementa vía MSW. Las funciones PDF marcan con `TODO` los comportamientos que requieren servidor (RN-DOC-010, CA-20, CA-24).
