## ADDED Requirements

### Requirement: REVISION_PERIODICA_INICIADA y REVISION_PERIODICA_VENCIDA en el historial de estados
`DocumentHistorial` SHALL incluir `REVISION_PERIODICA_INICIADA` y `REVISION_PERIODICA_VENCIDA` en su conjunto de acciones relevantes (`ACCIONES_RELEVANTES`), mostrando el `motivo`/detalle de la entrada igual que las demás acciones con motivo.

#### Scenario: REVISION_PERIODICA_INICIADA aparece en el historial
- **WHEN** el `auditTrail` del documento tiene una entrada `REVISION_PERIODICA_INICIADA`
- **THEN** `DocumentHistorial` la muestra con su motivo ("Revisión programada...", "Revisión anticipada...", o "Revisión sin fecha programada")

#### Scenario: REVISION_PERIODICA_VENCIDA aparece en el historial
- **WHEN** el `auditTrail` del documento tiene una entrada `REVISION_PERIODICA_VENCIDA`
- **THEN** `DocumentHistorial` la muestra con el actor "Sistema" y la fecha de revisión vencida

## MODIFIED Requirements

### Requirement: DocumentDetailHeader contextual banners
The header SHALL render contextual banners:
- OBSOLETO banner (bg-error/10 border-error/30) when `estado === 'OBSOLETO'`.
- QE-vinculados banner (bg-amber/10 border-amber/30) when `qeVinculados.length > 0`, listing the linked QEs' `numero` (not raw ids — `qeVinculados` is a populated `QeVinculadoResumen[]`, see `document-types`).
- RESTRINGIDO info banner (bg-teal/10 border-teal/30) listing `rolesAutorizados` when `confidencialidad === 'RESTRINGIDO'`, visible only to users with role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`.
- Revisión periódica banner, visible to any user who can read the document, when `estado === 'PUBLICADO'` and `fechaRevisionProxima` is set:
  - Amber (bg-warning/10 border-warning/30), when the alert level (shared `getRevisionPeriodicaNivel` helper, `document-revision-periodica`) is `'proximo'`: "Pendiente de revisión periódica — vence el {fecha} (en N días)."
  - Red (bg-error/10 border-error/30), when the alert level is `'vencido'`: "Revisión periódica vencida desde el {fecha} (hace N días). Este documento sigue vigente, pero debe revisarse."
- Revisión periódica informational banner (bg-teal/10 border-teal/30), when `estado === 'EN_REVISION_PERIODICA'`: "En revisión periódica desde el {fecha}, iniciada por {nombre}" — fecha y nombre tomados de la entrada `REVISION_PERIODICA_INICIADA` más reciente del `auditTrail`.

The revisión periódica banners SHALL NOT include their own action button — the existing "Iniciar revisión periódica" button (`DocumentActionPanel`, gated to `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`) already renders next to the page title, visible alongside these banners.

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

#### Scenario: Amber banner for a PUBLICADO document within 30 days of its next review
- **WHEN** `documento.estado === 'PUBLICADO'` and `fechaRevisionProxima` is 20 days away
- **THEN** an amber banner shows the review date and "en 20 días"

#### Scenario: Red banner for an overdue PUBLICADO document
- **WHEN** `documento.estado === 'PUBLICADO'` and `fechaRevisionProxima` is in the past
- **THEN** a red banner shows the review date and "hace N días"

#### Scenario: Informational banner while EN_REVISION_PERIODICA
- **WHEN** `documento.estado === 'EN_REVISION_PERIODICA'`
- **THEN** a teal informational banner shows the date and `realizadoPorNombre` of the most recent `REVISION_PERIODICA_INICIADA` audit trail entry

#### Scenario: No revisión periódica banner outside PUBLICADO/EN_REVISION_PERIODICA
- **WHEN** `documento.estado` is `BORRADOR`, `EN_REVISION`, `EN_APROBACION` or `OBSOLETO`
- **THEN** none of the revisión periódica banners render, regardless of `fechaRevisionProxima`

### Requirement: DocumentAuditTrail section
The `DocumentAuditTrail` component SHALL render inside a collapsible panel, open by default, with a toggle trigger (`aria-expanded`, chevron icon), positioned as the last section on the page. Its content SHALL display `auditTrail` entries in descending order by timestamp, with the same visual pattern as `QEAuditTrail` (`QualityEventDetail` → "Historial de Auditoría"): a `divide-y` list where each entry is icon + text on the left, timestamp on the right, with no numbering or bullet markers beyond that layout. Each entry SHALL show:
- An icon on the left, mapped from `accion` via an icon lookup table analogous to `QEAuditTrail`'s `ACCION_ICONS`, reusing the same icon for semantically equivalent action types (an arrows icon for `ESTADO_CAMBIADO`, a pencil icon for `CAMPO_EDITADO`, a check/shield icon for `FIRMA_REGISTRADA`, a file-plus icon for `DOCUMENTO_CREADO`), a closest-semantic icon for M1-only types that have an obvious equivalent even without a QE counterpart (a download icon for `DESCARGA`/`DESCARGA_ARCHIVO_ORIGINAL`, an eye icon for `VISUALIZACION`), and a generic document/file icon as fallback for the remaining M1-specific action types with no direct or close semantic equivalent (`NUEVA_VERSION_INICIADA`, `REVISION_PERIODICA_CONFIRMADA`, `REVISION_PERIODICA_INICIADA`, `REVISION_PERIODICA_VENCIDA`, `DOCUMENTO_ELIMINADO`, `RESTAURADO`, `ARCHIVO_ORIGINAL_ACTUALIZADO`, `ARCHIVO_ORIGINAL_CONGELADO`, `ARCHIVO_ORIGINAL_COPIADO_A_VERSION`, `ARCHIVO_DISTRIBUCION_GENERADO`).
- A bold entry title/description above (accion label, including diff fields such as campoModificado/valorAnterior/valorNuevo when applicable) and `realizadoPorNombre` in secondary/muted text below — same typography as `QEAuditTrail`. `realizadoPorNombre` SHALL render as plain text for every entry, including the system actor ("Sistema") of automated entries — it SHALL NOT be resolved through `useUserNames`.
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

#### Scenario: System-generated entries show "Sistema" as the actor
- **WHEN** an audit trail entry was generated automatically (`accion: 'REVISION_PERIODICA_VENCIDA'`, `realizadoPorNombre: 'Sistema'`)
- **THEN** "Sistema" renders as plain text below the entry's description, exactly like a human actor's name — no user lookup is attempted
