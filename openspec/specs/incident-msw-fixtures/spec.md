# Spec: incident-msw-fixtures

## Purpose

Static mock fixtures for the Incidents module (`src/mocks/fixtures/incidents.fixtures.ts`). Provides a deterministic array of 14 `Incidente` objects covering all enum values, edge cases (soft-delete, audit trail, corrective actions), and realistic date/user rotation needed by MSW handlers and unit tests.

---

## Requirements

### Requirement: Fourteen static fixtures
The system SHALL define exactly 14 fixtures of type `Incidente[]` exported as `incidentFixtures` from `src/mocks/fixtures/incidents.fixtures.ts`.

#### Scenario: Fixture count
- **WHEN** `incidentFixtures` is imported
- **THEN** the array has exactly 14 elements

### Requirement: Fixture type and status coverage
The fixtures MUST collectively cover all values of `IncidentType`, `IncidentStatus`, `IncidentSeveridad`, and `IncidentTurno` (excluding `TODOS`) across the 14 records.

#### Scenario: All IncidentType values present
- **WHEN** the fixtures array is checked for unique `tipo` values
- **THEN** `ACCIDENTE`, `INCIDENTE`, `CUASI_ACCIDENTE`, and `CONDICION_INSEGURA` are all present

#### Scenario: All IncidentStatus values present
- **WHEN** the fixtures array is checked for unique `estado` values
- **THEN** `ABIERTO`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`, `CERRADO`, and `ANULADO` are all present

### Requirement: Fixture numbering format
Each fixture MUST have a `numero` field in format `INC-2026-NNN` where NNN is zero-padded to 3 digits (001–014).

#### Scenario: Fixture #1 numero
- **WHEN** `incidentFixtures[0].numero` is accessed
- **THEN** the value is `'INC-2026-001'`

### Requirement: One soft-deleted fixture
Exactly one fixture (fixture #14) MUST have `deletedAt` set to a non-null ISO 8601 string. All other fixtures MUST have `deletedAt` undefined.

#### Scenario: Fixture #14 has deletedAt
- **WHEN** `incidentFixtures[13].deletedAt` is accessed
- **THEN** the value is `'2026-06-01T10:00:00Z'`

#### Scenario: Other fixtures have no deletedAt
- **WHEN** fixtures 1–13 are checked for `deletedAt`
- **THEN** all values are `undefined`

### Requirement: AuditTrail entries per fixture
Each fixture MUST include at least one `AuditTrailEntry` in `auditTrail`. Fixtures #2 (ACCIDENTE/EN_INVESTIGACION with reporte tardío) MUST include at least two entries.

#### Scenario: Minimum audit trail
- **WHEN** any fixture's `auditTrail` is checked
- **THEN** `auditTrail.length >= 1`

#### Scenario: Fixture #2 has reporte tardío entry
- **WHEN** `incidentFixtures[1].auditTrail` is checked
- **THEN** at least one entry has `accion: 'REPORTE_TARDIO'`

### Requirement: AccionesCorrectivas in fixtures #5 and #11
Fixture #5 (INCIDENTE/EN_EJECUCION) MUST have at least 2 `AccionCorrectivaIncidente` entries. Fixture #11 (CONDICION_INSEGURA/EN_EJECUCION) MUST have at least 1.

#### Scenario: Fixture #5 has two ACs
- **WHEN** `incidentFixtures[4].accionesCorrectivas` is accessed
- **THEN** the array has length >= 2

#### Scenario: Fixture #11 has one AC
- **WHEN** `incidentFixtures[10].accionesCorrectivas` is accessed
- **THEN** the array has length >= 1

### Requirement: Consistent date fields
Each fixture MUST have `creadoEn`, `actualizadoEn`, and `fechaEvento` as valid ISO 8601 strings. `fechaReporte` MUST be >= `fechaEvento`.

#### Scenario: Dates are valid ISO strings
- **WHEN** any fixture's `creadoEn` is parsed with `new Date()`
- **THEN** the result is a valid Date (not NaN)

### Requirement: reportadoPorId rotation
The `reportadoPorId` field across all 14 fixtures MUST rotate among at least 4 different user IDs from the mock user pool (`user-001` through `user-008`).

#### Scenario: At least 4 distinct reporter IDs
- **WHEN** unique `reportadoPorId` values are collected from all fixtures
- **THEN** the set has size >= 4

### Requirement: areaId rotation
The `areaId` field across all 14 fixtures MUST rotate among at least 4 distinct values from `AREAS_SHAC`.

#### Scenario: At least 4 distinct areas
- **WHEN** unique `areaId` values are collected from all fixtures
- **THEN** the set has size >= 4

---

### Requirement: Local fixtures (ADD-03)
The system SHALL define exactly 4 `Local` objects exported as `localFixtures` from `src/mocks/fixtures/incidents.fixtures.ts`. The four locales SHALL be:
- `LOC-001` — **Almacén Principal** (active, `planoPngUrl: '/mock/plano-placeholder.png'`)
- `LOC-002` — **Patio de Minerales** (active, `planoPngUrl: '/mock/plano-placeholder.png'`)
- `LOC-003` — **Muelle de Carga** (active, `planoPngUrl: '/mock/plano-placeholder.png'`)
- `LOC-004` — **Oficinas Administrativas** (active, `planoPngUrl: '/mock/plano-placeholder.png'`)

All four are `activo: true`. The total count of 4 is within the RN-LOC-001 limit of 5 active locales.

#### Scenario: Local fixture count
- **WHEN** `localFixtures` is imported
- **THEN** the array has exactly 4 elements

#### Scenario: All locales are active
- **WHEN** `localFixtures` is checked for `activo`
- **THEN** all 4 have `activo: true`

#### Scenario: planoPngUrl placeholder is present
- **WHEN** any `localFixtures[n].planoPngUrl` is read
- **THEN** the value is `'/mock/plano-placeholder.png'`

---

### Requirement: Zona fixtures per local (ADD-03)
The system SHALL define a `zonaFixtures` array of `Zona` objects exported from `src/mocks/fixtures/incidents.fixtures.ts`. Each of the 4 locales SHALL have 2–4 representative zones reflecting the operational context of that site:
- **LOC-001 Almacén Principal**: Zona de Recepción, Zona de Almacenamiento, Zona de Despacho, Zona de Carga (4 zonas)
- **LOC-002 Patio de Minerales**: Área de Acopio Norte, Área de Acopio Sur, Zona de Pesaje (3 zonas)
- **LOC-003 Muelle de Carga**: Muelle A, Muelle B, Zona de Espera (3 zonas)
- **LOC-004 Oficinas Administrativas**: Recepción, Área Administrativa, Sala de Reuniones (3 zonas)

All zones are `activo: true`. Zone codes follow the `ZON-NNN` format.

#### Scenario: Total zona fixture count
- **WHEN** `zonaFixtures` is imported
- **THEN** the array has exactly 13 elements (4 + 3 + 3 + 3)

#### Scenario: Zones belong to correct local
- **WHEN** `zonaFixtures` is filtered by `localId === 'loc-001'`
- **THEN** exactly 4 zones are returned

---

### Requirement: Incident fixtures distribute localId and zonaId (ADD-03)
The existing 14 `incidentFixtures` SHALL be updated to include `localId` and `zonaId` fields drawn from the 4 locales and their zones. The distribution SHALL ensure at least 3 different locales appear across the 14 fixtures to provide varied data for the map/filter features. Fixtures #13 and #14 (CERRADO and soft-deleted) MAY omit `localId` and `zonaId` to test the absence case. All other existing fixture fields remain unchanged.

#### Scenario: At least 3 distinct localIds across fixtures
- **WHEN** unique `localId` values are collected from fixtures with a defined `localId`
- **THEN** the set has size >= 3

#### Scenario: Fixtures without localId are accepted
- **WHEN** an `Incidente` fixture has `localId` omitted
- **THEN** TypeScript accepts the object and the MSW list handler includes it in results

---

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

---

### Requirement: ACs of QE-referenced incident fixtures carry qeId
`inc-001` and `inc-002` — the two incident fixtures cross-referenced from `quality-events.fixtures.ts` via `incidenteId` (by `qe-2026-005` and `qe-2026-001` respectively) — currently have `accionesCorrectivas: []`. The system SHALL add at least one `AccionCorrectivaIncidente` to each, with `qeId` set to the id of the QE that references it.

#### Scenario: inc-001 has an AC carrying qe-2026-005's id
- **WHEN** `incidentFixtures` entry `id === 'inc-001'` is inspected
- **THEN** `accionesCorrectivas` is non-empty and at least one entry has `qeId === 'qe-2026-005'`

#### Scenario: inc-002 has an AC carrying qe-2026-001's id
- **WHEN** `incidentFixtures` entry `id === 'inc-002'` is inspected
- **THEN** `accionesCorrectivas` is non-empty and at least one entry has `qeId === 'qe-2026-001'`
