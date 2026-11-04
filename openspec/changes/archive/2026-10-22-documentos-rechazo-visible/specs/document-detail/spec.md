## MODIFIED Requirements

### Requirement: DocumentDetailHeader contextual banners
The header SHALL render contextual banners:
- OBSOLETO banner (bg-error/10 border-error/30) when `estado === 'OBSOLETO'`.
- QE-vinculados banner (bg-amber/10 border-amber/30) when `qeVinculados.length > 0`, listing the linked QEs' `numero` (not raw ids — `qeVinculados` is a populated `QeVinculadoResumen[]`, see `document-types`).
- RESTRINGIDO info banner (bg-teal/10 border-teal/30) listing `rolesAutorizados` when `confidencialidad === 'RESTRINGIDO'`, visible only to users with role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`.
- Rechazo banner (bg-error/10 border-error/30) when `estado === 'BORRADOR'` and the most recent `auditTrail` entry among `accion` in (`RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION`, `REVISION_CANCELADA`) has `accion` `RECHAZADO_EN_REVISION` or `RECHAZADO_EN_APROBACION` — never for `REVISION_CANCELADA`. It SHALL show who rejected it (`realizadoPorNombre`), when (`timestamp`, Intl.DateTimeFormat with locale), and the full `motivo`. Visible to every role with read access to the document (author, Jefe Calidad, Jefe Control Documentario, and other read-only roles) — it is information about the document itself, not a restricted action.

#### Scenario: OBSOLETO banner appears for obsolete documents
- **WHEN** `documento.estado === 'OBSOLETO'`
- **THEN** a red banner with key `documents:detail.banners.obsoleto` is displayed

#### Scenario: QE-vinculados banner shows QE numbers
- **WHEN** `documento.qeVinculados` contains at least one linked QE
- **THEN** an amber banner lists each linked QE's `numero` (e.g. `QE-2026-014`), not its raw `id`

#### Scenario: RESTRINGIDO banner visible to authorized roles
- **WHEN** `documento.confidencialidad === 'RESTRINGIDO'` and the user has role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`
- **THEN** a teal banner listing `rolesAutorizados` is displayed

#### Scenario: RESTRINGIDO banner hidden from non-authorized roles
- **WHEN** `documento.confidencialidad === 'RESTRINGIDO'` and the user has role `JEFE_CALIDAD_SYST` or `AUDITOR_INTERNO`
- **THEN** the teal banner is NOT displayed

#### Scenario: Rejection banner appears after a rechazo with motivo
- **WHEN** `documento.estado === 'BORRADOR'` and the most recent of the three relevant entries is `accion: 'RECHAZADO_EN_REVISION'` or `'RECHAZADO_EN_APROBACION'`
- **THEN** a red banner is displayed showing who rejected it, when, and the full `motivo`

#### Scenario: Rejection banner does not appear for a mere cancellation
- **WHEN** `documento.estado === 'BORRADOR'` and the most recent of the three relevant entries is `accion: 'REVISION_CANCELADA'`
- **THEN** the rejection banner is NOT displayed

#### Scenario: Rejection banner disappears after resubmission
- **WHEN** the document is sent back to `EN_REVISION` after a rejection (a newer `ESTADO_CAMBIADO`/`EN_REVISION` entry now exists, and `documento.estado` is no longer `BORRADOR`)
- **THEN** the rejection banner is NOT displayed

#### Scenario: Rejection banner visible to read-only roles
- **WHEN** a user with read-only access to the document (e.g. `AUDITOR_INTERNO`) views a rejected `BORRADOR` document
- **THEN** the rejection banner is displayed to them the same as to the author or Jefe Calidad

### Requirement: DocumentHistorial section
The `DocumentHistorial` component SHALL render inside a collapsible panel, open by default, with a toggle trigger (`aria-expanded`, chevron icon) that shows/hides its content without unmounting the underlying query data. Its content SHALL display `historialVersiones` in descending order, together with a synthetic leading-state entry (see below). Each `historialVersiones` entry SHALL show: versión badge, `StatusBadge`, publication date (Intl.DateTimeFormat with locale), autorId, and descripcionCambios. The current version SHALL have an additional "Versión actual" badge in coral. Entries SHALL be connected by a vertical timeline (border-l-2 border-hairline).

The panel SHALL always include a synthetic "Creado en Borrador" entry (or the label matching the document's actual initial estado, should more than one become possible in the future), using the same `realizadoPorId`/`realizadoPorNombre` and `timestamp` as the document's `DOCUMENTO_CREADO` audit trail entry. This synthetic entry is merged into the same descending-by-date sort as `historialVersiones`: since it always carries the earliest timestamp (document creation), it sorts to the bottom once real version entries exist, and is the sole entry shown when `historialVersiones` is empty (replacing the prior empty "no history" state in that case). It does not replace or duplicate the `DOCUMENTO_CREADO` audit trail entry — that entry continues to exist independently in `DocumentAuditTrail`.

The panel's set of relevant `auditTrail` actions (merged with the synthetic entry above) SHALL include `RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION`, and `REVISION_CANCELADA` alongside the existing ones (`DOCUMENTO_CREADO`, `ESTADO_CAMBIADO`, `FIRMA_REGISTRADA`, `NUEVA_VERSION_INICIADA`, `RESTAURADO`). When one of these three actions renders, its `motivo` (if present) SHALL be shown beneath the entry's description.

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

#### Scenario: Historial shows the rejection label and motivo
- **WHEN** the Historial section renders an entry with `accion: 'RECHAZADO_EN_REVISION'` or `'RECHAZADO_EN_APROBACION'` that has a `motivo`
- **THEN** the entry shows the localized rejection label and the `motivo` text beneath it

#### Scenario: Historial shows the cancellation label without a motivo
- **WHEN** the Historial section renders an entry with `accion: 'REVISION_CANCELADA'`
- **THEN** the entry shows the localized "Revisión cancelada" label and no motivo text

### Requirement: DocumentAuditTrail section
The `DocumentAuditTrail` component SHALL render inside a collapsible panel, open by default, with a toggle trigger (`aria-expanded`, chevron icon), positioned as the last section on the page. Its content SHALL display `auditTrail` entries in descending order by timestamp, with the same visual pattern as `QEAuditTrail` (`QualityEventDetail` → "Historial de Auditoría"): a `divide-y` list where each entry is icon + text on the left, timestamp on the right, with no numbering or bullet markers beyond that layout. Each entry SHALL show:
- An icon on the left, mapped from `accion` via an icon lookup table analogous to `QEAuditTrail`'s `ACCION_ICONS`, reusing the same icon for semantically equivalent action types (an arrows icon for `ESTADO_CAMBIADO`, a pencil icon for `CAMPO_EDITADO`, a check/shield icon for `FIRMA_REGISTRADA`, a file-plus icon for `DOCUMENTO_CREADO`), a closest-semantic icon for M1-only types that have an obvious equivalent even without a QE counterpart (a download icon for `DESCARGA`/`DESCARGA_ARCHIVO_ORIGINAL`, an eye icon for `VISUALIZACION`), a distinguishable rejection/cancel icon (e.g. an X-circle) for `RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION`, and `REVISION_CANCELADA` — distinct from the `ESTADO_CAMBIADO` arrows icon — and a generic document/file icon as fallback for the remaining M1-specific action types with no direct or close semantic equivalent (`NUEVA_VERSION_INICIADA`, `REVISION_PERIODICA_CONFIRMADA`, `DOCUMENTO_ELIMINADO`, `RESTAURADO`, `ARCHIVO_ORIGINAL_ACTUALIZADO`, `ARCHIVO_ORIGINAL_CONGELADO`, `ARCHIVO_ORIGINAL_COPIADO_A_VERSION`, `ARCHIVO_DISTRIBUCION_GENERADO`).
- A bold entry title/description above (accion label, including diff fields such as campoModificado/valorAnterior/valorNuevo when applicable, and the `motivo` — when present — shown as a separate line beneath the description for `RECHAZADO_EN_REVISION`/`RECHAZADO_EN_APROBACION`/`REVISION_CANCELADA`) and `realizadoPorNombre` in secondary/muted text below — same typography as `QEAuditTrail`.
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

#### Scenario: RECHAZADO_EN_REVISION entry shows its own icon, label and motivo
- **WHEN** an audit trail entry with `accion: 'RECHAZADO_EN_REVISION'` and a `motivo` renders
- **THEN** it shows the rejection icon, the localized "Rechazado en revisión" label, and the `motivo` text beneath the description

#### Scenario: RECHAZADO_EN_APROBACION entry shows its own icon, label and motivo
- **WHEN** an audit trail entry with `accion: 'RECHAZADO_EN_APROBACION'` and a `motivo` renders
- **THEN** it shows the rejection icon, the localized "Rechazado en aprobación" label, and the `motivo` text beneath the description

#### Scenario: REVISION_CANCELADA entry shows its own icon and label without a motivo line
- **WHEN** an audit trail entry with `accion: 'REVISION_CANCELADA'` renders
- **THEN** it shows the rejection icon, the localized "Revisión cancelada" label, and no motivo line beneath the description
