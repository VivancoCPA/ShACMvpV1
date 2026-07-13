# Spec: quality-event-list-view

## Purpose

Define the QualityEventListPage, QEListFilters, QEList, and useQEList hook that together compose the M4 module entry view: a paginated, filterable table of Quality Events backed by URL search params.

---

## Requirements

### Requirement: QualityEventListPage renders the M4 module entry view
The system SHALL render a `QualityEventListPage` component at the `/quality-events` route that composes `QEListFilters` above and `QEList` below, wrapped in a `PageWrapper` with the title from `t('qualityEvents:list.title')`. A "Nuevo Quality Event" button SHALL be visible only for users with roles `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST`. The button SHALL navigate to `/quality-events/nuevo` via `useNavigate` when clicked. `QEList` SHALL be wrapped in an `ErrorBoundary` so filter controls remain interactive when the list fails.

#### Scenario: Authorized roles see the Nuevo QE button
- **WHEN** a user with role `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST` renders `QualityEventListPage`
- **THEN** a "Nuevo Quality Event" button is visible in the page header

#### Scenario: AUDITOR_INTERNO does not see the Nuevo QE button
- **WHEN** a user with role `AUDITOR_INTERNO` renders `QualityEventListPage`
- **THEN** no "Nuevo Quality Event" button appears in the page header

#### Scenario: ALTA_DIRECCION does not see the Nuevo QE button
- **WHEN** a user with role `ALTA_DIRECCION` renders `QualityEventListPage`
- **THEN** no "Nuevo Quality Event" button appears in the page header

#### Scenario: Nuevo QE button navigates to /quality-events/nuevo
- **WHEN** a user with an authorized role clicks the "Nuevo Quality Event" button
- **THEN** the router navigates to `/quality-events/nuevo`

#### Scenario: List error does not unmount filter controls
- **WHEN** `QEList` throws an error caught by its `ErrorBoundary`
- **THEN** `QEListFilters` and the page header remain mounted and interactive

---

### Requirement: QEListFilters persists all filter state in URL search params
The system SHALL render a `QEListFilters` component that manages `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, `soloReincidencias`, and `page` exclusively via `useSearchParams` from react-router-dom. The `areaAfectada` field is NOT a filter criterion — it exists on `QualityEvent` and appears as a read-only table column but has no corresponding filter control. Date inputs SHALL be type `date` with `lang="es-PE"` and SHALL be labeled "Fecha del evento — Desde / Hasta", making explicit that `fechaDesde`/`fechaHasta` filter on the `fechaHoraEvento` field of each QE. A "Limpiar filtros" button SHALL appear only when at least one filter param (excluding `page`) is present, and clicking it SHALL remove all filter params and reset `page` to 1. Changing any filter other than `page` SHALL also reset `page` to 1. The filter container SHALL use the shared `FilterBar` component.

#### Scenario: Estado filter select updates URL param
- **WHEN** a user selects `'ABIERTO'` in the Estado select
- **THEN** the URL search param `estado=ABIERTO` is set and `QEList` re-fetches

#### Scenario: Tipo filter select updates URL param
- **WHEN** a user selects `'SST'` in the Tipo select
- **THEN** the URL search param `tipo=SST` is set

#### Scenario: Severidad filter select updates URL param
- **WHEN** a user selects `'CRITICA'` in the Severidad select
- **THEN** the URL search param `severidad=CRITICA` is set

#### Scenario: Origen filter select updates URL param
- **WHEN** a user selects `'O1_INCIDENTE_CAMPO'` in the Origen select
- **THEN** the URL search param `origen=O1_INCIDENTE_CAMPO` is set

#### Scenario: Solo reincidencias checkbox updates URL param
- **WHEN** a user checks the "Solo reincidencias" checkbox
- **THEN** the URL search param `soloReincidencias=true` is set

#### Scenario: Clear filters button appears only with active filters
- **WHEN** no search params other than `page` are present
- **THEN** the "Limpiar filtros" button is not rendered

#### Scenario: Clear filters button removes all params
- **WHEN** `estado=ABIERTO&severidad=CRITICA` are in the URL and the user clicks "Limpiar filtros"
- **THEN** all filter params including `page` are removed from the URL

#### Scenario: Changing a filter resets page to 1
- **WHEN** the user is on page 2 and changes the `tipo` filter
- **THEN** the URL param `page` is reset to 1 along with the new `tipo` value

---

### Requirement: QEListFilters does not reset search params on mount
The system SHALL NOT clear or overwrite existing URL search params when `QEListFilters` mounts. No `useEffect` or initialization logic SHALL write to searchParams on mount.

#### Scenario: Filters survive navigation to detail and back
- **WHEN** a user has active filters `estado=EN_INVESTIGACION&severidad=ALTA` and clicks a row to navigate to `/quality-events/:id`
- **AND** the user presses the browser back button
- **THEN** the URL still contains `estado=EN_INVESTIGACION&severidad=ALTA` and filter controls reflect those values

#### Scenario: Filters survive page reload
- **WHEN** a user has active filters `soloReincidencias=true&page=2` and reloads the page
- **THEN** after reload the checkbox shows checked and the list shows page 2

---

### Requirement: QEList renders a paginated table with loading, empty, and error states
The system SHALL render a `QEList` component with columns: Número, Tipo+Origen, Descripción, Área, Severidad, Estado, Ciclo, Vencimiento, and Acciones. Default `pageSize` SHALL be 10. Pagination SHALL use the shared `Pagination` component. While loading, the table SHALL show 5 skeleton rows with `animate-pulse` styling. When the result set is empty, `t('qualityEvents:list.empty')` SHALL appear. When the query errors, an error message and a "Reintentar" button calling `refetch` SHALL appear. Clicking a row SHALL navigate to `/quality-events/:id`. Table rows SHALL use `TABLE_ROW_CLASS` from `src/constants/ui.constants.ts` as base class.

#### Scenario: Loading state renders 5 skeleton rows
- **WHEN** `useQEList` returns `isLoading: true`
- **THEN** the table body contains exactly 5 rows with skeleton pulse styling and no real QE data

#### Scenario: Empty state shows localized message
- **WHEN** the query resolves with zero quality events
- **THEN** `t('qualityEvents:list.empty')` is displayed and no table rows are present

#### Scenario: Error state shows retry button
- **WHEN** the query resolves with `isError: true`
- **THEN** an error message and a button that calls `refetch` are rendered

#### Scenario: Row click navigates to detail
- **WHEN** a user clicks anywhere on a `QEList` row
- **THEN** the router navigates to `/quality-events/<id>` for that QE

#### Scenario: Número column uses monospace font and links to detail
- **WHEN** `QEList` renders a row for a quality event
- **THEN** the Número cell renders the `numero` field in a monospace font class (`font-mono`)

#### Scenario: Descripción column truncates at 80 characters with full text tooltip
- **WHEN** a QE row renders a `descripcion` longer than 80 characters
- **THEN** the cell displays only the first 80 characters and a native `title` attribute holds the full text

#### Scenario: Pagination controls update page param
- **WHEN** a user clicks page 2 in the pagination controls
- **THEN** the URL param `page=2` is set and the list re-fetches with `page: 2`

---

### Requirement: QEList rows for CRITICA severity have a left red border
The system SHALL apply `border-l-4 border-error` classes to the `<tr>` element of any row whose `severidad === 'CRITICA'`. Rows with other severity values SHALL NOT have a left border applied via this mechanism.

#### Scenario: CRITICA row has left red border
- **WHEN** a `QEList` row renders a quality event with `severidad: 'CRITICA'`
- **THEN** the row `<tr>` has the `border-l-4` and `border-error` Tailwind classes applied

#### Scenario: ALTA row does not have left red border
- **WHEN** a `QEList` row renders a quality event with `severidad: 'ALTA'`
- **THEN** the row `<tr>` does NOT have the `border-l-4 border-error` classes

---

### Requirement: QEList shows Reincidencia badge for ciclo > 1
The system SHALL render a "Reincidencia ×N" badge inline in the Número cell for any QE with `ciclo > 1`, where N is the value of `ciclo`. The badge SHALL use amber colors (`bg-amber/15 text-amber`). For QEs with `ciclo === 1` no badge SHALL appear.

#### Scenario: ciclo 2 shows Reincidencia ×2 badge
- **WHEN** a `QEList` row renders a quality event with `ciclo: 2`
- **THEN** a badge containing `'Reincidencia ×2'` (text from `t('qualityEvents:list.reincidencia', { count: 2 })`) is visible in the Número cell

#### Scenario: ciclo 1 shows no Reincidencia badge
- **WHEN** a `QEList` row renders a quality event with `ciclo: 1`
- **THEN** no reincidencia badge appears in the Número cell

---

### Requirement: QEList shows DeadlineBadge for QEs in EN_VERIFICACION state
The system SHALL render a `DeadlineBadge` in the Vencimiento column only for rows where `estado === 'EN_VERIFICACION'`. The badge SHALL receive `fechaCierre={qe.fechaVerificacionProgramada ?? null}` and `estado={qe.estado}`. For rows in other states the Vencimiento cell SHALL render an em dash (`—`).

#### Scenario: EN_VERIFICACION row shows DeadlineBadge
- **WHEN** a `QEList` row renders a quality event with `estado: 'EN_VERIFICACION'` and a `fechaVerificacionProgramada` set
- **THEN** a `DeadlineBadge` is rendered in the Vencimiento column with appropriate semaphore color

#### Scenario: Non-EN_VERIFICACION row shows dash in Vencimiento column
- **WHEN** a `QEList` row renders a quality event with `estado: 'ABIERTO'`
- **THEN** the Vencimiento cell shows `—` and no DeadlineBadge is rendered

---

### Requirement: QEList Acciones column shows Ver for all roles and Editar only with permissions
The system SHALL render a `Ver` icon button (Eye icon) in the Acciones column for every row regardless of role. An `Editar` icon button SHALL appear only when `puedeEditarQE(qe, usuario)` returns `true` (RN-QE-014/RN-QE-015/RN-QE-016, `quality-event-permissions`) — replacing the previous `puedeEditarCabecera`-based gate. When `puedeEditarQE` returns `false`, the `Editar` icon SHALL be omitted entirely from the row — it SHALL NOT render in a disabled state and SHALL NOT carry an explanatory tooltip. Exactly one `Editar` icon SHALL ever render per row, even when the current user simultaneously satisfies more than one of RN-QE-014/015/016 for that QE. Both buttons SHALL have `aria-label` and `title` attributes from i18n keys.

Clicking `Editar` SHALL route based on `resolveQEEditAccess(qe, usuario)`:
- `reporteInicial: true` (regardless of `severidad`/`mineral`): navigate to `/quality-events/:id/editar` (full `QualityEventForm` edit mode).
- `reporteInicial: false` and (`severidad` or `mineral`) `true`: open `QEEditSeveridadMineralModal` inline, without navigation.

#### Scenario: All roles see Ver button
- **WHEN** any authenticated user renders `QEList` with results
- **THEN** each row contains an Eye icon button with `aria-label` from `t('qualityEvents:list.actions.ver')`

#### Scenario: OPERARIO never sees the Editar icon
- **WHEN** a user with role `OPERARIO` who is not the QE's creator renders `QEList`
- **THEN** no edit button appears in any row's Acciones column, consistent with OPERARIO having no RBAC path to any of RN-QE-014/015/016

#### Scenario: User with no matching edit rule does not see Editar button
- **WHEN** `puedeEditarQE(qe, usuario)` returns `false` for the current user and a given row
- **THEN** no edit button appears in that row's Acciones column, and no disabled placeholder or tooltip is rendered in its place

#### Scenario: Creator within RN-QE-014 window sees Editar and it navigates to the full form
- **WHEN** `puedeEditarQE` returns `true` because `resolveQEEditAccess` yields `{ reporteInicial: true, severidad: false, mineral: false }`
- **THEN** an `Editar` icon appears in that row, and clicking it navigates to `/quality-events/:id/editar`

#### Scenario: JEFE_CALIDAD_SYST outside the RN-QE-014 window sees Editar and it opens the reduced modal
- **WHEN** `puedeEditarQE` returns `true` because `resolveQEEditAccess` yields `{ reporteInicial: false, severidad: true, mineral: true }`
- **THEN** an `Editar` icon appears in that row, and clicking it opens `QEEditSeveridadMineralModal` without navigating away from the list

#### Scenario: Double-role user sees a single Editar icon routing to the full form
- **WHEN** `resolveQEEditAccess` yields `{ reporteInicial: true, severidad: true, mineral: true }` for the current user and row
- **THEN** exactly one `Editar` icon renders in that row, and clicking it navigates to `/quality-events/:id/editar` (not to the reduced modal, and not rendering two icons)

---

### Requirement: useQEList maps URL search params to useQualityEvents query
The system SHALL export a `useQEList` hook from `src/features/quality-events/hooks/useQEList.ts` that reads `estado`, `tipo`, `severidad`, `origen`, `fechaDesde`, `fechaHasta`, `soloReincidencias`, and `page` from `useSearchParams`, maps them to a `QEListParams` object with `pageSize: 10`, and delegates to `useQualityEvents()`. `QEListParams` SHALL NOT include `areaAfectada` — filtering by area is not supported. The `fechaDesde` and `fechaHasta` params correspond to the `fechaHoraEvento` field on each QE (the date the event occurred), not to `fechaVerificacionProgramada`. The hook SHALL return `{ qualityEvents, isLoading, isError, pagination, refetch }` with no UI logic or JSX.

#### Scenario: Hook returns qualityEvents array from query result
- **WHEN** `useQEList` is called and `useQualityEvents` resolves with data
- **THEN** `qualityEvents` equals the `data.data` array from the query response

#### Scenario: Hook passes estado from URL param
- **WHEN** the URL contains `estado=ABIERTO`
- **THEN** `useQualityEvents` is called with `estado: 'ABIERTO'` in the filters object

#### Scenario: Hook passes soloReincidencias=true as boolean
- **WHEN** the URL contains `soloReincidencias=true`
- **THEN** `useQualityEvents` is called with `soloReincidencias: true` in the filters object

#### Scenario: Hook passes page from URL param defaulting to 1
- **WHEN** the URL contains `page=3`
- **THEN** `useQualityEvents` is called with `page: 3`

#### Scenario: Hook returns isLoading true during fetch
- **WHEN** `useQualityEvents` is pending
- **THEN** `useQEList` returns `isLoading: true`

---

### Requirement: QEList active filter chips render as removable badges
The system SHALL render a removable badge for each active filter param (excluding `page`) in the area between `QEListFilters` and the table. Each badge SHALL display a human-readable label and an × button that removes only that param and resets `page` to 1. Badges SHALL use `bg-surface-soft text-ink dark:bg-surface-dark-soft dark:text-on-dark` classes with `rounded-pill` shape.

#### Scenario: Estado chip renders and is removable
- **WHEN** the URL contains `estado=ABIERTO`
- **THEN** a badge with the label for ABIERTO (from `QE_STATUS_LABELS`) and an × button is visible; clicking × removes `estado` from the URL

#### Scenario: soloReincidencias chip renders and is removable
- **WHEN** the URL contains `soloReincidencias=true`
- **THEN** a badge labeled with `t('qualityEvents:list.filters.soloReincidencias')` and an × button is visible; clicking × removes `soloReincidencias` from the URL

#### Scenario: Multiple active chips all render simultaneously
- **WHEN** the URL contains `estado=ABIERTO&severidad=CRITICA`
- **THEN** two separate removable chips are visible, one for each active filter
