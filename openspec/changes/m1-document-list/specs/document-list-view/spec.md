## ADDED Requirements

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

### Requirement: DocumentList renders a paginated table with loading, empty, and error states
The system SHALL render a `DocumentList` component with columns: Código, Título, Tipo, Versión, Estado, Área, Próx. Revisión, and Acciones. Default `pageSize` SHALL be 20. Pagination controls SHALL show page numbers and previous/next buttons with text "Mostrando X–Y de Z" using i18n keys. While loading, the table SHALL show 5 skeleton rows with `bg-hairline animate-pulse` styling instead of a global spinner. When the result set is empty, an i18n message from `t('documents:list.empty')` SHALL appear, plus a CTA button if the user has permission to create documents. When the query errors, an error message and a "Reintentar" button calling `refetch` SHALL appear. Clicking any row SHALL navigate to `/documents/:id`.

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

### Requirement: DocumentListRow renders role-gated action buttons and QE warning icon
The system SHALL render a `DocumentListRow` component that calls `getDocumentPermissions(estado, rol)` to determine which action buttons are visible. Per RN-DOC-003, OBSOLETO documents SHALL NOT show an edit button for any role. Per RN-DOC-005, if a document's `qeVinculados` array contains at least one ID of an active QE, a warning icon SHALL appear in the row. Users with roles `AUDITOR_INTERNO` and `ALTA_DIRECCION` SHALL see no write-action buttons.

#### Scenario: OBSOLETO document row has no edit button
- **WHEN** a `DocumentListRow` renders a document with `estado: 'OBSOLETO'`
- **THEN** no edit button is present in the Acciones column regardless of the viewer's role

#### Scenario: Row with active QE shows warning icon
- **WHEN** a `DocumentListRow` renders a document whose `qeVinculados` is non-empty
- **THEN** a warning icon with an accessible `aria-label` is displayed in the row

#### Scenario: AUDITOR_INTERNO sees no write actions
- **WHEN** a user with role `AUDITOR_INTERNO` renders `DocumentList`
- **THEN** no edit, delete, approve, reject, or sign buttons appear in any row

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

### Requirement: RevisionSemaforo displays a 4-tier color indicator for upcoming review dates
The system SHALL export a `RevisionSemaforo` component from `src/features/documents/components/RevisionSemaforo.tsx` that accepts `fechaRevisionProxima: string | undefined`. The component SHALL compute `diasRestantes` as calendar days between today and `fechaRevisionProxima` using `differenceInCalendarDays` from `date-fns`. The color tiers SHALL be: green (> 30 days), yellow with tooltip (8–30 days), red with badge `t('documents:semaforo.proximo')` (1–7 days), red `animate-pulse` with badge `t('documents:semaforo.vencido')` (≤ 0 days). When `fechaRevisionProxima` is `undefined`, the component SHALL render a dash `—`. Tooltips SHALL use `role="tooltip"` and `aria-describedby` for accessibility.

#### Scenario: Date more than 30 days away shows green indicator
- **WHEN** `fechaRevisionProxima` is 45 days from today
- **THEN** a green dot is rendered with no badge and no tooltip

#### Scenario: Date 8–30 days away shows yellow indicator with tooltip
- **WHEN** `fechaRevisionProxima` is 15 days from today
- **THEN** a yellow dot is rendered and hovering reveals a tooltip with the days-remaining count

#### Scenario: Date 1–7 days away shows red indicator with proximo badge
- **WHEN** `fechaRevisionProxima` is 3 days from today
- **THEN** a red dot and `t('documents:semaforo.proximo')` badge are rendered

#### Scenario: Overdue date shows pulsing red indicator with vencido badge
- **WHEN** `fechaRevisionProxima` is yesterday or earlier
- **THEN** a red `animate-pulse` dot and `t('documents:semaforo.vencido')` badge are rendered

#### Scenario: Undefined date renders a dash
- **WHEN** `fechaRevisionProxima` is `undefined`
- **THEN** the component renders `—` and no dot or badge

### Requirement: useDocumentList maps URL search params to useDocuments query
The system SHALL export a `useDocumentList` hook from `src/features/documents/hooks/useDocumentList.ts` that reads `search`, `estado`, `tipo`, `area`, and `page` from `useSearchParams`, maps them to a `DocFilters` object with `pageSize: 20`, and delegates to `useDocuments()`. The hook SHALL return `{ documentos, isLoading, isError, pagination, refetch }` with no UI logic or JSX.

#### Scenario: Hook returns documentos array from query result
- **WHEN** `useDocumentList` is called and `useDocuments` resolves with data
- **THEN** `documentos` equals the `data.data` array from the query response

#### Scenario: Hook passes page from URL param
- **WHEN** the URL contains `page=3`
- **THEN** `useDocuments` is called with `page: 3`

#### Scenario: Hook returns isLoading true during fetch
- **WHEN** `useDocuments` is pending
- **THEN** `useDocumentList` returns `isLoading: true`
