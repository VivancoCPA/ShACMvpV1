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
