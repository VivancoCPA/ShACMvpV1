## MODIFIED Requirements

### Requirement: IncidentMapCanvas renders the PNG floor plan as a responsive background
`IncidentMapCanvas` SHALL be defined in `src/features/incidents/components/IncidentMapCanvas.tsx`. It SHALL render the selected local's floor plan via an `<img>` element inside a `position: relative` container. The `<img>` SHALL have `object-fit: contain` and SHALL fill the container width while preserving aspect ratio. The container SHALL have `overflow: hidden`. All marker `div` elements SHALL be siblings of the `<img>` inside the same `position: relative` container, with `position: absolute`.

The plan image SHALL NOT be loaded from `local.planoPngUrl` as a static URL passed directly to `<img src>`. Instead, the component (or a parent hook) SHALL request `GET /api/locales/{id}/plano` through the authenticated `api` instance with `{ responseType: 'blob' }` (`private-file-storage`), and render the `<img>` from the resulting object URL (`URL.createObjectURL`), revoked on unmount/local change.

#### Scenario: Plan renders as object-fit: contain background
- **WHEN** `IncidentMapCanvas` renders for a local with a plano
- **THEN** the plan image loads via an authenticated request and renders with `object-fit: contain`, filling the container width while preserving aspect ratio

#### Scenario: Object URL is revoked when the local changes
- **WHEN** the user switches to a different local
- **THEN** the previous plan's object URL is revoked and a new authenticated request is made for the new local's plano

### Requirement: IncidentMapCanvas shows empty state when PNG is null or fails to load
If the selected local has no plano (the authenticated request responds `404`), or the resulting `<img>` fires an `onError` event, `IncidentMapCanvas` SHALL replace the image with a centered empty state displaying the text from `t('incidents:map.planUnavailable')`. No markers SHALL be rendered in this state.

#### Scenario: Local without a plano shows localized empty state
- **WHEN** the selected local's `GET /api/locales/{id}/plano` responds `404`
- **THEN** `IncidentMapCanvas` shows the empty state text instead of an image, and no markers are rendered

#### Scenario: Image load error shows empty state
- **WHEN** the resolved object URL fails to render (`onError`)
- **THEN** `IncidentMapCanvas` shows the empty state text instead of an image
