# Spec: incident-msw-fixtures (delta)

## Purpose

Amplía los fixtures de incidentes para que 10 de los 14 registros tengan datos de geolocalización (`localId`, `zonaId`, `ubicacion`), distribuidos en 2 locales distintos y formando al menos un cluster visible de 5+ incidentes para poder validar CA-ADD03-04.

---

## ADDED Requirements

### Requirement: Al menos 10 fixtures tienen datos de localización completos
De los 14 fixtures definidos en `src/mocks/fixtures/incidents.fixtures.ts`, al menos 10 SHALL have `localId`, `zonaId`, `ubicacion` (with `x` and `y` values), `localNombre`, and `zonaNombre` defined as non-undefined values. The remaining 4 SHALL have all five location fields as `undefined` (to verify RN-MAP-002 behavior). No existing required field (`id`, `numero`, `tipo`, `estado`, `severidad`, etc.) SHALL be removed or altered.

#### Scenario: Minimum 10 fixtures have ubicacion defined
- **WHEN** `incidentFixtures` is filtered by `f => f.ubicacion !== undefined`
- **THEN** the result has at least 10 elements

#### Scenario: At most 4 fixtures have no location data
- **WHEN** `incidentFixtures` is filtered by `f => f.localId === undefined`
- **THEN** the result has at most 4 elements

---

### Requirement: Fixtures distributed across 2 locales (CA-ADD03-09)
Among the geolocated fixtures, at least 4 SHALL have `localId === 'loc-001'` (Almacén Principal) and at least 4 SHALL have `localId === 'loc-002'` (Patio de Minerales). No geolocated fixture SHALL use a `localId` that does not exist in `localFixtures`.

#### Scenario: Both LOC-001 and LOC-002 are represented in geolocated fixtures
- **WHEN** geolocated fixtures are grouped by `localId`
- **THEN** group `'loc-001'` has at least 4 members and group `'loc-002'` has at least 4 members

---

### Requirement: At least 5 fixtures in LOC-001 form a visible cluster (CA-ADD03-04)
At least 5 fixtures with `localId === 'loc-001'` SHALL have `ubicacion` coordinates within a 5-percentage-unit Euclidean radius of each other (i.e., `sqrt((Δx)² + (Δy)²) ≤ 5` for all pairs in the cluster). This guarantees the red large marker (`bg-error`, 40px) appears when Local A is selected with no active filters.

#### Scenario: Five or more LOC-001 fixtures cluster into a single group
- **WHEN** the clustering algorithm (radius = 5) is applied to fixtures with `localId === 'loc-001'`
- **THEN** at least one resulting cluster contains 5 or more incidents

---

### Requirement: Fixtures reference valid zonaIds from zonaFixtures
Each geolocated fixture with `localId === 'loc-001'` SHALL have `zonaId` matching one of the 3 zones from `zonaFixtures` that belong to `LOC-001`. Each geolocated fixture with `localId === 'loc-002'` SHALL have `zonaId` matching one of the 2 zones from `zonaFixtures` that belong to `LOC-002`. This ensures the tooltip zone name lookup resolves without errors.

#### Scenario: LOC-001 fixture zonaIds are valid
- **WHEN** a LOC-001 geolocated fixture's `zonaId` is looked up in `zonaFixtures`
- **THEN** a matching zone with `localId === 'loc-001'` is found

#### Scenario: LOC-002 fixture zonaIds are valid
- **WHEN** a LOC-002 geolocated fixture's `zonaId` is looked up in `zonaFixtures`
- **THEN** a matching zone with `localId === 'loc-002'` is found
