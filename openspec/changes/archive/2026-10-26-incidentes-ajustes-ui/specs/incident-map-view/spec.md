## MODIFIED Requirements

### Requirement: IncidentMapCanvas renders the PNG floor plan as a responsive background
`IncidentMapCanvas` SHALL be defined in `src/features/incidents/components/IncidentMapCanvas.tsx`. Its root container SHALL be `position: relative` with `overflow: hidden`, and SHALL center its content (`flex items-center justify-center`). The selected `local.planoPngUrl` SHALL render via an `<img>` placed inside an inner wrapper (`relative inline-block max-w-full`) whose box matches the image exactly. The `<img>` SHALL be `block h-auto w-auto max-w-full max-h-[70vh]`, so the full floor plan is visible, never exceeds 70% of the viewport height or the available width, and preserves its aspect ratio. It SHALL NOT use `object-fit: contain`, because the letterbox bands would misalign the markers. All marker elements and their hover tooltips SHALL be descendants of that inner wrapper, with `position: absolute` and `left`/`top` expressed as a percentage of the wrapper, which is the percentage of the rendered image. The "plan unavailable" and "no incidents" overlays MAY remain in the root container.

#### Scenario: Canvas container has position relative and overflow hidden
- **WHEN** `IncidentMapCanvas` renders
- **THEN** the root container element has CSS classes that result in `position: relative` and `overflow: hidden`

#### Scenario: PNG image is capped at 70vh without object-contain
- **WHEN** `IncidentMapCanvas` renders with a valid `planoPngUrl`
- **THEN** the `<img>` element has the `max-h-[70vh]` and `max-w-full` classes and does not have `object-contain`

#### Scenario: Markers are positioned over the image wrapper
- **WHEN** `IncidentMapCanvas` renders with a valid `planoPngUrl` and at least one geolocated incident
- **THEN** each marker is a descendant of the same wrapper element that contains the `<img>`

## ADDED Requirements

### Requirement: IncidentMapView limits the map height
`IncidentMapView` SHALL use a minimum height of `min-h-[320px]` for the canvas + side panel row, which covers the state without a floor plan, instead of `min-h-[500px]`. `IncidentMapSidePanel` SHALL be capped at `max-h-[70vh]` and keep its internal scroll, so it never grows taller than the floor plan.

#### Scenario: Side panel capped
- **WHEN** a marker group is selected and `IncidentMapSidePanel` renders
- **THEN** its root element has the `max-h-[70vh]` class
