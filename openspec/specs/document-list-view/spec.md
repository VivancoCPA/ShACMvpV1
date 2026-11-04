# Spec: document-list-view

## Purpose

Defines the M1 Document List view: the entry screen at `/documents` that lets users browse, filter, and act on the document registry. Covers the page shell, URL-driven filters, the paginated table, row-level role-gating, shared status/semáforo indicators, and the data hook that wires URL params to the query layer.

---

## Requirements

### Requirement: DocumentsPage renders the M1 module entry view
The system SHALL render a `DocumentsPage` component at the `/documents` route that composes `DocumentListFilters` above and `DocumentList` below, wrapped in a `PageWrapper` with the title from `t('documents:list.title')`. A "Nuevo Documento" button SHALL be visible only for users whose `UserRole` is `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST`. `DocumentList` SHALL be wrapped in an `ErrorBoundary` so filter controls remain interactive when the list fails.

#### Scenario: Authorized user sees the Nuevo Documento button
- **WHEN** a user with role `JEFE_CONTROL_DOCUMENTARIO` or `JEFE_CALIDAD_SYST` renders `DocumentsPage`
- **THEN** a "Nuevo Documento" button is visible in the page header

#### Scenario: Unauthorized user does not see the Nuevo Documento button
- **WHEN** a user with role `OPERARIO`, `AUDITOR_INTERNO`, or `ALTA_DIRECCION` renders `DocumentsPage`
- **THEN** no "Nuevo Documento" button appears in the page header

#### Scenario: List error does not unmount filter controls
- **WHEN** `DocumentList` throws an error caught by its `ErrorBoundary`
- **THEN** `DocumentListFilters` and the page header remain mounted and interactive

---

### Requirement: DocumentListFilters persists all filter state in URL search params
The system SHALL render a `DocumentListFilters` component that manages `search`, `estado`, `tipo`, `area`, and `page` exclusively via `useSearchParams` from react-router-dom — no `useState` for filter values. The search input SHALL debounce user keystrokes by 300 ms before updating the URL param. A "Limpiar filtros" button SHALL appear only when at least one filter param is present, and clicking it SHALL remove all filter params. Area options SHALL come from the `AREAS_SHAC` constant. Each select SHALL include an "all" option that removes the corresponding param.

#### Scenario: Typing in search input updates URL param after debounce
- **WHEN** a user types "PRC" into the search input
- **THEN** after 300 ms the URL search param `search=PRC` is set without a full page reload

#### Scenario: Selecting a DocStatus filters the list
- **WHEN** a user selects "PUBLICADO" in the estado select
- **THEN** the URL search param `estado=PUBLICADO` is set and `DocumentList` re-fetches with that filter

#### Scenario: Clear filters button appears only with active filters
- **WHEN** no search params are present
- **THEN** the "Limpiar filtros" button is not rendered

#### Scenario: Clear filters button resets all params
- **WHEN** `search=PRC&estado=PUBLICADO` are in the URL and the user clicks "Limpiar filtros"
- **THEN** all filter params are removed from the URL

---

### Requirement: DocumentList renders a paginated table with loading, empty, and error states
The system SHALL render a `DocumentList` component with columns: Código, Título, Tipo, Versión, Estado, Área, Próx. Revisión, and Acciones. Default `pageSize` SHALL be 10, matching `QEList` and `IncidentList`. Pagination controls SHALL show page numbers and previous/next buttons with text "Mostrando X–Y de Z" using i18n keys. While loading, the table SHALL show 5 skeleton rows with `bg-hairline animate-pulse` styling instead of a global spinner. When the result set is empty, an i18n message from `t('documents:list.empty')` SHALL appear, plus a CTA button if the user has permission to create documents. When the query errors, an error message and a "Reintentar" button calling `refetch` SHALL appear. Clicking any row SHALL navigate to `/documents/:id`.

#### Scenario: Loading state renders 5 skeleton rows
- **WHEN** `useDocumentList` returns `isLoading: true`
- **THEN** the table body contains exactly 5 rows with skeleton pulse styling and no real document data

#### Scenario: Empty state shows localized message
- **WHEN** the query resolves with zero documents
- **THEN** `t('documents:list.empty')` is displayed and no table rows are present

#### Scenario: Error state shows retry button
- **WHEN** the query resolves with `isError: true`
- **THEN** an error message and a button that calls `refetch` are rendered

#### Scenario: Row click navigates to detail
- **WHEN** a user clicks anywhere on a `DocumentListRow`
- **THEN** the router navigates to `/documents/<id>` for that document

#### Scenario: Pagination controls update the page param
- **WHEN** a user clicks page 2 in the pagination controls
- **THEN** the URL param `page=2` is set and the list re-fetches with `page: 2`

#### Scenario: Opening /documents without filters shows 10 rows per page by default
- **WHEN** a user navigates to `/documents` with no `page` or filter params applied and more than 10 documents exist
- **THEN** exactly 10 document rows are shown on the first page, consistent with `QEList` and `IncidentList`

---

### Requirement: DocumentListRow renders role-gated action buttons and QE warning icon
The system SHALL render a `DocumentListRow` component that calls `getDocumentPermissions(estado, rol)` to determine which action buttons are visible. Per RN-DOC-003, OBSOLETO documents SHALL NOT show an edit button for any role. Per RN-DOC-005, if a document's `qeVinculados` array contains at least one ID of an active QE, a warning icon SHALL appear in the row. Users with roles `AUDITOR_INTERNO` and `ALTA_DIRECCION` SHALL see no write-action buttons.

The "Iniciar revisión" (↻) icon SHALL be gated by `canManagePeriodicReview(userRole)`, not by the `(estado, docRole)` matrix's `canStartReview` flag — it SHALL appear for any `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` on a `PUBLICADO` document, regardless of that user's relationship (autor/revisor/aprobador) to the specific document.

#### Scenario: OBSOLETO document row has no edit button
- **WHEN** a `DocumentListRow` renders a document with `estado: 'OBSOLETO'`
- **THEN** no edit button is present in the Acciones column regardless of the viewer's role

#### Scenario: Row with active QE shows warning icon
- **WHEN** a `DocumentListRow` renders a document whose `qeVinculados` is non-empty
- **THEN** a warning icon with an accessible `aria-label` is displayed in the row

#### Scenario: AUDITOR_INTERNO sees no write actions
- **WHEN** a user with role `AUDITOR_INTERNO` renders `DocumentList`
- **THEN** no edit, delete, approve, reject, or sign buttons appear in any row

#### Scenario: JEFE_CALIDAD_SYST sees the "Iniciar revisión" icon on a PUBLICADO row
- **WHEN** a user with role `JEFE_CALIDAD_SYST` renders a `DocumentListRow` for a document with `estado: 'PUBLICADO'`
- **THEN** the "Iniciar revisión" (↻) icon is visible, regardless of whether that user is the document's `autorId`, `revisorId`, or `aprobadorId`

#### Scenario: SUPERVISOR does not see the "Iniciar revisión" icon
- **WHEN** a user with role `SUPERVISOR` renders a `DocumentListRow` for a document with `estado: 'PUBLICADO'`
- **THEN** the "Iniciar revisión" (↻) icon is not rendered

---

### Requirement: StatusBadge displays document and quality-event statuses as styled pills
The system SHALL export a `StatusBadge` component from `src/components/shared/StatusBadge.tsx` that accepts a `status: DocStatus | QEStatus` prop and renders a pill (`rounded-[9999px]`) with semantic background and text colors. The label SHALL be the value from `t()` using the status key. Dark-mode variants SHALL be present on every color class. The OBSOLETO status SHALL additionally apply `line-through` to the label text.

#### Scenario: PUBLICADO renders with success color
- **WHEN** `<StatusBadge status="PUBLICADO" />` is rendered
- **THEN** the badge has `bg-success/20` and `text-success` classes and displays the localized label

#### Scenario: OBSOLETO renders with error color and line-through
- **WHEN** `<StatusBadge status="OBSOLETO" />` is rendered
- **THEN** the badge has `bg-error/20`, `text-error`, and `line-through` classes

#### Scenario: StatusBadge renders in dark mode without visual regression
- **WHEN** the `dark` class is present on `<html>` and `<StatusBadge>` is rendered
- **THEN** the badge color tokens resolve to their dark-mode equivalents without hardcoded hex colors

---

### Requirement: RevisionSemaforo displays a 4-tier color indicator with the date always visible
The system SHALL export a `RevisionSemaforo` component from `src/features/documents/components/RevisionSemaforo.tsx` that accepts `fechaRevisionProxima: string | null | undefined`. The component SHALL compute `diasRestantes` using `calendarDaysUntil` from `utils/date.utils.ts` (a calendar-day difference that never shifts a day in negative-offset timezones, unlike `differenceInCalendarDays(parseISO(...), new Date())`). The color tiers SHALL be: green (> `DOC_REVISION_ALERT_DAYS` days), amber (8 days up to the threshold), red with badge `t('documents:semaforo.proximo')` (1–7 days), red `animate-pulse` with badge `t('documents:semaforo.vencido')` (≤ 0 days). When `fechaRevisionProxima` is `null` or `undefined`, the component SHALL render a dash `—`.

The formatted date (`formatCalendarDate` from `utils/date.utils.ts` — never `new Date(...)` formatted in the browser's local timezone, and never `formatShortDate`) SHALL always be visible next to the indicator, in all four tiers, without requiring hover. In the amber and red (próximo/vencido) tiers, a relative-days text SHALL also be visible without hover: `t('documents:semaforo.enDias', { count })` for a future date (amber/próximo), `t('documents:semaforo.haceDias', { count })` for an overdue date (vencido), or `t('documents:semaforo.hoy')` when `diasRestantes === 0`. Both relative-days keys SHALL use i18next `_one`/`_other` pluralization. The green tier only needs the date. Color SHALL NOT be the only carrier of information — the visible text conveys the same information a sighted user would get from color alone. A tooltip MAY still be present but, if so, SHALL be redundant with the visible text, never the only way to see the days-remaining count.

#### Scenario: Date more than DOC_REVISION_ALERT_DAYS days away shows green indicator with the date
- **WHEN** `fechaRevisionProxima` is 45 days from today (calendar days) and `DOC_REVISION_ALERT_DAYS` is 30
- **THEN** a green dot is rendered together with the formatted date, no badge

#### Scenario: Date 8 days up to the threshold shows amber indicator with date and relative text
- **WHEN** `fechaRevisionProxima` is 15 days from today
- **THEN** an amber dot is rendered together with the formatted date and the visible text for "en 15 días" (or its pluralized/localized equivalent), without needing to hover

#### Scenario: Date 1–7 days away shows red indicator with proximo badge, date and relative text
- **WHEN** `fechaRevisionProxima` is 3 days from today
- **THEN** a red dot, the `t('documents:semaforo.proximo')` badge, the formatted date, and "en 3 días" are all visible without hover

#### Scenario: Date exactly today shows "hoy" instead of a day count
- **WHEN** `diasRestantes` is `0`
- **THEN** the visible relative text reads `t('documents:semaforo.hoy')`, not "en 0 días" nor "hace 0 días"

#### Scenario: Overdue date shows pulsing red indicator with vencido badge, date and relative text in the past
- **WHEN** `fechaRevisionProxima` is 10 days before today
- **THEN** a red `animate-pulse` dot, the `t('documents:semaforo.vencido')` badge, the formatted date, and "hace 10 días" are all visible without hover

#### Scenario: Relative-days text pluralizes correctly for exactly one day
- **WHEN** `fechaRevisionProxima` is exactly 1 day from today
- **THEN** the visible text uses the singular form ("en 1 día"), not "en 1 días"

#### Scenario: Null or undefined date renders a dash
- **WHEN** `fechaRevisionProxima` is `null` or `undefined`
- **THEN** the component renders a dash (`—`) and no date or relative text

#### Scenario: No day-off-by-one in a negative UTC offset timezone
- **WHEN** the browser timezone is `UTC-5`, "today" there is `2026-09-29`, and `fechaRevisionProxima` is `"2026-10-01T00:00:00Z"`
- **THEN** the visible date reads October 1 (not September 30) and the relative text reads "en 2 días" (not "en 1 día" or "en 3 días")

---

### Requirement: useDocumentList maps URL search params to useDocuments query
The system SHALL export a `useDocumentList` hook from `src/features/documents/hooks/useDocumentList.ts` that reads `search`, `estado`, `tipo`, `area`, and `page` from `useSearchParams`, maps them to a `DocFilters` object with `pageSize: 10`, and delegates to `useDocuments()`. The hook SHALL return `{ documentos, isLoading, isError, pagination, refetch }` with no UI logic or JSX.

#### Scenario: Hook returns documentos array from query result
- **WHEN** `useDocumentList` is called and `useDocuments` resolves with data
- **THEN** `documentos` equals the `data.data` array from the query response

#### Scenario: Hook passes page from URL param
- **WHEN** the URL contains `page=3`
- **THEN** `useDocuments` is called with `page: 3`

#### Scenario: Hook returns isLoading true during fetch
- **WHEN** `useDocuments` is pending
- **THEN** `useDocumentList` returns `isLoading: true`

#### Scenario: Hook defaults to pageSize 10
- **WHEN** `useDocumentList` builds its filters object
- **THEN** `pageSize` is `10`, not `5`

### Requirement: "Mis pendientes" filter visibility is not role-restricted
`DocumentListFilters` SHALL show the "Mis pendientes" toggle to every role with access to the Documents module (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`), since under the current pendientes rule any of them can have an assigned pendiente (own `BORRADOR`, assigned `RevisorId`/`AprobadorId`, or `EN_REVISION_PERIODICA` for the two Jefe roles). The component SHALL NOT hardcode a smaller role subset for visibility; the pendientes count itself (via `useDocumentosPendientesCount`) is what determines whether there is anything to show.

#### Scenario: AUDITOR_INTERNO sees the pendientes filter
- **WHEN** a user with role `AUDITOR_INTERNO` views `DocumentsPage`
- **THEN** the "Mis pendientes" filter button is rendered

#### Scenario: ALTA_DIRECCION sees the pendientes filter
- **WHEN** a user with role `ALTA_DIRECCION` views `DocumentsPage`
- **THEN** the "Mis pendientes" filter button is rendered

#### Scenario: OPERARIO sees the pendientes filter
- **WHEN** a user with role `OPERARIO` views `DocumentsPage`
- **THEN** the "Mis pendientes" filter button is rendered, showing `0` if they have no `BORRADOR` of their own
