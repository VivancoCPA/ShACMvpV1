## MODIFIED Requirements

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
