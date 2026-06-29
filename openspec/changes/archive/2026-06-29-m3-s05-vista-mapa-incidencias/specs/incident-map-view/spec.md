# Spec: incident-map-view

## Purpose

Define los componentes de la vista mapa de incidentes del módulo M3: `IncidentMapView` (página), `IncidentMapCanvas` (plano PNG + marcadores agrupados), `IncidentMapLegend` (leyenda estática) e `IncidentMapSidePanel` (panel lateral al clic). Cubre el selector de local, la proyección de coordenadas porcentuales, el algoritmo de clustering por proximidad, el tooltip al hover, el panel lateral y todos los estados vacíos/error.

---

## ADDED Requirements

### Requirement: IncidentMapView compone todos los sub-componentes y gestiona el grupo seleccionado
`IncidentMapView` SHALL be exported from `src/features/incidents/pages/IncidentMapView.tsx`. It SHALL read `localId` from a URL search param `mapLocal` (default: first active local from `useLocales()`). It SHALL maintain `selectedGroup: MarkerGroup | null` as local React state (initial value `null`). It SHALL pass `onGroupClick` to `IncidentMapCanvas` to update `selectedGroup`, and pass `selectedGroup` and `onClose` to `IncidentMapSidePanel`. It SHALL consume the same `useIncidents()` call as the list view (via the existing `useIncidentList` hook, re-reading URL filter params). `IncidentMapView` SHALL be wrapped in an `ErrorBoundary` at the call site in `IncidentListPage`.

#### Scenario: IncidentMapView renders canvas and legend side by side with panel closed
- **WHEN** `IncidentMapView` renders with no selected group
- **THEN** `IncidentMapCanvas` and `IncidentMapLegend` are visible; `IncidentMapSidePanel` is not rendered

#### Scenario: IncidentMapView renders panel alongside canvas when a group is selected
- **WHEN** the user clicks a marker and `selectedGroup` becomes non-null
- **THEN** `IncidentMapSidePanel` is rendered with `selectedGroup` data alongside the canvas

#### Scenario: IncidentMapView closes panel when user clicks X
- **WHEN** the user clicks the close button in `IncidentMapSidePanel`
- **THEN** `selectedGroup` is set to `null` and `IncidentMapSidePanel` is unmounted

---

### Requirement: Local selector shows active locals and defaults to the first in the list
The system SHALL render a `<select>` dropdown at the top of `IncidentMapView` populated from `useLocales()`. Only locals with `activo: true` SHALL appear. The default selected value SHALL be the `id` of the first element in the active locals array. Selecting a different local SHALL update the `mapLocal` URL search param, which updates the displayed PNG and the filtered incident markers.

#### Scenario: Local selector options match active locals from useLocales
- **WHEN** `useLocales()` returns 2 active locals and 1 inactive local
- **THEN** the selector shows exactly 2 options

#### Scenario: Changing the local updates the mapLocal URL param
- **WHEN** the user selects a different local from the dropdown
- **THEN** `mapLocal` URL param is updated to the selected local's id

#### Scenario: mapLocal defaults to first active local on initial render
- **WHEN** `IncidentMapView` renders with no `mapLocal` in the URL
- **THEN** the first active local from `useLocales()` is used and its plano PNG is shown

---

### Requirement: IncidentMapCanvas renders the PNG floor plan as a responsive background
`IncidentMapCanvas` SHALL be defined in `src/features/incidents/components/IncidentMapCanvas.tsx`. It SHALL render the selected `local.planoPngUrl` via an `<img>` element inside a `position: relative` container. The `<img>` SHALL have `object-fit: contain` and SHALL fill the container width while preserving aspect ratio. The container SHALL have `overflow: hidden`. All marker `div` elements SHALL be siblings of the `<img>` inside the same `position: relative` container, with `position: absolute`.

#### Scenario: Canvas container has position relative and overflow hidden
- **WHEN** `IncidentMapCanvas` renders
- **THEN** the root container element has CSS classes that result in `position: relative` and `overflow: hidden`

#### Scenario: PNG image has object-fit contain
- **WHEN** `IncidentMapCanvas` renders with a valid `planoPngUrl`
- **THEN** the `<img>` element has the CSS class for `object-fit: contain`

---

### Requirement: IncidentMapCanvas shows empty state when PNG is null or fails to load
If `local.planoPngUrl` is `null`, `undefined`, or the `<img>` fires an `onError` event, `IncidentMapCanvas` SHALL replace the image with a centered empty state displaying the text from `t('incidents:map.planUnavailable')`. No markers SHALL be rendered in this state.

#### Scenario: Null planoPngUrl shows localized empty state
- **WHEN** `IncidentMapCanvas` receives `planoPngUrl={null}`
- **THEN** the image element is not rendered and `t('incidents:map.planUnavailable')` text is visible

#### Scenario: Image load error shows localized empty state
- **WHEN** the `<img>` element fires an `onError` event
- **THEN** the image is hidden and `t('incidents:map.planUnavailable')` text is visible

---

### Requirement: IncidentMapCanvas filters incidents by selected local and requires ubicacion (RN-MAP-001, RN-MAP-002)
`IncidentMapCanvas` SHALL only render markers for incidents where `incidente.localId === selectedLocalId` AND `incidente.ubicacion !== undefined`. Incidents without `ubicacion` or belonging to a different local SHALL be silently ignored (no error, no placeholder marker).

#### Scenario: Incident without ubicacion is not rendered
- **WHEN** the incidents array contains an incident with `localId` matching the selected local but `ubicacion` is `undefined`
- **THEN** no marker is rendered for that incident

#### Scenario: Incident with different localId is not rendered
- **WHEN** the incidents array contains an incident with `ubicacion` defined but `localId` does not match the selected local
- **THEN** no marker is rendered for that incident

---

### Requirement: IncidentMapCanvas groups incidents by proximity and computes centroids (RN-MAP-003)
`IncidentMapCanvas` SHALL compute clusters using a greedy scan over incidents sorted by `ubicacion.x` (ascending). Two incidents belong to the same cluster when their Euclidean distance in percentage coordinates is ≤ 5 (i.e., `sqrt((Δx)² + (Δy)²) ≤ 5`). Each cluster's centroid SHALL be the arithmetic mean of all member `x` and `y` values. The clustering computation SHALL be performed inside a `useMemo` that depends on the filtered incidents array and the selected local id.

#### Scenario: Six incidents within 5% of each other form one cluster
- **WHEN** six incidents all have `ubicacion` coordinates within 5 percentage units of each other
- **THEN** the clustering produces exactly one group containing all six incidents

#### Scenario: Two incidents more than 5% apart form separate clusters
- **WHEN** two incidents have `ubicacion` coordinates with Euclidean distance > 5
- **THEN** each incident forms its own cluster of size 1

#### Scenario: Cluster centroid is the mean of member coordinates
- **WHEN** a cluster contains two incidents at `{x:10, y:10}` and `{x:20, y:20}`
- **THEN** the cluster centroid is `{x:15, y:15}`

---

### Requirement: Marker visual style reflects cluster size
Each cluster marker SHALL be a circular `div` `position: absolute` centered at `left: centroid.x%` `top: centroid.y%` (using `transform: translate(-50%, -50%)`). Marker size and color SHALL follow: 1 incident → 20px diameter, Tailwind color `bg-blue-500`, opacity 0.85; 2–4 incidents → 30px diameter, Tailwind color `bg-amber`, opacity 0.85; 5+ incidents → 40px diameter, Tailwind color `bg-error`, opacity 0.85. Markers with N > 1 SHALL display `N` as centered white text inside the circle.

#### Scenario: Single incident marker is blue and 20px
- **WHEN** a cluster contains exactly 1 incident
- **THEN** the marker div has `w-5 h-5` (20px) and the `bg-blue-500` color class

#### Scenario: Cluster of 3 incidents is amber and 30px
- **WHEN** a cluster contains 3 incidents
- **THEN** the marker div has `w-[30px] h-[30px]` and the `bg-amber` color class

#### Scenario: Cluster of 5+ incidents is red and 40px
- **WHEN** a cluster contains 6 incidents (CA-ADD03-04)
- **THEN** the marker div has `w-10 h-10` (40px) and the `bg-error` color class

#### Scenario: Multi-incident markers show count
- **WHEN** a cluster contains N > 1 incidents
- **THEN** the marker div renders `N` as its text content

#### Scenario: Single incident marker shows no number
- **WHEN** a cluster contains exactly 1 incident
- **THEN** the marker div has no visible text content

---

### Requirement: Tooltip appears on marker hover with group summary
`IncidentMapCanvas` SHALL track `hoveredGroupId: string | null` as local React state. On `onMouseEnter` of a marker div, `hoveredGroupId` is set to the group id. On `onMouseLeave`, it is set to `null`. When a group is hovered, a tooltip `div` SHALL render `position: absolute` near the marker showing: (1) number of incidents in the group, (2) zone label — single zone name if all incidents share the same `zonaId`, otherwise `t('incidents:map.multipleZones')`, (3) most frequent `tipo` in the group using `INCIDENT_TYPE_LABELS`, (4) date of the most recent `fechaEvento` in the group formatted with `formatDate()`.

#### Scenario: Tooltip shows single zone name when all incidents share a zone
- **WHEN** hovering a cluster where all incidents have the same `zonaId`
- **THEN** the tooltip displays that zone's name (from `zonaNombre`)

#### Scenario: Tooltip shows "Varias zonas" when incidents span multiple zones
- **WHEN** hovering a cluster where incidents have different `zonaId` values
- **THEN** the tooltip displays `t('incidents:map.multipleZones')`

#### Scenario: Tooltip shows most frequent tipo
- **WHEN** hovering a cluster with 2 ACCIDENTE and 1 INCIDENTE
- **THEN** the tooltip shows the label for `ACCIDENTE`

#### Scenario: Tooltip shows date of most recent fechaEvento
- **WHEN** hovering a cluster whose incidents have different `fechaEvento` dates
- **THEN** the tooltip shows the most recent date formatted with `formatDate()`

#### Scenario: Tooltip not visible when no marker is hovered
- **WHEN** no marker is being hovered
- **THEN** no tooltip element is rendered

---

### Requirement: IncidentMapSidePanel shows single incident detail or multi-incident list
`IncidentMapSidePanel` SHALL be defined in `src/features/incidents/components/IncidentMapSidePanel.tsx`. It SHALL have a fixed width of 320px and render a close button (X icon with `aria-label` `t('common:actions.close')`) in the header. When the selected group has exactly 1 incident, it SHALL render: título, tipo (via `IncidentTypeBadge` or equivalent label), estado (via `IncidentStatusBadge`), área (resolved from `AREAS_SHAC`), `fechaEvento` formatted with `formatDate()`, `zonaNombre` (if present), `localNombre` (if present), and a `ButtonPrimary` "Ver detalle" that navigates to `/incidents/:id`. When the group has N > 1 incidents, it SHALL render a scrollable list of N rows, each showing: `numero` (monospace), estado badge, and `fechaEvento`. Clicking any row SHALL navigate to `/incidents/:id`.

#### Scenario: Single incident panel shows full summary and Ver detalle button
- **WHEN** a marker with 1 incident is clicked
- **THEN** the panel shows the incident's título, tipo, estado badge, área, fecha, and a "Ver detalle" button

#### Scenario: Multi-incident panel shows a list of incidents
- **WHEN** a marker with 3 incidents is clicked
- **THEN** the panel shows 3 rows each with `numero`, estado badge, and `fechaEvento`

#### Scenario: Ver detalle navigates to incident detail route
- **WHEN** the user clicks "Ver detalle" in a single-incident panel
- **THEN** navigation occurs to `/incidents/:id` for that incident

#### Scenario: Row click in multi-incident panel navigates to detail
- **WHEN** the user clicks a row in the multi-incident list
- **THEN** navigation occurs to `/incidents/:id` for that row's incident

#### Scenario: Close button hides the panel
- **WHEN** the user clicks the X button in the panel header
- **THEN** `onClose` is called and the panel is unmounted

---

### Requirement: IncidentMapLegend is always visible in the lower-left corner of the canvas
`IncidentMapLegend` SHALL be defined in `src/features/incidents/components/IncidentMapLegend.tsx`. It SHALL render as `position: absolute` bottom-left inside the canvas container, with a semi-transparent background (e.g., `bg-surface-card/80` or equivalent backdrop). It SHALL display three items: (1) blue circle "1 incidente", (2) amber circle "2–4 incidentes", (3) red circle `t('incidents:map.legend.fivePlus')` ("5 o más incidentes"). Legend items SHALL use the same color tokens as markers (`bg-blue-500`, `bg-amber`, `bg-error`).

#### Scenario: Legend renders three items
- **WHEN** `IncidentMapLegend` renders
- **THEN** three legend items are visible with blue, amber, and red circles

#### Scenario: Legend has semi-transparent background
- **WHEN** `IncidentMapLegend` renders
- **THEN** the legend container has a background with partial transparency (not fully opaque)

---

### Requirement: IncidentMapCanvas shows empty state when no geolocated incidents match the local and filters
When the filtered incidents array (after applying `localId` and `ubicacion` filters) is empty, `IncidentMapCanvas` SHALL render the PNG background normally (if available) AND overlay a centered empty state message `t('incidents:map.noIncidents')` ("Sin incidentes con ubicación registrada para este local") inside the canvas area. No markers SHALL be rendered.

#### Scenario: Empty state message shown when no geolocated incidents remain after filtering (CA-ADD03-05)
- **WHEN** the active filter `estado=ABIERTO` results in zero incidents with `ubicacion` for the selected local
- **THEN** `t('incidents:map.noIncidents')` is displayed and no marker divs are present

#### Scenario: Empty state message is shown on the PNG background, not replacing it
- **WHEN** there are no geolocated incidents but the PNG loads successfully
- **THEN** the PNG is still visible and the empty state message is overlaid on top

---

### Requirement: Filters from IncidentList propagate to map (RN-MAP-004)
`IncidentMapView` SHALL use `useIncidentList` to read filters from URL search params (`tipo`, `estado`, `severidad`, `areaId`, `turno`, `fechaDesde`, `fechaHasta`, `search`). The `incidentes` array returned by `useIncidentList` SHALL be passed directly to `IncidentMapCanvas` without additional filtering. Changing any filter param in `IncidentList` (while on the Lista tab) SHALL automatically affect the markers shown when switching to the Mapa tab.

#### Scenario: Estado filter ABIERTO limits visible markers (CA-ADD03-05)
- **WHEN** URL contains `estado=ABIERTO` and the user is on the Mapa tab
- **THEN** only markers representing incidents with `estado === 'ABIERTO'` appear on the canvas

#### Scenario: Switching between tabs does not reset filters
- **WHEN** the user has `tipo=ACCIDENTE` active and switches from Lista tab to Mapa tab
- **THEN** URL still contains `tipo=ACCIDENTE` and only ACCIDENTE markers are shown

---

### Requirement: Incidents from different locals appear on their respective local's map (CA-ADD03-09)
When `useLocales()` returns 2 active locals and the incident fixture contains incidents from both, only the incidents matching the currently selected local SHALL appear on the map.

#### Scenario: Local A incidents only appear on Local A map
- **WHEN** the user selects Local A in the dropdown
- **THEN** only incidents with `localId === localA.id` and defined `ubicacion` appear as markers

#### Scenario: Local B incidents only appear on Local B map
- **WHEN** the user selects Local B in the dropdown
- **THEN** only incidents with `localId === localB.id` and defined `ubicacion` appear as markers
