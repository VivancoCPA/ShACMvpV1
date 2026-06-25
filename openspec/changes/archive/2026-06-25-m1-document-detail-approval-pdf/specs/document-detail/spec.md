## ADDED Requirements

### Requirement: DocumentDetailPage layout and navigation
The system SHALL render `/documentos/:id` as a two-column desktop layout: left column (2/3 width) containing `DocumentDetailHeader` plus a tab bar (Detalle | Historial | Audit Trail), and right column (1/3 width) containing a sticky `DocumentActionPanel`. The page SHALL display a skeleton while loading and an `ErrorBoundary` on error. A "Volver a lista" button SHALL navigate to `/documentos`.

#### Scenario: Detail page renders with correct layout
- **WHEN** a user navigates to `/documentos/:id` and the document loads successfully
- **THEN** the page shows the two-column layout with header, tabs on the left, and action panel sticky on the right

#### Scenario: Skeleton shown during loading
- **WHEN** the document query is in `isLoading` state
- **THEN** a skeleton placeholder is rendered instead of the content

#### Scenario: ErrorBoundary shown on fetch error
- **WHEN** the document query returns an error
- **THEN** the `ErrorBoundary` renders an error state (not a blank page or unhandled crash)

#### Scenario: Back button navigates to list
- **WHEN** the user clicks "Volver a lista"
- **THEN** the router navigates to `/documentos`

### Requirement: DocumentDetailHeader information display
The `DocumentDetailHeader` component SHALL display: código, título, tipo, versión, `StatusBadge`, `DocumentConfidencialidadBadge`, área, autorId, revisorId, aprobadorId, fechaEmision, fechaVigencia, fechaRevisionProxima. It SHALL show a `RevisionSemaforo` when `estado` is `PUBLICADO` or `EN_REVISION_PERIODICA`.

#### Scenario: Header shows all document metadata
- **WHEN** a document loads with all optional fields populated
- **THEN** código, título, tipo, versión, área, autor, revisor, aprobador, and all dates are visible

#### Scenario: RevisionSemaforo shown for PUBLICADO documents
- **WHEN** `documento.estado === 'PUBLICADO'`
- **THEN** `RevisionSemaforo` renders in the header

#### Scenario: RevisionSemaforo shown for EN_REVISION_PERIODICA documents
- **WHEN** `documento.estado === 'EN_REVISION_PERIODICA'`
- **THEN** `RevisionSemaforo` renders in the header

#### Scenario: RevisionSemaforo hidden for non-active states
- **WHEN** `documento.estado` is `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, or `OBSOLETO`
- **THEN** `RevisionSemaforo` is not rendered

### Requirement: DocumentDetailHeader contextual banners
The header SHALL render contextual banners:
- OBSOLETO banner (bg-error/10 border-error/30) when `estado === 'OBSOLETO'`.
- QE-vinculados banner (bg-amber/10 border-amber/30) when `qeVinculados.length > 0`, listing the QE IDs.
- RESTRINGIDO info banner (bg-teal/10 border-teal/30) listing `rolesAutorizados` when `confidencialidad === 'RESTRINGIDO'`, visible only to users with role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`.

#### Scenario: OBSOLETO banner appears for obsolete documents
- **WHEN** `documento.estado === 'OBSOLETO'`
- **THEN** a red banner with key `documents:detail.banners.obsoleto` is displayed

#### Scenario: QE-vinculados banner shows QE IDs
- **WHEN** `documento.qeVinculados` contains at least one ID
- **THEN** an amber banner lists the QE IDs

#### Scenario: RESTRINGIDO banner visible to authorized roles
- **WHEN** `documento.confidencialidad === 'RESTRINGIDO'` and the user has role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`
- **THEN** a teal banner listing `rolesAutorizados` is displayed

#### Scenario: RESTRINGIDO banner hidden from non-authorized roles
- **WHEN** `documento.confidencialidad === 'RESTRINGIDO'` and the user has role `JEFE_CALIDAD_SYST` or `AUDITOR_INTERNO`
- **THEN** the teal banner is NOT displayed

### Requirement: DocumentDetailHeader file access buttons
The header SHALL render "Ver archivo" and "Descargar PDF" buttons only when the user has access based on `confidencialidad` (RN-DOC-011). Clicking "Ver archivo" SHALL call `requestDocumentView` (registers VISUALIZACION in auditTrail, opens archivoUrl in new tab). Clicking "Descargar PDF" SHALL call `requestDocumentPdf` (registers DESCARGA in auditTrail, opens PDF mock with watermark).

#### Scenario: File buttons visible when user has confidencialidad access
- **WHEN** the user's role satisfies the document's `confidencialidad` level
- **THEN** "Ver archivo" and "Descargar PDF" buttons are visible

#### Scenario: File buttons hidden when user lacks confidencialidad access
- **WHEN** the document's `confidencialidad` is `CONFIDENCIAL` and the user's role is `OPERARIO`
- **THEN** neither "Ver archivo" nor "Descargar PDF" is rendered

#### Scenario: Ver archivo registers VISUALIZACION
- **WHEN** the user clicks "Ver archivo"
- **THEN** `requestDocumentView` is called, a VISUALIZACION entry is added to the audit trail, and the file opens in a new tab

#### Scenario: Descargar PDF registers DESCARGA
- **WHEN** the user clicks "Descargar PDF"
- **THEN** `requestDocumentPdf` is called, a DESCARGA entry is added to the audit trail, and the PDF mock opens in a new window

### Requirement: DocumentConfidencialidadBadge
The `DocumentConfidencialidadBadge` component SHALL render a pill badge with a lucide-react icon and i18n label for each `DocConfidencialidad` value:
- `PUBLICO` → Globe icon, `bg-success/20 text-success`
- `INTERNO` → Building2 icon, `bg-teal/20 text-teal`
- `CONFIDENCIAL` → Lock icon, `bg-amber/20 text-amber`
- `RESTRINGIDO` → ShieldOff icon, `bg-error/20 text-error`

#### Scenario: PUBLICO badge uses success color and Globe icon
- **WHEN** `confidencialidad === 'PUBLICO'`
- **THEN** the badge renders with `bg-success/20 text-success` and a Globe icon

#### Scenario: RESTRINGIDO badge uses error color and ShieldOff icon
- **WHEN** `confidencialidad === 'RESTRINGIDO'`
- **THEN** the badge renders with `bg-error/20 text-error` and a ShieldOff icon

#### Scenario: Badge label uses i18n key
- **WHEN** the badge renders for any confidencialidad value
- **THEN** the visible text comes from `t('documents:confidencialidad.<VALUE>')`, not hardcoded Spanish

### Requirement: DocumentHistorial tab
The `DocumentHistorial` component SHALL display `historialVersiones` in descending order. Each entry SHALL show: versión badge, `StatusBadge`, publication date (Intl.DateTimeFormat with locale), autorId, and descripcionCambios. The current version SHALL have an additional "Versión actual" badge in coral. Entries SHALL be connected by a vertical timeline (border-l-2 border-hairline).

#### Scenario: Versions shown in descending order
- **WHEN** a document has multiple version history entries
- **THEN** the most recent version appears first in the timeline

#### Scenario: Current version badge displayed
- **WHEN** rendering the version that matches `documento.version`
- **THEN** a "Versión actual" badge in coral color is shown

#### Scenario: Timeline line connects all entries
- **WHEN** there are two or more history entries
- **THEN** a vertical line (border-l-2) visually connects them

### Requirement: DocumentAuditTrail tab
The `DocumentAuditTrail` component SHALL display `auditTrail` entries in descending order by timestamp. Each entry SHALL show: timestamp (Intl.DateTimeFormat with locale and timezone), realizadoPorNombre, role badge, accion, and diff fields (campoModificado, valorAnterior, valorNuevo). Entries SHALL include DESCARGA and VISUALIZACION actions (RN-DOC-008). Pagination SHALL load 20 entries at a time with a "Ver más" button. No additional API call is needed — it uses data already loaded from the document query.

#### Scenario: Audit trail shows most recent entries first
- **WHEN** a document has audit trail entries
- **THEN** the entry with the latest timestamp is displayed first

#### Scenario: DESCARGA entries appear in audit trail
- **WHEN** a PDF download has been registered
- **THEN** an audit trail entry with `accion: 'DESCARGA'` is visible

#### Scenario: VISUALIZACION entries appear in audit trail
- **WHEN** a file view has been registered
- **THEN** an audit trail entry with `accion: 'VISUALIZACION'` is visible

#### Scenario: Pagination loads next 20 entries on Ver más
- **WHEN** there are more than 20 audit trail entries and the user clicks "Ver más"
- **THEN** the next batch of up to 20 entries is appended to the displayed list

#### Scenario: No API call for audit trail
- **WHEN** the user clicks the Audit Trail tab
- **THEN** no new network request is made; the data comes from the already-loaded document object
