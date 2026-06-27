# Spec: nc-list-view

## Purpose

Defines the M2 Non-Conformity List view: the entry screen at `/nonconformities` that lets users browse, filter, and navigate to individual NCs. Covers the page shell, URL-driven filters with persistence across navigation and reload, the paginated table with visual state indicators, row-level role-gating, and the data hook that wires URL params to the query layer.

---

## Requirements

### Requirement: NonconformityListPage renders the M2 module entry view
The system SHALL render a `NonconformityListPage` component at the `/nonconformities` route that composes `NCListFilters` above and `NCList` below, wrapped in a `PageWrapper` with the title from `t('nonconformities:list.title')`. A "Nueva NC" button SHALL be visible only for users whose `UserRole` is `SUPERVISOR` or `JEFE_CALIDAD_SYST`. `NCList` SHALL be wrapped in an `ErrorBoundary` so filter controls remain interactive when the list fails.

#### Scenario: Authorized user sees the Nueva NC button
- **WHEN** a user with role `SUPERVISOR` or `JEFE_CALIDAD_SYST` renders `NonconformityListPage`
- **THEN** a "Nueva NC" button is visible in the page header

#### Scenario: Unauthorized user does not see the Nueva NC button
- **WHEN** a user with role `OPERARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`, or `JEFE_CONTROL_DOCUMENTARIO` renders `NonconformityListPage`
- **THEN** no "Nueva NC" button appears in the page header

#### Scenario: List error does not unmount filter controls
- **WHEN** `NCList` throws an error caught by its `ErrorBoundary`
- **THEN** `NCListFilters` and the page header remain mounted and interactive

---

### Requirement: NCListFilters persists all filter state in URL search params
The system SHALL render a `NCListFilters` component that manages `search`, `estado`, `severidad`, `areaAfectada`, `fechaDesde`, `fechaHasta`, and `page` exclusively via `useSearchParams` from react-router-dom. The **dominio** filter param is removed. The **areaAfectada** filter SHALL be a `<select>` populated from `AREAS_SHAC` imported from `src/constants/shared.constants.ts`, replacing the previous text input. The **fechaDesde** and **fechaHasta** inputs SHALL be grouped under a section label "Fecha detección" (from `t('nonconformities:filters.fechaDeteccionLabel')`) that is visible above or alongside the date inputs, so the user knows which field the date range filters on. The filter container SHALL use the shared `FilterBar` component from `src/components/shared/FilterBar.tsx`. The search input SHALL debounce user keystrokes by 300 ms before updating the URL param. A "Limpiar filtros" button SHALL appear only when at least one filter param is present, and clicking it SHALL remove all filter params and reset `page` to 1. Changing any filter other than `page` SHALL also reset `page` to 1.

#### Scenario: Área Afectada filter shows a select with AREAS_SHAC options
- **WHEN** NCListFilters renders
- **THEN** the Área Afectada control is a `<select>` element whose options include each value from `AREAS_SHAC`

#### Scenario: Selecting an area from the select updates the URL param
- **WHEN** a user selects `'Operaciones'` in the Área Afectada select
- **THEN** the URL search param `areaAfectada=Operaciones` is set and `NCList` re-fetches

#### Scenario: Fecha detección label is visible above date range inputs
- **WHEN** NCListFilters renders
- **THEN** a label containing the text from `t('nonconformities:filters.fechaDeteccionLabel')` is rendered adjacent to the fechaDesde and fechaHasta inputs

#### Scenario: Dominio filter is absent from NCListFilters
- **WHEN** NCListFilters renders
- **THEN** no select or input for filtering by dominio is present

#### Scenario: Typing in search input updates URL param after debounce
- **WHEN** a user types "NC-SST" into the search input
- **THEN** after 300 ms the URL search param `search=NC-SST` is set without a full page reload

#### Scenario: Clear filters button appears only with active filters
- **WHEN** no search params are present
- **THEN** the "Limpiar filtros" button is not rendered

#### Scenario: Clear filters button resets all params
- **WHEN** `search=NC-CAL&estado=CERRADA` are in the URL and the user clicks "Limpiar filtros"
- **THEN** all filter params including `page` are removed from the URL

#### Scenario: Changing a non-page filter resets page to 1
- **WHEN** the user is on page 3 and selects a different `estado` filter
- **THEN** the URL param `page` is reset to 1 along with the new `estado` value

---

### Requirement: NCListFilters does not reset search params on mount
The system SHALL NOT clear or overwrite existing URL search params when `NCListFilters` mounts. The component SHALL read `useSearchParams` as initial state and leave it unchanged if the user navigated back from a detail page or reloaded the page with params in the URL. No `useEffect` or initialization logic SHALL write to searchParams on mount.

#### Scenario: Filters survive navigation to detail and back
- **WHEN** a user has active filters `estado=EN_INVESTIGACION&dominio=SST` and clicks a row to navigate to `/nonconformities/:id`
- **AND** the user presses the browser back button to return to `/nonconformities`
- **THEN** the URL still contains `estado=EN_INVESTIGACION&dominio=SST` and the filter controls reflect those values without any reset

#### Scenario: Filters survive page reload
- **WHEN** a user has active filters `severidad=CRITICA&page=2` in the URL and reloads the page
- **THEN** after reload, `NCListFilters` renders with the severity select showing "CRITICA" and the list shows page 2 — no reset to default state

#### Scenario: NCListFilters does not emit a searchParams write on mount with empty URL
- **WHEN** a user navigates to `/nonconformities` with no search params
- **THEN** no URL params are written during the initial render of `NCListFilters`

---

### Requirement: NCList renders a paginated table with loading, empty, and error states
The system SHALL render a `NCList` component with columns: Número NC, Título, Área Afectada, Severidad, Estado, Responsable AC, Fecha Detección, Fecha de Cierre, and Acciones. The **Dominio** column is removed. The **Título** column SHALL display `noConformidad.descripcion` truncated to a max width using the `truncate` CSS class, with a native `title` attribute containing the full untruncated text. The **Fecha de Cierre** column SHALL render a `DeadlineBadge` component passing `fechaCierre={nc.fechaCierre ?? null}` and `estado={nc.estado}`. Default `pageSize` SHALL be 5. Pagination SHALL use the shared `Pagination` component from `src/components/shared/Pagination.tsx`. While loading, the table SHALL show 5 skeleton rows with `bg-hairline animate-pulse` styling. When the result set is empty, `t('nonconformities:list.empty')` SHALL appear. When the query errors, an error message and a "Reintentar" button calling `refetch` SHALL appear. Clicking any row SHALL navigate to `/nonconformities/:id`. Table rows SHALL use `TABLE_ROW_CLASS` from `src/constants/ui.constants.ts` as the base class.

#### Scenario: Loading state renders 5 skeleton rows
- **WHEN** `useNCList` returns `isLoading: true`
- **THEN** the table body contains exactly 5 rows with skeleton pulse styling and no real NC data

#### Scenario: Empty state shows localized message
- **WHEN** the query resolves with zero non-conformities
- **THEN** `t('nonconformities:list.empty')` is displayed and no table rows are present

#### Scenario: Error state shows retry button
- **WHEN** the query resolves with `isError: true`
- **THEN** an error message and a button that calls `refetch` are rendered

#### Scenario: Row click navigates to detail
- **WHEN** a user clicks anywhere on an `NCList` row
- **THEN** the router navigates to `/nonconformities/<id>` for that NC

#### Scenario: Pagination controls update the page param via shared Pagination component
- **WHEN** a user clicks page 2 in the pagination controls
- **THEN** the URL param `page=2` is set and the list re-fetches with `page: 2`

#### Scenario: Título column shows truncated text with tooltip
- **WHEN** an NCList row renders a non-conformity with a long descripcion
- **THEN** the Título cell has `truncate` class applied and a `title` attribute containing the full descripcion text

#### Scenario: Fecha de Cierre column shows DeadlineBadge with color when NC is open
- **WHEN** an NCList row renders a non-conformity with `fechaCierre` set and `estado` not CERRADA or ANULADA
- **THEN** the Fecha de Cierre cell renders a `DeadlineBadge` with the appropriate semaphore color

#### Scenario: Fecha de Cierre column shows plain date when NC is CERRADA
- **WHEN** an NCList row renders a non-conformity with `estado: 'CERRADA'`
- **THEN** `DeadlineBadge` renders the date without a colored badge

#### Scenario: Dominio column is absent from the table
- **WHEN** NCList renders its column headers
- **THEN** no column header for "Dominio" is present in the table

---

### Requirement: ANULADA rows are visually attenuated
The system SHALL render rows for non-conformities with `estado: 'ANULADA'` with reduced opacity (`opacity-50`) and no write-action buttons in the Acciones column. The row SHALL remain clickable to navigate to the detail page.

#### Scenario: ANULADA row has reduced opacity
- **WHEN** an `NCList` row renders a non-conformity with `estado: 'ANULADA'`
- **THEN** the row element has the `opacity-50` Tailwind class applied

#### Scenario: ANULADA row has no write-action buttons
- **WHEN** an `NCList` row renders a non-conformity with `estado: 'ANULADA'`
- **THEN** no edit, delete, or status-change buttons appear in the Acciones column regardless of the viewer's role

#### Scenario: ANULADA row is still clickable
- **WHEN** a user clicks on a row with `estado: 'ANULADA'`
- **THEN** the router navigates to `/nonconformities/<id>` for that NC

---

### Requirement: NCList row shows overdue AC indicator
The system SHALL render a warning icon in the Número NC column (or a dedicated indicator column) for any NC whose `accionesCorrectivas` array contains at least one AC with `estado: 'VENCIDA'`. The icon SHALL have an accessible `aria-label` from `t('nonconformities:list.acVencidaLabel')` and SHALL use a `text-error` color class. The indicator SHALL NOT appear for NCs with `estado: 'CERRADA'` or `estado: 'ANULADA'`.

#### Scenario: Row with overdue AC shows warning icon
- **WHEN** an `NCList` row renders a non-conformity with at least one AC with `estado: 'VENCIDA'`
- **THEN** a warning icon with `aria-label` and `text-error` class is rendered in the row

#### Scenario: Row without overdue ACs shows no warning icon
- **WHEN** an `NCList` row renders a non-conformity with no ACs in `VENCIDA` state
- **THEN** no AC warning icon is rendered

#### Scenario: Closed or annulled NC shows no warning icon
- **WHEN** an `NCList` row renders a non-conformity with `estado: 'CERRADA'` or `estado: 'ANULADA'`
- **THEN** no AC warning icon is rendered even if ACs are in `VENCIDA` state

---

### Requirement: useNCList maps URL search params to useNonconformities query
The system SHALL export a `useNCList` hook from `src/features/nonconformities/hooks/useNCList.ts` that reads `search`, `estado`, `dominio`, `severidad`, `areaAfectada`, `fechaDesde`, `fechaHasta`, and `page` from `useSearchParams`, maps them to an `NCFilters` object with `pageSize: 5`, and delegates to `useNonconformities()`. The hook SHALL return `{ nonconformidades, isLoading, isError, pagination, refetch }` with no UI logic or JSX.

#### Scenario: Hook returns nonconformidades array from query result
- **WHEN** `useNCList` is called and `useNonconformities` resolves with data
- **THEN** `nonconformidades` equals the `data.data` array from the query response

#### Scenario: Hook passes dominio from URL param
- **WHEN** the URL contains `dominio=SST`
- **THEN** `useNonconformities` is called with `dominio: 'SST'` in the filters object

#### Scenario: Hook passes page from URL param
- **WHEN** the URL contains `page=2`
- **THEN** `useNonconformities` is called with `page: 2`

#### Scenario: Hook returns isLoading true during fetch
- **WHEN** `useNonconformities` is pending
- **THEN** `useNCList` returns `isLoading: true`
