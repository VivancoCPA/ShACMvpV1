# document-detail

Document detail page for M1 Control Documentario. Renders `/documentos/:id` as a single-column (`max-w-3xl`) layout: a unified header card (título, badges, metadata grid) with inline action buttons, followed by stacked sections in fixed order — Descripción y detalle → Historial de estados → Versiones (highlighted, non-collapsible) → Audit trail. Descripción, Historial, and Audit trail are collapsible panels, open by default. Implements contextual banners, confidencialidad badges, version history timeline, and audit trail pagination with visual parity to `QEAuditTrail`.

## Requirements

### Requirement: DocumentDetailPage layout and navigation
The system SHALL render `/documentos/:id` as a single-column layout (`max-w-3xl`, matching the layout used by `NonconformityDetailPage`, `IncidentDetailPage`, and `QualityEventDetail`): `DocumentDetailHeader` with the document title and inline action buttons, followed by stacked sections in this fixed order: Descripción y detalle → Historial de estados → Versiones → Audit trail. The page SHALL display a skeleton while loading and an `ErrorBoundary` on error. A "Volver a lista" button SHALL navigate to `/documentos`. There SHALL be no tab bar and no sticky right-column action panel.

#### Scenario: Detail page renders with correct layout
- **WHEN** a user navigates to `/documentos/:id` and the document loads successfully
- **THEN** the page shows a single scrollable column with header (title + inline actions) followed by the Descripción, Historial, Versiones, and Audit trail sections stacked in that order

#### Scenario: No tabs are rendered
- **WHEN** the document detail page renders
- **THEN** no tab navigation control (`Detalle | Historial | Audit Trail | Versiones`) is present in the DOM

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
The `DocumentDetailHeader` component SHALL render título, `StatusBadge`, `DocumentConfidencialidadBadge`, `RevisionSemaforo` (when applicable), and the metadata grid (Tipo, Versión, Área, Autor, Revisor, Aprobador, fechaEmision, fechaVigencia, fechaRevisionProxima) all inside a single unified card (`rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated`), matching the card pattern used by `QEHeaderSection` in `QualityEventDetail` — not as a bare, cardless block with a separately-carded metadata grid. Contextual banners (OBSOLETO, QE-vinculados, RESTRINGIDO) and the page's "Volver a lista" back-navigation remain outside this card. It SHALL show a `RevisionSemaforo` when `estado` is `PUBLICADO` or `EN_REVISION_PERIODICA`.

#### Scenario: Header renders as a single unified card
- **WHEN** the document detail page renders
- **THEN** the título, status/confidencialidad badges, and the metadata grid (Tipo, Versión, Área, Autor, Revisor, Aprobador) are all contained within one card element, not split across a cardless title block and a separate metadata card

#### Scenario: Header shows all document metadata
- **WHEN** a document loads with all optional fields populated
- **THEN** código, título, tipo, versión, área, autor, revisor, aprobador, and all dates are visible within the unified card

#### Scenario: RevisionSemaforo shown for PUBLICADO documents
- **WHEN** `documento.estado === 'PUBLICADO'`
- **THEN** `RevisionSemaforo` renders inside the header card

#### Scenario: Contextual banners remain outside the header card
- **WHEN** `documento.estado === 'OBSOLETO'`, `documento.qeVinculados.length > 0`, or `documento.confidencialidad === 'RESTRINGIDO'`
- **THEN** the corresponding banner renders above the unified header card, not inside it

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

### Requirement: DocumentHistorial section
The `DocumentHistorial` component SHALL render inside a collapsible panel, open by default, with a toggle trigger (`aria-expanded`, chevron icon) that shows/hides its content without unmounting the underlying query data. Its content SHALL display `historialVersiones` in descending order, together with a synthetic leading-state entry (see below). Each `historialVersiones` entry SHALL show: versión badge, `StatusBadge`, publication date (Intl.DateTimeFormat with locale), autorId, and descripcionCambios. The current version SHALL have an additional "Versión actual" badge in coral. Entries SHALL be connected by a vertical timeline (border-l-2 border-hairline).

The panel SHALL always include a synthetic "Creado en Borrador" entry (or the label matching the document's actual initial estado, should more than one become possible in the future), using the same `realizadoPorId`/`realizadoPorNombre` and `timestamp` as the document's `DOCUMENTO_CREADO` audit trail entry. This synthetic entry is merged into the same descending-by-date sort as `historialVersiones`: since it always carries the earliest timestamp (document creation), it sorts to the bottom once real version entries exist, and is the sole entry shown when `historialVersiones` is empty (replacing the prior empty "no history" state in that case). It does not replace or duplicate the `DOCUMENTO_CREADO` audit trail entry — that entry continues to exist independently in `DocumentAuditTrail`.

#### Scenario: Historial panel is open by default
- **WHEN** the document detail page first renders
- **THEN** the Historial section content is visible without additional user interaction

#### Scenario: Historial panel collapses on toggle click
- **WHEN** the user clicks the Historial section's toggle trigger while it is open
- **THEN** the section content is hidden and `aria-expanded` becomes `false`

#### Scenario: Versions shown in descending order
- **WHEN** a document has multiple version history entries
- **THEN** the most recent version appears first in the timeline

#### Scenario: Current version badge displayed
- **WHEN** rendering the version that matches `documento.version`
- **THEN** a "Versión actual" badge in coral color is shown

#### Scenario: Timeline line connects all entries
- **WHEN** there are two or more history entries
- **THEN** a vertical line (border-l-2) visually connects them

#### Scenario: Historial panel is never empty right after document creation
- **WHEN** a document is newly created and `historialVersiones` is still empty
- **THEN** the Historial section immediately shows a "Creado en Borrador" entry with the creating user and creation timestamp, instead of the "no history" empty state

#### Scenario: Synthetic creation entry uses the same author and timestamp as the audit trail
- **WHEN** the Historial section renders the synthetic "Creado en Borrador" entry
- **THEN** its author and timestamp match the document's `DOCUMENTO_CREADO` audit trail entry exactly

#### Scenario: Synthetic creation entry coexists with real version history
- **WHEN** a document has one or more `historialVersiones` entries in addition to its creation
- **THEN** the "Creado en Borrador" entry is still shown, positioned chronologically at the bottom of the descending timeline

### Requirement: DocumentVersionesTab highlighted card
The `DocumentVersionesTab` component SHALL render inside a permanently visible, non-collapsible card with a visually distinct accent border, positioned between the Historial and Audit trail sections. It SHALL have no collapse/expand toggle. A badge SHALL indicate the version currently being viewed as vigente, consistent with the "Versión actual" indicator already produced by `DocumentVersionesTab`.

#### Scenario: Versiones card has no toggle control
- **WHEN** the document detail page renders
- **THEN** the Versiones section has no chevron/toggle button and its content is always present in the DOM

#### Scenario: Versiones card is visually distinguished from collapsible sections
- **WHEN** the document detail page renders
- **THEN** the Versiones card has an accent border distinguishing it from the Descripción, Historial, and Audit trail panels

#### Scenario: Versiones card position
- **WHEN** the document detail page renders
- **THEN** the Versiones card appears after Historial and before Audit trail

### Requirement: DocumentAuditTrail section
The `DocumentAuditTrail` component SHALL render inside a collapsible panel, open by default, with a toggle trigger (`aria-expanded`, chevron icon), positioned as the last section on the page. Its content SHALL display `auditTrail` entries in descending order by timestamp, with the same visual pattern as `QEAuditTrail` (`QualityEventDetail` → "Historial de Auditoría"): a `divide-y` list where each entry is icon + text on the left, timestamp on the right, with no numbering or bullet markers beyond that layout. Each entry SHALL show:
- An icon on the left, mapped from `accion` via an icon lookup table analogous to `QEAuditTrail`'s `ACCION_ICONS`, reusing the same icon for semantically equivalent action types (an arrows icon for `ESTADO_CAMBIADO`, a pencil icon for `CAMPO_EDITADO`, a check/shield icon for `FIRMA_REGISTRADA`, a file-plus icon for `DOCUMENTO_CREADO`), a closest-semantic icon for M1-only types that have an obvious equivalent even without a QE counterpart (a download icon for `DESCARGA`/`DESCARGA_ARCHIVO_ORIGINAL`, an eye icon for `VISUALIZACION`), and a generic document/file icon as fallback for the remaining M1-specific action types with no direct or close semantic equivalent (`NUEVA_VERSION_INICIADA`, `REVISION_PERIODICA_CONFIRMADA`, `DOCUMENTO_ELIMINADO`, `RESTAURADO`, `ARCHIVO_ORIGINAL_ACTUALIZADO`, `ARCHIVO_ORIGINAL_CONGELADO`, `ARCHIVO_ORIGINAL_COPIADO_A_VERSION`, `ARCHIVO_DISTRIBUCION_GENERADO`).
- A bold entry title/description above (accion label, including diff fields such as campoModificado/valorAnterior/valorNuevo when applicable) and `realizadoPorNombre` in secondary/muted text below — same typography as `QEAuditTrail`.
- The timestamp (Intl.DateTimeFormat with locale and timezone) aligned to the right, same typography and color as `QEAuditTrail`'s timestamp.

Entries SHALL include DESCARGA and VISUALIZACION actions (RN-DOC-008). Pagination SHALL load 20 entries at a time with a "Ver más" button. No additional API call is needed — it uses data already loaded from the document query.

#### Scenario: Audit trail panel is open by default
- **WHEN** the document detail page first renders
- **THEN** the Audit trail section content is visible without additional user interaction

#### Scenario: Audit trail panel collapses on toggle click
- **WHEN** the user clicks the Audit trail section's toggle trigger while it is open
- **THEN** the section content is hidden and `aria-expanded` becomes `false`

#### Scenario: Audit trail is the last section on the page
- **WHEN** the document detail page renders
- **THEN** the Audit trail section appears after Descripción, Historial, and Versiones, with no section below it

#### Scenario: Audit trail shows most recent entries first
- **WHEN** a document has audit trail entries
- **THEN** the entry with the latest timestamp is displayed first

#### Scenario: Each entry shows an icon matched to its accion type
- **WHEN** an audit trail entry renders
- **THEN** an icon appears to its left, chosen from the accion-to-icon mapping (or the generic document/file icon when the accion has no direct QE equivalent)

#### Scenario: Entry layout matches QE — bold title, author below, timestamp right
- **WHEN** an audit trail entry renders
- **THEN** the entry's description is bold text above, `realizadoPorNombre` appears below it in secondary text, and the timestamp is right-aligned, with no bullet or numbering marker on the entry

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
- **WHEN** the audit trail section is expanded
- **THEN** no new network request is made; the data comes from the already-loaded document object
