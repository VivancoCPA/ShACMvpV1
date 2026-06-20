## 1. Types and Permissions Foundation

- [x] 1.1 Add `DocConfidencialidad` union type (`PUBLICO | INTERNO | CONFIDENCIAL | RESTRINGIDO`) to `src/features/documents/types/document.types.ts`
- [x] 1.2 Add `confidencialidad: DocConfidencialidad` and `rolesAutorizados: string[]` fields to the `Documento` interface
- [x] 1.3 Add `canAccessDocument(confidencialidad, userRole, rolesAutorizados)` pure function to `src/features/documents/utils/documentPermissions.ts`

## 2. i18n Keys

- [x] 2.1 Add all `documents:detail.*` keys to `src/i18n/es-PE.json` (title, noActionsAvailable, backToList, tabs, banners, actions, historial, auditTrail)
- [x] 2.2 Add all `documents:signature.*` and `documents:reject.*` keys to `src/i18n/es-PE.json`
- [x] 2.3 Add `documents:confidencialidad.*` and `documents:errors.*` keys to `src/i18n/es-PE.json`
- [x] 2.4 Mirror all new keys in `src/i18n/en-US.json`

## 3. MSW Fixtures Update

- [x] 3.1 Add `confidencialidad` to all document fixtures (2 PUBLICO, 3 INTERNO, 1 CONFIDENCIAL, 1 RESTRINGIDO)
- [x] 3.2 Add `rolesAutorizados: ['JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO']` to the RESTRINGIDO fixture only
- [x] 3.3 Add `historialVersiones` (2–3 realistic `VersionEntry` entries) to every fixture
- [x] 3.4 Add `auditTrail` (4–6 realistic `AuditTrailEntry` entries covering creation and state changes) to every fixture

## 4. MSW Handlers — New Endpoints

- [x] 4.1 Add `PATCH /api/documents/:id/status` handler: validate transition, apply RN-DOC-001 (obsolete same-code PUBLICADO), append AuditTrailEntry, return updated document
- [x] 4.2 Add `POST /api/documents/:id/sign` handler: validate password (mock PIN `"123456"`), set PUBLICADO + hashArchivo, apply RN-DOC-001, return updated document; return 401 on wrong password
- [x] 4.3 Add `DELETE /api/documents/:id` handler: allow only for BORRADOR/EN_REVISION, return 204
- [x] 4.4 Add `GET /api/documents/:id/download-url` handler: return `{ url: 'mock://signed-url-' + id, expiresAt: now+15min }`; return 403 if `?expired=true`
- [x] 4.5 Add `POST /api/documents/:id/audit/access` handler: append DESCARGA/VISUALIZACION AuditTrailEntry to in-memory fixture, return `{ success: true }`
- [x] 4.6 Update `GET /api/documents` list handler to filter CONFIDENCIAL and RESTRINGIDO fixtures by simulated user role

## 5. API Client Update

- [x] 5.1 Add `changeDocumentStatus(id, payload)` to `src/features/documents/api/documents.api.ts`
- [x] 5.2 Add `signDocument(id, payload)` to `documents.api.ts`
- [x] 5.3 Add `deleteDocument(id)` to `documents.api.ts`
- [x] 5.4 Add `getDocumentDownloadUrl(id)` to `documents.api.ts`
- [x] 5.5 Add `registerDocumentAccess(id, payload)` to `documents.api.ts`

## 6. Hooks

- [x] 6.1 Create `src/features/documents/hooks/useDocumentDetail.ts` wrapping `useQuery(['document', id], api.getDocument)`
- [x] 6.2 Create `src/features/documents/hooks/useDocumentActions.ts` with `useChangeStatus`, `useSignDocument`, `useDeleteDocument`, `useGetDownloadUrl`, `useRegisterAccess` — each invalidating `['document', id]` and `['documents']` on success

## 7. Zod Schema

- [x] 7.1 Create `src/features/documents/schemas/documentAction.schema.ts` with `signatureSchema` (password: required, min 6) and `rejectSchema` (motivo: min 20 max 500, notificarAutor: boolean)

## 8. documentPdf Utility

- [x] 8.1 Create `src/utils/documentPdf.ts` with `requestDocumentPdf(documento, user)`: check `canAccessDocument`, GET download-url, POST audit/access DESCARGA, open HTML window with watermark
- [x] 8.2 Add dynamic watermark to HTML: user full name, Lima timezone timestamp via `Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima' })`, legend "COPIA NO CONTROLADA — Solo válido al momento de impresión"
- [x] 8.3 Add OBSOLETO heading in red when `documento.estado === 'OBSOLETO'`
- [x] 8.4 Add TODO comments for RN-DOC-010, CA-20, CA-24 (server-side PDF and print restrictions)
- [x] 8.5 Add `requestDocumentView(documento, user)` function: check access, GET download-url, POST audit/access VISUALIZACION, open `archivoUrl` in new tab

## 9. DocumentConfidencialidadBadge Component

- [x] 9.1 Create `src/features/documents/components/DocumentConfidencialidadBadge.tsx` with pill styling and lucide-react icons (Globe / Building2 / Lock / ShieldOff) per confidencialidad value, dark mode variants

## 10. DocumentSignatureModal Component

- [x] 10.1 Create `src/features/documents/components/DocumentSignatureModal.tsx` with accessible overlay (aria-modal, aria-labelledby, focus trap, Escape handler)
- [x] 10.2 Implement React Hook Form + `signatureSchema` Zod resolver; password field (type=password) with inline error on 401 via `setError`
- [x] 10.3 Wire to `useSignDocument` mutation; on success: close modal + `toast.success` + query invalidation

## 11. DocumentRejectModal Component

- [x] 11.1 Create `src/features/documents/components/DocumentRejectModal.tsx` with motivo Textarea and notificarAutor checkbox (default checked)
- [x] 11.2 Implement React Hook Form + `rejectSchema` Zod resolver; confirm button in `bg-error`
- [x] 11.3 Wire to `useChangeStatus` mutation with `{ estado: 'BORRADOR', motivo, notificarAutor }`; on success: `toast.success` + navigate `/documentos`

## 12. DocumentActionPanel Component

- [x] 12.1 Create `src/features/documents/components/DocumentActionPanel.tsx` with sticky positioning
- [x] 12.2 Implement per-estado action rendering using `getDocumentPermissions()` and user role from `authStore`; no actions for OBSOLETO
- [x] 12.3 Wire "Enviar a revisión" (BORRADOR) → confirmation modal → `useChangeStatus`
- [x] 12.4 Wire "Eliminar" (BORRADOR) → confirmation modal → `useDeleteDocument`
- [x] 12.5 Wire "Aprobar revisión" and "Cancelar revisión" (EN_REVISION) → `useChangeStatus`
- [x] 12.6 Wire "Rechazar" (EN_REVISION, EN_APROBACION) → `DocumentRejectModal`
- [x] 12.7 Wire "Firmar y publicar" (EN_APROBACION) → `DocumentSignatureModal`
- [x] 12.8 Wire "Iniciar revisión periódica" (PUBLICADO) → `useChangeStatus`
- [x] 12.9 Wire "Crear nueva versión" (PUBLICADO) and "Iniciar nueva versión" (EN_REVISION_PERIODICA) → `navigate('/documentos/nuevo?baseId=:id')`

## 13. DocumentHistorial Component

- [x] 13.1 Create `src/features/documents/components/DocumentHistorial.tsx` rendering `historialVersiones` in descending order with timeline (border-l-2 border-hairline dark:border-hairline/20)
- [x] 13.2 Display version badge, StatusBadge, date (Intl.DateTimeFormat with locale), autorId, descripcionCambios; "Versión actual" badge in coral for current version

## 14. DocumentAuditTrail Component

- [x] 14.1 Create `src/features/documents/components/DocumentAuditTrail.tsx` rendering `auditTrail` in descending timestamp order
- [x] 14.2 Display timestamp (Intl.DateTimeFormat with Lima timezone), realizadoPorNombre, accion (including DESCARGA, VISUALIZACION), diff fields
- [x] 14.3 Implement local pagination: show first 20 entries, "Ver más" appends next 20 (no API call)

## 15. DocumentDetailHeader Component

- [x] 15.1 Create `src/features/documents/components/DocumentDetailHeader.tsx` displaying all document metadata fields
- [x] 15.2 Render `StatusBadge` and `DocumentConfidencialidadBadge` side by side
- [x] 15.3 Conditionally render `RevisionSemaforo` for PUBLICADO and EN_REVISION_PERIODICA states
- [x] 15.4 Render OBSOLETO banner (bg-error/10), QE-vinculados banner (bg-amber/10), RESTRINGIDO banner (bg-teal/10, authorized roles only)
- [x] 15.5 Render "Ver archivo" and "Descargar PDF" buttons gated by `canAccessDocument()`; wire to `requestDocumentView` and `requestDocumentPdf`

## 16. DocumentDetailPage

- [x] 16.1 Create `src/features/documents/pages/DocumentDetailPage.tsx` reading `:id` from `useParams()` and calling `useDocumentDetail(id)`
- [x] 16.2 Implement two-column layout (grid, left 2/3, right 1/3) with left holding header + tabs, right holding sticky `DocumentActionPanel`
- [x] 16.3 Render skeleton during loading state and `ErrorBoundary` on error
- [x] 16.4 Implement tab bar (Detalle | Historial | Audit Trail) with client-side state (active tab border-b-2 border-coral; inactive text-muted hover:text-body)
- [x] 16.5 Add "Volver a lista" button navigating to `/documentos`
- [x] 16.6 Wire router placeholder at `/documentos/:id` to `DocumentDetailPage`
