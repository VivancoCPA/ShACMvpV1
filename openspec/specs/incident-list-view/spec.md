# Spec: incident-list-view

## Purpose

Define the IncidentListPage and IncidentList components for the M3 module entry view, including filter state management via URL search params, paginated table rendering, role-gated actions, deleted-row styling, and confirmation modals for delete and restore operations.

---

## Requirements

### Requirement: IncidentListPage renders the M3 module entry view
The system SHALL render an `IncidentListPage` component at the `/incidents` route that composes `IncidentList` and `IncidentMapView` wrapped in a `PageWrapper` with the title from `t('incidents:list.title')`. The page header SHALL include two tab buttons — "Lista" and "Mapa" — that set the URL search param `view` to `list` and `map` respectively. The default value of `view` SHALL be `list`. When `view=list`, `IncidentList` SHALL be rendered. When `view=map`, `IncidentMapView` SHALL be rendered. A "Nuevo incidente" button with ícono `Plus` SHALL be visible only for users whose `UserRole` is `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST`. The button SHALL navigate to `/incidents/nuevo`. `IncidentList` SHALL be wrapped in an `ErrorBoundary` and `Suspense` so filter controls remain interactive when the list fails. `IncidentMapView` SHALL also be wrapped in its own `ErrorBoundary`.

#### Scenario: Authorized user sees the Nuevo incidente button
- **WHEN** a user with role `OPERARIO`, `SUPERVISOR`, or `JEFE_CALIDAD_SYST` renders `IncidentListPage`
- **THEN** a "Nuevo incidente" button is visible in the page header

#### Scenario: Unauthorized user does not see the Nuevo incidente button
- **WHEN** a user with role `AUDITOR_INTERNO` or `ALTA_DIRECCION` renders `IncidentListPage`
- **THEN** no "Nuevo incidente" button appears in the page header

#### Scenario: List error does not unmount filter controls
- **WHEN** `IncidentList` throws an error caught by its `ErrorBoundary`
- **THEN** the FilterBar and page header remain mounted and interactive

#### Scenario: Default view is Lista when no view param is present
- **WHEN** `IncidentListPage` renders with no `view` search param in the URL
- **THEN** the "Lista" tab is active and `IncidentList` is rendered; `IncidentMapView` is not rendered

#### Scenario: Clicking Mapa tab switches to map view
- **WHEN** the user clicks the "Mapa" tab button
- **THEN** the URL param `view=map` is set, `IncidentMapView` is rendered, and `IncidentList` is not rendered

#### Scenario: Clicking Lista tab returns to list view
- **WHEN** the URL contains `view=map` and the user clicks the "Lista" tab
- **THEN** the URL param `view=list` is set, `IncidentList` is rendered, and `IncidentMapView` is not rendered

#### Scenario: Switching tabs preserves active filters
- **WHEN** the URL contains `tipo=ACCIDENTE&estado=ABIERTO&view=list` and the user clicks "Mapa"
- **THEN** the URL becomes `tipo=ACCIDENTE&estado=ABIERTO&view=map` (only `view` changes)

#### Scenario: Active tab has visually distinct style
- **WHEN** `view=map` is active in the URL
- **THEN** the "Mapa" tab button has an active visual style distinguishable from the inactive "Lista" tab

---

### Requirement: IncidentList persists all filter state in URL search params
The system SHALL manage `tipo`, `estado`, `severidad`, `areaId`, `turno`, `fechaDesde`, `fechaHasta`, `search`, `showDeleted`, and `page` exclusively via `useSearchParams` from react-router-dom. The `showDeleted` param SHALL only be settable when `userRole === 'JEFE_CALIDAD_SYST'`. The filter container SHALL use the shared `FilterBar` component from `src/components/shared/FilterBar.tsx`. The search input SHALL debounce user keystrokes by 300 ms before updating the URL param. A "Limpiar filtros" button SHALL appear only when at least one filter param is present, and clicking it SHALL remove all filter params and reset `page` to 1. Changing any filter other than `page` SHALL also reset `page` to 1. The `areaId` filter SHALL be a `<select>` populated from `AREAS_SHAC` imported from `src/constants/shared.constants.ts`.

#### Scenario: Tipo filter shows all four incident types plus "Todos"
- **WHEN** IncidentList renders the Tipo select
- **THEN** the options are "Todos", "ACCIDENTE", "INCIDENTE", "CUASI_ACCIDENTE", "CONDICION_INSEGURA" using labels from `INCIDENT_TYPE_LABELS`

#### Scenario: Estado filter shows all seven states plus "Todos"
- **WHEN** IncidentList renders the Estado select
- **THEN** the options are "Todos" plus all 7 states using labels from `INCIDENT_STATUS_LABELS`

#### Scenario: Severidad filter shows four levels plus "Todos"
- **WHEN** IncidentList renders the Severidad select
- **THEN** the options are "Todos", "BAJA", "MEDIA", "ALTA", "CRITICA"

#### Scenario: Turno filter shows three shifts plus "Todos"
- **WHEN** IncidentList renders the Turno select
- **THEN** the options are "Todos", "DIA", "TARDE", "NOCHE"

#### Scenario: Área filter shows a select with AREAS_SHAC options
- **WHEN** IncidentList renders
- **THEN** the Área Afectada control is a `<select>` element whose options include each value from `AREAS_SHAC`

#### Scenario: Switch Mostrar eliminados visible only for JEFE_CALIDAD_SYST
- **WHEN** a user with role `JEFE_CALIDAD_SYST` renders IncidentList
- **THEN** the "Mostrar eliminados" switch is visible in the filter bar

#### Scenario: Switch Mostrar eliminados not visible for other roles
- **WHEN** a user with role `SUPERVISOR`, `OPERARIO`, `AUDITOR_INTERNO`, or `ALTA_DIRECCION` renders IncidentList
- **THEN** no "Mostrar eliminados" switch is present

#### Scenario: Clear filters button appears only with active filters
- **WHEN** no search params are present
- **THEN** the "Limpiar filtros" button is not rendered

#### Scenario: Clear filters button resets all params
- **WHEN** `tipo=ACCIDENTE&estado=ABIERTO` are in the URL and the user clicks "Limpiar filtros"
- **THEN** all filter params including `page` and `showDeleted` are removed from the URL

#### Scenario: Changing a non-page filter resets page to 1
- **WHEN** the user is on page 3 and selects a different `estado` filter
- **THEN** the URL param `page` is reset to 1 along with the new `estado` value

---

### Requirement: IncidentList does not reset search params on mount
The system SHALL NOT clear or overwrite existing URL search params when IncidentList mounts. The component SHALL read `useSearchParams` as initial state and leave it unchanged if the user navigated back from a detail page or reloaded with params in the URL. No `useEffect` or initialization logic SHALL write to searchParams on mount.

#### Scenario: Filters survive navigation to detail and back
- **WHEN** a user has active filters `estado=ABIERTO&severidad=CRITICA` and clicks a row to navigate to `/incidents/:id`
- **AND** the user presses the browser back button to return to `/incidents`
- **THEN** the URL still contains `estado=ABIERTO&severidad=CRITICA` and the filter controls reflect those values

#### Scenario: Filters survive page reload
- **WHEN** a user has active filters `tipo=ACCIDENTE&page=2` in the URL and reloads the page
- **THEN** after reload, IncidentList renders with the tipo select showing "ACCIDENTE" and the list shows page 2

---

### Requirement: IncidentList renders a paginated table with 8 columns
The system SHALL render an `IncidentList` component with columns: Número, Tipo, Descripción, Área, Severidad, Estado, Fecha evento, and Acciones. The Número column SHALL display `incidente.numero` in a monospace font class. The Descripción column SHALL display `incidente.descripcion` truncated to 60 characters with ellipsis, with a native `title` attribute containing the full untruncated text. The Área column SHALL display the area name resolved from `AREAS_SHAC` using `incidente.areaId`. Severidad SHALL use `SeverityBadge` from `src/components/shared/SeverityBadge.tsx`. Estado SHALL use `IncidentStatusBadge`. Fecha evento SHALL be formatted with `formatDate()` from `src/utils/date.utils.ts`. Default `pageSize` SHALL be 10. Pagination SHALL use the shared `Pagination` component from `src/components/shared/Pagination.tsx`. Table rows SHALL use `TABLE_ROW_CLASS` from `src/constants/ui.constants.ts`.

#### Scenario: Loading state renders skeleton rows
- **WHEN** `useIncidentList` returns `isLoading: true`
- **THEN** the table body contains skeleton rows with pulse styling and no real incident data

#### Scenario: Empty state shows localized message
- **WHEN** the query resolves with zero incidents
- **THEN** `t('incidents:list.empty')` is displayed and no table rows are present

#### Scenario: Empty state with active filters shows specific message
- **WHEN** the query resolves with zero incidents and at least one filter param is active
- **THEN** a "No hay incidentes que coincidan con los filtros aplicados" message is displayed with a "Limpiar filtros" button

#### Scenario: Error state shows retry button
- **WHEN** the query resolves with `isError: true`
- **THEN** an error message and a button that calls `refetch` are rendered

#### Scenario: Número column shows monospace text
- **WHEN** an IncidentList row renders an incident
- **THEN** the Número cell displays `incidente.numero` with a monospace font class

#### Scenario: Descripción column shows truncated text with tooltip
- **WHEN** an IncidentList row renders an incident with descripcion longer than 60 characters
- **THEN** the Descripción cell truncates the text and has a `title` attribute containing the full text

#### Scenario: Área column resolves area name from AREAS_SHAC
- **WHEN** an IncidentList row renders an incident with `areaId`
- **THEN** the Área cell shows the display name from `AREAS_SHAC`, not the raw id

#### Scenario: Pagination controls update the page param via shared Pagination component
- **WHEN** a user clicks page 2 in the pagination controls
- **THEN** the URL param `page=2` is set and the list re-fetches with `page: 2`

#### Scenario: TABLE_ROW_CLASS applied to all table rows
- **WHEN** IncidentList renders its table
- **THEN** every `<tr>` element has the `TABLE_ROW_CLASS` value as its base class

---

### Requirement: IncidentList shows active filter chips below FilterBar
The system SHALL render dismissible chips below the FilterBar for each filter param that is active (not equal to its default value). Clicking a chip's dismiss control SHALL remove only that filter param from the URL and reset `page` to 1. The chips SHALL use labels from `INCIDENT_STATUS_LABELS`, `INCIDENT_TYPE_LABELS`, and the display names from `AREAS_SHAC` as appropriate.

#### Scenario: Active filter chip appears for tipo filter
- **WHEN** the URL contains `tipo=ACCIDENTE`
- **THEN** a chip with the label from `INCIDENT_TYPE_LABELS['ACCIDENTE']` appears below the FilterBar

#### Scenario: Dismissing a chip removes only that filter
- **WHEN** the URL contains `tipo=ACCIDENTE&estado=ABIERTO` and the user dismisses the tipo chip
- **THEN** the URL is updated to `estado=ABIERTO` with `page` reset to 1

#### Scenario: No chips shown when no filters are active
- **WHEN** no filter params are present in the URL
- **THEN** the chips area is not rendered

---

### Requirement: IncidentList actions column is role and state gated
The system SHALL render action icons in the Acciones column based on the user's role and the incident's state. The `Eye` icon SHALL always be visible for roles with `canView` permission per `getIncidentPermissions()`. The `Trash2` icon in `text-error` SHALL be visible only if `canDelete` is true AND `incidente.estado === 'ABIERTO'` AND `incidente.deletedAt` is null. The `RotateCcw` icon SHALL be visible only if `canRestore` is true AND `incidente.deletedAt` is not null. All action icons SHALL have descriptive `aria-label` attributes.

#### Scenario: Eye icon visible for all authorized viewers
- **WHEN** a user with `canView: true` renders IncidentList
- **THEN** the Eye icon appears in every row's Acciones column

#### Scenario: Trash2 icon visible only for deletable open incidents
- **WHEN** a user with `canDelete: true` renders IncidentList
- **THEN** the Trash2 icon appears only in rows where `estado === 'ABIERTO'` and `deletedAt` is null

#### Scenario: Trash2 icon not visible for non-ABIERTO incidents
- **WHEN** a user with `canDelete: true` renders IncidentList
- **THEN** rows where `estado !== 'ABIERTO'` do not show the Trash2 icon

#### Scenario: RotateCcw icon visible only for deleted incidents
- **WHEN** a user with `canRestore: true` renders IncidentList with `showDeleted=true`
- **THEN** the RotateCcw icon appears only in rows where `deletedAt` is not null

---

### Requirement: IncidentList deleted rows have attenuated style
The system SHALL render rows for incidents with a non-null `deletedAt` with `opacity-50` class applied and `line-through` class on the Descripción cell text. The `Trash2` icon SHALL NOT appear in deleted rows. The row SHALL remain clickable via the `Eye` icon.

#### Scenario: Deleted row has reduced opacity
- **WHEN** an IncidentList row renders an incident with non-null `deletedAt`
- **THEN** the row element has `opacity-50` class applied

#### Scenario: Deleted row description has strikethrough
- **WHEN** an IncidentList row renders an incident with non-null `deletedAt`
- **THEN** the Descripción cell text has `line-through` class applied

#### Scenario: Deleted row has no Trash2 icon
- **WHEN** an IncidentList row renders an incident with non-null `deletedAt`
- **THEN** the Trash2 icon is not present regardless of user role

---

### Requirement: IncidentList shows confirmation modal before deleting
The system SHALL display a confirmation modal before executing a delete mutation. The modal SHALL show the incident number in its body text and SHALL have "Cancelar" and "Eliminar" (danger style) buttons. The delete mutation SHALL NOT be called until the user confirms in the modal.

#### Scenario: Clicking Trash2 shows confirmation modal
- **WHEN** a user clicks the Trash2 icon on an incident row
- **THEN** a modal appears with title "¿Eliminar incidente?" and the incident number in the body

#### Scenario: Cancelling modal does not delete
- **WHEN** the confirmation modal is open and the user clicks "Cancelar"
- **THEN** the modal closes and the incident remains unchanged

#### Scenario: Confirming modal executes delete
- **WHEN** the confirmation modal is open and the user clicks "Eliminar"
- **THEN** `useDeleteIncident` mutation is called and a success toast appears on completion

#### Scenario: After successful delete with showDeleted inactive, row disappears
- **WHEN** the user confirms deletion and `showDeleted` is not active in the URL
- **THEN** the deleted incident row disappears from the list after the mutation completes

---

### Requirement: IncidentList shows confirmation modal before restoring
The system SHALL display a confirmation modal before executing a restore mutation. The modal SHALL show the incident number in its body text and SHALL have "Cancelar" and "Restaurar" (primary style) buttons. The restore mutation SHALL NOT be called until the user confirms in the modal.

#### Scenario: Clicking RotateCcw shows confirmation modal
- **WHEN** a user clicks the RotateCcw icon on a deleted incident row
- **THEN** a modal appears with title "¿Restaurar incidente?" and the incident number in the body

#### Scenario: Cancelling restore modal does not restore
- **WHEN** the restore confirmation modal is open and the user clicks "Cancelar"
- **THEN** the modal closes and the incident remains deleted

#### Scenario: Confirming restore executes restore mutation
- **WHEN** the restore confirmation modal is open and the user clicks "Restaurar"
- **THEN** `useRestoreIncident` mutation is called and a success toast appears on completion

#### Scenario: After successful restore, row appears without deleted styles
- **WHEN** the user confirms restoration
- **THEN** the restored incident row appears without `opacity-50` or `line-through` classes

---

### Requirement: useIncidentList maps URL search params to useIncidents query
The system SHALL export a `useIncidentList` hook from `src/features/incidents/hooks/useIncidentList.ts` that reads `tipo`, `estado`, `severidad`, `areaId`, `turno`, `fechaDesde`, `fechaHasta`, `search`, `showDeleted`, and `page` from `useSearchParams`, maps them to an `IncidentFilters` object with `pageSize: 10`, and delegates to `useIncidents()`. The hook SHALL return `{ incidentes, isLoading, isError, pagination, refetch }` with no UI logic or JSX.

#### Scenario: Hook returns incidentes array from query result
- **WHEN** `useIncidentList` is called and `useIncidents` resolves with data
- **THEN** `incidentes` equals the `data.data` array from the query response

#### Scenario: Hook passes tipo from URL param
- **WHEN** the URL contains `tipo=ACCIDENTE`
- **THEN** `useIncidents` is called with `tipo: 'ACCIDENTE'` in the filters object

#### Scenario: Hook passes showDeleted from URL param
- **WHEN** the URL contains `showDeleted=true`
- **THEN** `useIncidents` is called with `showDeleted: true` in the filters object

#### Scenario: Hook returns isLoading true during fetch
- **WHEN** `useIncidents` is pending
- **THEN** `useIncidentList` returns `isLoading: true`
