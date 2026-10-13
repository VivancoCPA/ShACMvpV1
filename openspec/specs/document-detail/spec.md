# document-detail

Document detail page for M1 Control Documentario. Renders `/documentos/:id` as a two-column layout from the `xl` breakpoint (≥1280px) upward — a wide container (`max-w-[1440px]`) with a tabbed content area (Resumen, Historial, Versiones, Vínculos, Copias (conditional on a feature flag), Log) on the left and a fixed sidebar (acciones de lectura, ficha de metadatos, actividad reciente) on the right. Below `xl` it collapses to a single column with the sidebar shown first (visually, via CSS `order`) while the tabbed content remains first in DOM order. `DocumentDetailHeader` (título, badges, management actions) stays `sticky top-0` while scrolling; contextual banners render in a full-width strip below it, outside the sticky element. Implements confidencialidad badges, a shared `useDocumentActionsAvailability` hook for action visibility (consumed by both the header and the sidebar), and audit trail pagination with visual parity to `QEAuditTrail`.

## Requirements

### Requirement: DocumentDetailPage layout and navigation
The system SHALL render `/documentos/:id` as a two-column layout from the `xl` breakpoint (≥1280px) upward: a wide container (`max-w-[1440px]`, `px-8`) with `grid grid-cols-[minmax(0,1fr)_340px] gap-6 items-start`. The left column renders a tabbed content area (see "DocumentDetailPage tab navigation and URL sync"); the right column renders the fixed sidebar (see "Sidebar ficha metadata card" and related requirements). Below `xl`, the layout collapses to a single column (`grid-cols-1`) with the sidebar appearing visually before the tabbed content via CSS `order` (matching the reference mockup's own `order:-1` media query) — the underlying DOM order keeps the tabbed content before the sidebar, so assistive technology reaches the main content first. At no width does the page scroll horizontally — any table wider than its tab panel scrolls within its own `overflow-x-auto` container, never the page body. The page SHALL display a skeleton while loading and an `ErrorBoundary` on error. A "Volver a lista" control SHALL navigate to `/documentos`.

#### Scenario: Detail page renders two columns at xl and above
- **WHEN** a user navigates to `/documentos/:id` on a viewport ≥1280px wide and the document loads successfully
- **THEN** the page shows a left column with the tabbed content and a right column with the sidebar, side by side

#### Scenario: Detail page collapses to one column below xl, sidebar first
- **WHEN** the viewport is narrower than 1280px
- **THEN** the layout renders a single column where the sidebar appears visually before the tabbed content (via CSS `order`), even though it follows the tabbed content in DOM order

#### Scenario: No page-level horizontal scroll
- **WHEN** a tab panel contains a table wider than the viewport (e.g. Versiones or Log)
- **THEN** only that table's own container scrolls horizontally; the page body does not

#### Scenario: Skeleton shown during loading
- **WHEN** the document query is in `isLoading` state
- **THEN** a skeleton placeholder is rendered instead of the content

#### Scenario: ErrorBoundary shown on fetch error
- **WHEN** the document query returns an error
- **THEN** the `ErrorBoundary` renders an error state (not a blank page or unhandled crash)

#### Scenario: Back button navigates to list
- **WHEN** the user clicks "Volver a lista"
- **THEN** the router navigates to `/documentos`

### Requirement: DocumentDetailPage tab navigation and URL sync
The left column SHALL render a tab list (`role="tablist"`) with, in order: Resumen, Historial (n), Versiones (n), Vínculos (n), Copias (n, only when its feature flag is enabled — see "Copias tab is gated behind a feature flag"), Log (n). Each count badge SHALL reflect the number of items in that tab's underlying collection (`historialVersiones.length` + synthetic entry, `historialVersiones.length`, `qeVinculados.length + ncVinculados.length`, copias count, `auditTrail.length`). The active tab SHALL be synchronized to the `?tab=` query parameter (`resumen` default; `historial` | `versiones` | `vinculos` | `log`, plus `copias` only when enabled); an unrecognized or absent value falls back to `resumen`. Switching tabs SHALL update `?tab=` via `replace` navigation (no new browser history entry per tab click). Tab triggers SHALL support arrow-key navigation and expose `aria-selected`; each panel SHALL have `role="tabpanel"`. A tab with no items SHALL render an explicit empty-state message, never a blank panel. The existing `initialAction=iniciar-revision` query parameter (opening the periodic-review modal) SHALL continue to work independently of `?tab=`.

#### Scenario: Tabs render in the specified order with counts
- **WHEN** the document detail page renders for a document with linked QEs, NCs, and audit trail entries
- **THEN** the tab list shows Resumen, Historial, Versiones, Vínculos, (Copias if enabled), Log, each count badge matching its collection's length

#### Scenario: Active tab follows ?tab= on direct navigation
- **WHEN** a user opens `/documentos/:id?tab=log`
- **THEN** the Log tab is active and its panel is visible on first render

#### Scenario: Switching tabs updates the URL without growing history
- **WHEN** the user clicks the Versiones tab
- **THEN** `?tab=versiones` is reflected in the URL via a `replace` navigation, and the browser's back button does not step through each prior tab click

#### Scenario: Arrow keys move focus between tabs
- **WHEN** a tab trigger has focus and the user presses the right arrow key
- **THEN** focus moves to the next tab trigger in the list

#### Scenario: Invalid tab value falls back to Resumen
- **WHEN** a user opens `/documentos/:id?tab=no-existe`
- **THEN** the Resumen tab is active

#### Scenario: initialAction still opens the periodic review modal independently of tabs
- **WHEN** a user opens `/documentos/:id?action=iniciar-revision` as `JEFE_CALIDAD_SYST` on a `PUBLICADO` document
- **THEN** the periodic review modal opens regardless of which tab is active

#### Scenario: Empty tab shows an explicit empty state
- **WHEN** a document has no linked QEs or NCs and the user opens the Vínculos tab
- **THEN** the panel shows an empty-state message, not a blank area

### Requirement: Copias tab is gated behind a feature flag
The Copias tab (and its count badge) SHALL only appear in the tab list when a feature flag (`DOCUMENT_DETAIL_COPIAS_TAB_ENABLED`) is `true`. As of this change, the flag is `false` because the `copias-controladas` capability it depends on does not yet exist in the codebase (no active or archived change, no spec). The flag is a single exported constant with a comment pointing to this capability's design rationale, intended to be flipped by whichever change implements `copias-controladas`.

#### Scenario: Copias tab is absent while the flag is off
- **WHEN** `DOCUMENT_DETAIL_COPIAS_TAB_ENABLED` is `false`
- **THEN** no "Copias" entry appears in the tab list for any user or document state

#### Scenario: Flipping the flag reveals the tab without other code changes
- **WHEN** `DOCUMENT_DETAIL_COPIAS_TAB_ENABLED` is changed to `true` (by a future change that also supplies the Copias tab's content)
- **THEN** the tab list includes "Copias" with its count badge, requiring no change to the tab-list rendering logic itself

### Requirement: DocumentDetailHeader information display
`DocumentDetailHeader` SHALL render `sticky top-0` with a `canvas` background and a `hairline` bottom border, remaining visible while the page scrolls. It SHALL contain: a breadcrumb (Documentos / código), código (monospace), título, `StatusBadge`, `DocumentConfidencialidadBadge`, version pill, and — when applicable — `RevisionSemaforo`, plus the page's management actions (see "DocumentDetailHeader management actions"). The full metadata grid (Tipo, Área, fechas, Autor/Revisor/Aprobador) previously rendered inside this header moves to the sidebar's ficha card (see "Sidebar ficha metadata card") and is no longer duplicated in the header. It SHALL show `RevisionSemaforo` when `estado` is `PUBLICADO` or `EN_REVISION_PERIODICA`.

#### Scenario: Header stays fixed while scrolling
- **WHEN** the user scrolls down the document detail page
- **THEN** `DocumentDetailHeader` remains visible at the top of the viewport (`position: sticky`)

#### Scenario: Header shows título and status/confidencialidad/version pills
- **WHEN** the document detail page renders
- **THEN** código, título, `StatusBadge`, `DocumentConfidencialidadBadge`, and the version pill are all visible within the sticky header

#### Scenario: Header no longer renders the metadata grid
- **WHEN** the document detail page renders
- **THEN** Tipo, Área, Autor, Revisor, Aprobador, and the date fields are not rendered inside `DocumentDetailHeader` — they appear only in the sidebar ficha card

#### Scenario: RevisionSemaforo shown for PUBLICADO documents
- **WHEN** `documento.estado === 'PUBLICADO'`
- **THEN** `RevisionSemaforo` renders inside the sticky header

#### Scenario: RevisionSemaforo shown for EN_REVISION_PERIODICA documents
- **WHEN** `documento.estado === 'EN_REVISION_PERIODICA'`
- **THEN** `RevisionSemaforo` renders in the header

#### Scenario: RevisionSemaforo hidden for non-active states
- **WHEN** `documento.estado` is `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, or `OBSOLETO`
- **THEN** `RevisionSemaforo` is not rendered

### Requirement: DocumentDetailHeader contextual banners
Contextual banners (OBSOLETO, QE-vinculados, RESTRINGIDO, falta de asignación, revisión próxima/vencida/en curso, rechazo) SHALL render in a full-width strip immediately below the sticky header, inside the scrollable content area (`grid-column: 1 / -1` within the page's grid) — never inside the sticky header itself and never sticky. They scroll away with the page content instead of occupying permanent screen space.
- OBSOLETO banner (bg-error/10 border-error/30) when `estado === 'OBSOLETO'`.
- QE-vinculados banner (bg-amber/10 border-amber/30) when `qeVinculados.length > 0`, listing the linked QEs' `numero` (not raw ids — `qeVinculados` is a populated `QeVinculadoResumen[]`, see `document-types`).
- RESTRINGIDO info banner (bg-teal/10 border-teal/30) listing `rolesAutorizados` when `confidencialidad === 'RESTRINGIDO'`, visible only to users with role `JEFE_CONTROL_DOCUMENTARIO` or `ALTA_DIRECCION`.

#### Scenario: Banners render below the sticky header, not inside it
- **WHEN** the document detail page renders with at least one applicable banner
- **THEN** the banner strip appears below `DocumentDetailHeader` in the DOM, spans the full content width, and is not part of the `sticky` element

#### Scenario: Banners scroll away with page content
- **WHEN** the user scrolls down past the banner strip
- **THEN** the banners scroll out of view while the header above them remains fixed

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

### Requirement: DocumentDetailHeader file access buttons
The system SHALL render the document's read actions in the sidebar's "Acciones de lectura" card (corrected from an earlier, stale version of this requirement that described three actions named "Ver documento"/"Ver archivo"/"Exportar PDF controlado" and placed them in `DocumentActionPanel` as an inline row — the real code only ever had two actions, now renamed and relocated; the requirement name is kept unchanged so archiving replaces it correctly):

- **"Ver documento"** (primary action, full-width button): visible whenever `getDocumentPermissions(estado, docRole).canRead` is true for the current user — including the CA-34 exception for `OBSOLETO` documents (`document-viewer-api`) — and gated by confidencialidad access (`canAccessDocument`). Opens the embedded `DocumentViewer` (`document-viewer`) in a modal, without leaving the page. Does not require `documento.archivoUrl` to be present.
- **"Descargar copia (PDF)"** (secondary action, full-width button, with a help line explaining it is an uncontrolled copy): visible when `(estado === 'PUBLICADO' || estado === 'EN_REVISION_PERIODICA') && hasFileAccess && perms.canRead`. Shows a cosmetic metadata-preview confirmation modal, then downloads the returned watermarked, hashed PDF blob via `<a download>`. The backend registers `DESCARGA` in the audit trail — the frontend makes no separate audit call.
- **"Emitir copia controlada"**: additionally visible to `JEFE_CONTROL_DOCUMENTARIO` only when the `copias-controladas` tab feature flag is enabled (see "Copias tab is gated behind a feature flag") — while the flag is off, this button is not rendered at all.

Both always-available actions SHALL render as full-width buttons stacked vertically in the sidebar's first card, "Ver documento" visually emphasized (primary button style) over "Descargar copia (PDF)" (secondary/outline style). Visibility conditions for both are unchanged from before this redesign — only their location and the corrected naming change.

#### Scenario: Both actions visible when access allows
- **WHEN** the user has confidencialidad access, `canRead` is true, and the document is `PUBLICADO`
- **THEN** "Ver documento" and "Descargar copia (PDF)" are both visible in the sidebar's first card, with "Ver documento" visually emphasized

#### Scenario: Ver documento visible for the aprobador in EN_APROBACION even though Descargar copia is not
- **WHEN** the `docRole APROBADOR` assigned to a document in `EN_APROBACION` views the detail page
- **THEN** "Ver documento" is visible; "Descargar copia (PDF)" is not (it requires `estado` to be `PUBLICADO` or `EN_REVISION_PERIODICA`)

#### Scenario: Ver documento hidden when canRead is false
- **WHEN** a user whose `(estado, docRole)` combination yields `canRead: false` views the document detail page
- **THEN** "Ver documento" is not rendered in the sidebar

#### Scenario: Read actions hidden when user lacks confidencialidad access
- **WHEN** the document's `confidencialidad` is `CONFIDENCIAL` and the user's role is `OPERARIO`
- **THEN** neither "Ver documento" nor "Descargar copia (PDF)" is rendered

#### Scenario: Descargar copia downloads a blob and is audited server-side
- **WHEN** the user confirms "Descargar copia (PDF)"
- **THEN** a watermarked PDF blob downloads via `<a download>`, and the document's audit trail gains a `DESCARGA` entry registered by the backend

#### Scenario: Ver documento triggers no separate audit call from the frontend
- **WHEN** the user clicks "Ver documento" and the embedded viewer loads successfully
- **THEN** the frontend does not call any separate audit endpoint — `GET /:id/visor` registers its own `VISUALIZACION` entry server-side (see `document-viewer-api`)

### Requirement: DocumentDetailHeader management actions
`DocumentDetailHeader` SHALL render the document's management actions — nueva versión, enviar a revisión, aprobar, rechazar, firmar, iniciar revisión periódica, cancelar revisión periódica, eliminar — sourced from `useDocumentActionsAvailability(documento, user)`, a hook extracted unchanged (no permission logic altered) from the booleans previously computed inline in `DocumentActionPanel`. At most 2 buttons render inline in the header, chosen by this fixed priority order (highest first): firmar (`canSign`) > aprobar (`canApproveReview`) > rechazar (`canRejectReview || canRejectAprobacion`) > enviar a revisión (`canSendToReview` or its disabled variant `canSendToReviewBloqueadoPorAsignacion`) > continuar revisión periódica con nueva versión (`canStartNewVersion`) > nueva versión (`canCreateVersion`) > iniciar revisión periódica (`canStartPeriodic`) > cancelar revisión periódica (`canCancelReview`) > eliminar (`canDelete`). Any further available action renders as an item in an overflow menu button labeled "⋯". When no management action is available, neither the inline buttons nor the "⋯" menu render. The resulting set of available actions (inline + overflow) for any given `(estado, rol)` combination SHALL be identical to the set `DocumentActionPanel` exposed before this redesign — only the split between "visible inline" and "behind ⋯" is new.

#### Scenario: At most two management actions render inline
- **WHEN** a document in `PUBLICADO` has both `canCreateVersion` and `canStartPeriodic` available to the current user
- **THEN** both render as inline buttons in the header (2 or fewer available → none overflow)

#### Scenario: Lower-priority actions overflow into the ⋯ menu
- **WHEN** more than 2 management actions are available for the current `(estado, rol)`
- **THEN** the 2 highest-priority actions render inline and the rest appear inside the "⋯" menu

#### Scenario: No management actions available renders neither buttons nor menu
- **WHEN** `useDocumentActionsAvailability` resolves no management action as available for the current user
- **THEN** no inline button and no "⋯" menu render in the header

#### Scenario: Action set parity with the pre-redesign DocumentActionPanel
- **WHEN** the same `(estado, docRole)` fixture used by the pre-redesign `DocumentActionPanel` tests is rendered in the new header + sidebar
- **THEN** the union of inline buttons, "⋯" menu items, and sidebar read actions is identical to what `DocumentActionPanel` rendered before this redesign

### Requirement: useDocumentActionsAvailability shared hook
The system SHALL export `useDocumentActionsAvailability(documento: Documento, user: User | null)` from the documents feature (e.g. `hooks/useDocumentActionsAvailability.ts`), returning the same boolean/derived flags previously computed inline inside `DocumentActionPanel` (`canVerDocumento`, `canDescargarCopia`, `canSendToReview`, `canSendToReviewBloqueadoPorAsignacion`, `canApproveReview`, `canRejectReview`, `canCancelReview`, `canSign`, `canRejectAprobacion`, `canStartPeriodic`, `canCreateVersion`, `canStartNewVersion`, `canDelete`, `otraVersionEnProceso`, `hasAnyAction`), with identical conditions — this is an extraction, not a behavior change. Both `DocumentDetailHeader` (management actions) and the sidebar (read actions) SHALL consume this single hook instead of each recomputing their own subset of these conditions.

#### Scenario: Hook output matches pre-extraction inline computation
- **WHEN** `useDocumentActionsAvailability` is called with the same `(documento, user)` pair previously used in a `DocumentActionPanel` test fixture
- **THEN** every returned flag has the same value the inline computation produced before this redesign

#### Scenario: Header and sidebar consume the same hook instance's logic
- **WHEN** the document detail page renders
- **THEN** no permission/availability condition from this list is computed a second time independently inside `DocumentDetailHeader` or the sidebar components

### Requirement: Sidebar ficha metadata card
The sidebar's second card ("Ficha") SHALL render, in a two-column grid: Versión vigente and Publicado (the date of the most recent `PUBLICADO` transition found in `auditTrail`, or "—" if the document has never been published); Tipo and Área; Próx. revisión and Confidencialidad; and a "Responsables" block listing autor, revisor, and aprobador, each with `UserAvatar` (photo if `getUser(id)?.avatarUrl` resolves, initials fallback otherwise), the resolved name (`getName`), and their role label in the document. When `revisorId` or `aprobadorId` is absent, that row SHALL show "Sin asignar" in muted text instead of an avatar/name pair.

#### Scenario: Ficha shows versión vigente and publication date
- **WHEN** a `PUBLICADO` document's sidebar renders
- **THEN** "Versión vigente" shows `documento.version` and "Publicado" shows the date of its most recent `PUBLICADO` transition

#### Scenario: Publicado shows a dash when never published
- **WHEN** a `BORRADOR` document that has never been published renders its sidebar
- **THEN** "Publicado" shows "—"

#### Scenario: Responsables show avatar and name
- **WHEN** the document has `autorId`, `revisorId`, and `aprobadorId` all set, and `getUser` resolves all three
- **THEN** each responsable row shows a `UserAvatar` (photo or initials), the resolved name, and a role label

#### Scenario: Missing revisor or aprobador shows Sin asignar
- **WHEN** `documento.revisorId` is not set
- **THEN** the revisor row shows "Sin asignar" in muted text instead of an avatar

#### Scenario: Avatar falls back to initials when no photo or on load failure
- **WHEN** `getUser(id)?.avatarUrl` is absent, or the `<img>` fails to load
- **THEN** `UserAvatar` renders the person's initials instead of a broken image

### Requirement: Sidebar actividad reciente
The sidebar's third card ("Actividad reciente") SHALL render the 5 most recent entries of `documento.auditTrail` (already loaded with the document, no new query), each as one line: `{nombre} {acción}` and a relative-time label ("hace 5 min", "ayer", or the absolute date beyond 2 days). It SHALL include a "Ver log" link that switches the active tab to Log (updating `?tab=log`).

#### Scenario: Shows the 5 most recent entries
- **WHEN** a document has more than 5 audit trail entries
- **THEN** only the 5 most recent (by timestamp, descending) are shown

#### Scenario: Relative time formatting
- **WHEN** an entry's timestamp is 5 minutes in the past
- **THEN** its label reads the equivalent of "hace 5 min" (localized)

#### Scenario: Ver log opens the Log tab
- **WHEN** the user clicks "Ver log"
- **THEN** the active tab switches to Log and `?tab=log` is reflected in the URL

#### Scenario: Updates without a new fetch when the detail refreshes
- **WHEN** the document detail query is invalidated and refetched (e.g. after downloading a copy)
- **THEN** "Actividad reciente" reflects the new audit trail entries without the page issuing any request beyond the existing document detail query

### Requirement: Reemplazar archivo original dedicated action (RN-DOC-018)
The "Reemplazar archivo original" button in the document detail page's archivo section SHALL open a dedicated modal scoped exclusively to uploading a replacement for the archivo original file — it SHALL NOT navigate to `/documents/:id/edit`, nor expose any other document metadata field (título, tipo, área, etc.). The button and modal SHALL be available when the document `estado` is `BORRADOR` or `EN_REVISION` (RN-DOC-018), gated by `perms.canReplaceArchivoOriginal` — which is `true` only for `docRole` `AUTOR` or `JEFE_CALIDAD`; `REVISOR` and `APROBADOR` never see this button, in any estado. If the document already has an `archivoOriginalUrl`, the modal SHALL display the existing file's name before accepting a new upload, making clear the action replaces the current file. On successful replacement, the system SHALL append an `ARCHIVO_ORIGINAL_ACTUALIZADO` entry to the document's `auditTrail`, recording the previous file's name — the same behavior already validated for the prior in-form replacement flow (CA-31 of ADD-02). The full document edit form (`/documents/:id/edit`) remains available only for `BORRADOR` documents and is no longer responsible for uploading or replacing the archivo original.

#### Scenario: Reemplazar archivo original opens a dedicated modal, not the edit route (CA-DOC-5)
- **WHEN** a user with `canReplaceArchivoOriginal` clicks "Reemplazar archivo original" on a document in `BORRADOR` or `EN_REVISION`
- **THEN** a dedicated modal opens showing only the file upload control, and the router does not navigate to `/documents/:id/edit`

#### Scenario: Only Autor and Jefe de Calidad see the replace button (CA-DOC-6)
- **WHEN** a user whose `docRole` is `REVISOR` or `APROBADOR` views a document's archivo original section, in any estado
- **THEN** the "Reemplazar archivo original" button is not rendered

#### Scenario: Successful replacement registers audit trail entry (CA-DOC-7)
- **WHEN** a user completes a replacement via the dedicated modal
- **THEN** an `ARCHIVO_ORIGINAL_ACTUALIZADO` entry is appended to `auditTrail`, recording the previous file's name

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
`DocumentHistorial` SHALL render as the content of the Historial tab panel — no longer inside a collapsible accordion with its own toggle. Its content and data source are unchanged by this redesign: it derives a reverse-chronological list directly from `documento.auditTrail`, filtered to a fixed set of relevant `accion` values (`DOCUMENTO_CREADO`, `ESTADO_CAMBIADO`, `FIRMA_REGISTRADA`, `NUEVA_VERSION_INICIADA`, `RESTAURADO`, `RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION`, `REVISION_CANCELADA`, `REVISION_PERIODICA_INICIADA`, `REVISION_PERIODICA_VENCIDA`) — never a `historialVersiones` field (that field does not exist on the real `Documento` type; see `getHistorialEntries`, exported from `DocumentHistorial.tsx` for the tab's count badge). Each entry shows its timestamp, a description (the `ESTADO_CAMBIADO` case additionally shows `estadoAnterior → estadoNuevo`), `realizadoPorNombre`, and `motivo` when present, connected by a vertical timeline. An empty list shows `auditTrail.noEntries`.

*(Nota: la versión anterior de este requirement describía una entrada sintética "Creado en Borrador" y badges de versión que no existen en el código real de `DocumentHistorial.tsx` — ver design.md de `detalle-documento-dos-columnas`, "Hallazgo adicional durante la implementación". Este requirement quedó corregido durante ese change para reflejar el componente real.)*

#### Scenario: Historial tab shows content with no collapse toggle
- **WHEN** the user opens the Historial tab
- **THEN** the content is immediately visible with no `aria-expanded` toggle control

#### Scenario: Entries shown in descending order
- **WHEN** a document has multiple relevant audit trail entries
- **THEN** the most recent entry appears first in the timeline

#### Scenario: Timeline line connects all entries
- **WHEN** there are two or more history entries
- **THEN** a vertical line (border-l-2) visually connects them

#### Scenario: Empty state when no relevant entries exist
- **WHEN** `documento.auditTrail` has no entry matching the relevant `accion` set
- **THEN** the Historial tab shows the `auditTrail.noEntries` empty-state message

#### Scenario: Tab count matches the number of entries actually rendered
- **WHEN** the Historial tab's count badge is computed
- **THEN** it equals `getHistorialEntries(documento).length`, the same filtered list `DocumentHistorial` renders — never `documento.historialVersiones` (which does not exist)

### Requirement: DocumentVersionesTab highlighted card
`DocumentVersionesTab` SHALL render as the content of its own Versiones tab panel — no longer a permanently-visible highlighted card positioned between Historial and Audit trail sections, since those sections are now tabs of their own. A badge SHALL indicate the version currently being viewed as vigente, consistent with the "Versión actual" indicator already produced by `DocumentVersionesTab`.

#### Scenario: Versiones renders as a tab panel, not an always-visible card
- **WHEN** the document detail page renders
- **THEN** `DocumentVersionesTab`'s content is only visible while the Versiones tab is active, like any other tab panel

#### Scenario: Versiones tab shows the vigente indicator
- **WHEN** the Versiones tab is active
- **THEN** the version matching `documento.version` shows the "Versión actual" indicator

### Requirement: QE vinculados section on DocumentDetailPage
The Vínculos tab panel SHALL render a "QE vinculados" subsection — no longer its own standalone collapsible section on the page — listing every QE in `documento.qeVinculados` (número, tipo, severidad, estado — using the same `StatusBadge` used elsewhere for QE state) plus the shared linking combobox (`documento-qe-vinculacion`) to add more. It SHALL render above the "NC vinculadas" subsection within the same tab panel.

#### Scenario: Section lists linked QEs with their status
- **WHEN** a document has 2 linked QEs
- **THEN** the Vínculos tab's QE subsection renders 2 rows, each showing `numero`, `tipo`, `severidad`, and a `StatusBadge` for `estado`

#### Scenario: Section shows an empty state with no linked QEs
- **WHEN** a document has no linked QEs
- **THEN** the QE subsection renders without error, showing an empty-state message instead of a list

#### Scenario: Combobox to add a QE is visible only with edit permission
- **WHEN** the current user has `CanEdit` permission on the document (per `documento-qe-vinculacion`)
- **THEN** the combobox to search and link a new QE is rendered

#### Scenario: Combobox to add a QE is hidden without edit permission
- **WHEN** the current user lacks `CanEdit` permission on the document (e.g. the document is `PUBLICADO`)
- **THEN** the combobox is not rendered, but the read-only list of linked QEs still is

### Requirement: NC vinculadas section on DocumentDetailPage
The Vínculos tab panel SHALL render an "NC vinculadas" subsection immediately after the "QE vinculados" subsection, within the same tab panel — no longer its own standalone collapsible section on the page — listing every NC in `documento.ncVinculados` (número, tipo, severidad, estado — using the same `StatusBadge` used elsewhere for NC state) plus a combobox (`documento-nc-vinculacion`) to add more.

#### Scenario: Section lists linked NCs with their status
- **WHEN** a document has 2 linked NCs
- **THEN** the Vínculos tab's NC subsection renders 2 rows, each showing `numero`, `tipo`, `severidad`, and a `StatusBadge` for `estado`

#### Scenario: Section shows an empty state with no linked NCs
- **WHEN** a document has no linked NCs
- **THEN** the NC subsection renders without error, showing an empty-state message instead of a list

#### Scenario: Combobox to add an NC is visible only with edit permission
- **WHEN** the current user has `CanEdit` permission on the document (per `documento-nc-vinculacion`)
- **THEN** the combobox to search and link a new NC is rendered

#### Scenario: Combobox to add an NC is hidden without edit permission
- **WHEN** the current user lacks `CanEdit` permission on the document (e.g. the document is `PUBLICADO`)
- **THEN** the combobox is not rendered, but the read-only list of linked NCs still is

### Requirement: DocumentAuditTrail section
`DocumentAuditTrail` SHALL render as the content of the Log tab panel — the last tab in the tab list, no longer a collapsible panel on the page itself. Its content SHALL display `auditTrail` entries in descending order by timestamp, with the same visual pattern as `QEAuditTrail` (`QualityEventDetail` → "Historial de Auditoría"): a `divide-y` list where each entry is icon + text on the left, timestamp on the right, with no numbering or bullet markers beyond that layout. Each entry SHALL show:
- An icon on the left, mapped from `accion` via an icon lookup table analogous to `QEAuditTrail`'s `ACCION_ICONS`, reusing the same icon for semantically equivalent action types (an arrows icon for `ESTADO_CAMBIADO`, a pencil icon for `CAMPO_EDITADO`, a check/shield icon for `FIRMA_REGISTRADA`, a file-plus icon for `DOCUMENTO_CREADO`), a closest-semantic icon for M1-only types that have an obvious equivalent even without a QE counterpart (a download icon for `DESCARGA`/`DESCARGA_ARCHIVO_ORIGINAL`, an eye icon for `VISUALIZACION`), and a generic document/file icon as fallback for the remaining M1-specific action types with no direct or close semantic equivalent (`NUEVA_VERSION_INICIADA`, `REVISION_PERIODICA_CONFIRMADA`, `DOCUMENTO_ELIMINADO`, `RESTAURADO`, `ARCHIVO_ORIGINAL_ACTUALIZADO`, `ARCHIVO_ORIGINAL_CONGELADO`, `ARCHIVO_ORIGINAL_COPIADO_A_VERSION`, `ARCHIVO_DISTRIBUCION_GENERADO`).
- A bold entry title/description above (accion label, including diff fields such as campoModificado/valorAnterior/valorNuevo when applicable) and `realizadoPorNombre` in secondary/muted text below — same typography as `QEAuditTrail`.
- The timestamp (Intl.DateTimeFormat with locale and timezone) aligned to the right, same typography and color as `QEAuditTrail`'s timestamp.

Entries SHALL include DESCARGA and VISUALIZACION actions (RN-DOC-008). Pagination SHALL load 20 entries at a time with a "Ver más" button. No additional API call is needed — it uses data already loaded from the document query.

#### Scenario: Log tab shows content with no collapse toggle
- **WHEN** the user opens the Log tab
- **THEN** the content is immediately visible with no `aria-expanded` toggle control

#### Scenario: Log is the last tab
- **WHEN** the document detail page renders
- **THEN** Log is the last tab in the tab list

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
- **WHEN** the Log tab is opened
- **THEN** no new network request is made; the data comes from the already-loaded document object
