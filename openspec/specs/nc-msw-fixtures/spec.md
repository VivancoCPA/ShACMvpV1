# Spec: nc-msw-fixtures

## Purpose

Statically-typed fixture dataset for the M2 Non-Conformities domain. Provides the in-memory store for MSW handlers in development, covering all four business domains, all lifecycle states, all severity levels, and enough records to exercise pagination. Exported from `src/mocks/fixtures/nonconformities.fixtures.ts`.

---

## Requirements

### Requirement: Fixture dataset size and distribution
The system SHALL export a `nonconformityFixtures` constant from `src/mocks/fixtures/nonconformities.fixtures.ts` typed as `NoConformidad[]` containing at least 18 NC records. The dataset SHALL satisfy all of the following distribution constraints simultaneously:
- At least 3 NCs with `severidad: 'CRITICA'`
- At least 2 NCs with `estado: 'ANULADA'`
- At least 3 NCs whose `accionesCorrectivas` array contains at least one AC with `estado: 'VENCIDA'`
- All 4 `NCDominio` values represented (CALIDAD, SST, ADUANERO, OPERACIONAL) with at least 3 NCs each
- All 7 `NCStatus` values represented (ABIERTA, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE, CERRADA, ANULADA)
- `fechaDeteccion` values distributed across the last 6 months relative to the fixture creation date, so that date-range filters produce non-empty result sets across different month windows

#### Scenario: Dataset has at least 18 fixtures
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** `nonconformityFixtures.length` is greater than or equal to 18

#### Scenario: At least 3 CRITICA NCs exist
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering by `severidad === 'CRITICA'` returns at least 3 NCs

#### Scenario: At least 2 ANULADA NCs exist
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering by `estado === 'ANULADA'` returns at least 2 NCs

#### Scenario: At least 3 NCs have overdue ACs
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering NCs where `accionesCorrectivas.some(ac => ac.estado === 'VENCIDA')` returns at least 3 NCs

#### Scenario: pageSize 5 produces at least 4 pages
- **WHEN** a consumer paginates the full unfiltered fixture dataset with `pageSize: 5`
- **THEN** there are at least 4 pages (ceiling of 18 / 5 = 4 pages), making the sliding pagination window visible from the first render

#### Scenario: Date range filter on last 3 months returns a non-empty subset
- **WHEN** the MSW handler filters fixtures by `fechaDesde` = 3 months ago and `fechaHasta` = today
- **THEN** at least 5 NCs match (fixtures have dates spread across the last 6 months, not all clustered at one date)

#### Scenario: All 7 NCStatus values are represented
- **WHEN** the `nonconformityFixtures` array is imported
- **THEN** filtering by each of `ABIERTA`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`, `CERRADA`, `ANULADA` returns at least one NC

---

### Requirement: Fixtures cover all four NCDominio values
The fixture set SHALL include at least 3 NCs of domain `'CALIDAD'` (prefix NC-CAL), 3 of domain `'SST'` (prefix NC-SST), 3 of domain `'ADUANERO'` (prefix NC-ADU), and 3 of domain `'OPERACIONAL'` (prefix NC-OPE).

#### Scenario: All four domains are represented in fixtures
- **WHEN** a developer maps `nonconformityFixtures` by `dominio`
- **THEN** the set contains `'CALIDAD'`, `'SST'`, `'ADUANERO'`, and `'OPERACIONAL'`

#### Scenario: Each NC numero matches its dominio prefix
- **WHEN** a developer reads `nc.numero` for a fixture with `dominio='SST'`
- **THEN** the value starts with `'NC-SST-'`

---

### Requirement: Each NC fixture has 1 to 3 AccionesCorrectivas
Each fixture NC SHALL have between 1 and 3 entries in its `accionesCorrectivas` array. The AC dataset SHALL include ACs in all four distinct `ACStatus` states: `'PENDIENTE'`, `'EN_EJECUCION'`, `'COMPLETADA'`, and `'VENCIDA'`.

#### Scenario: Every fixture NC has at least one AccionCorrectiva
- **WHEN** a developer reads any fixture NC's `accionesCorrectivas`
- **THEN** the array length is between 1 and 3 inclusive

#### Scenario: AC status variety exists across fixtures
- **WHEN** a developer collects all ACs from all fixtures
- **THEN** the set of distinct `estado` values includes `'PENDIENTE'`, `'EN_EJECUCION'`, `'COMPLETADA'`, and `'VENCIDA'`

---

### Requirement: At least one NC-SST fixture has requiereIPER set to true
The fixture set SHALL include at least one NC with `dominio='SST'` and `requiereIPER=true`.

#### Scenario: SST NC with requiereIPER true exists
- **WHEN** a developer filters `nonconformityFixtures` by `dominio === 'SST' && requiereIPER === true`
- **THEN** at least one NC is found

---

### Requirement: At least one NC-ADU fixture has notificacionComercioExterior populated
The fixture set SHALL include at least one NC with `dominio='ADUANERO'` and `notificacionComercioExterior` set to a valid `NCNotificacionComercioExterior` object with non-empty `fecha`, `referencia`, and `descripcion` fields.

#### Scenario: ADU NC with notificacionComercioExterior exists
- **WHEN** a developer filters `nonconformityFixtures` by `dominio === 'ADUANERO' && notificacionComercioExterior !== undefined`
- **THEN** at least one NC is found with all three `NCNotificacionComercioExterior` fields populated

---

### Requirement: At least one NC fixture has qeGeneradoId set
The fixture set SHALL include at least one NC with `qeGeneradoId` set to a non-empty string referencing a simulated Quality Event ID (e.g., `'qe-001'`).

#### Scenario: At least one NC has a qeGeneradoId
- **WHEN** a developer filters `nonconformityFixtures` by `nc => nc.qeGeneradoId !== undefined`
- **THEN** at least one NC is found

---

### Requirement: All fixture NCs are fully typed as NoConformidad
The `nonconformityFixtures` constant SHALL be typed as `NoConformidad[]` with no type assertions (`as NoConformidad` casts) and no `any`. Each fixture SHALL satisfy the complete `NoConformidad` interface including all required fields.

#### Scenario: nonconformityFixtures is assignable to NoConformidad[]
- **WHEN** a developer assigns `nonconformityFixtures` to a variable typed `NoConformidad[]`
- **THEN** TypeScript accepts the assignment without errors or casts

---

### Requirement: Fixtures are re-exported from the fixtures index
The system SHALL re-export `nonconformityFixtures` from `src/mocks/fixtures/index.ts` so that MSW handlers and tests can import from the index without knowing the fixture file path.

#### Scenario: nonconformityFixtures importable from fixtures index
- **WHEN** a developer writes `import { nonconformityFixtures } from 'src/mocks/fixtures'`
- **THEN** TypeScript resolves the import without error

---

### Requirement: ACs of QE-referenced NC fixtures carry qeId
For the NC fixtures already cross-referenced from `quality-events.fixtures.ts` (i.e., NCs whose `id` matches an `ncId` used by a QE fixture), at least one of that NC's `accionesCorrectivas` SHALL have `qeId` set to the id of the QE that references it.

#### Scenario: Referenced NC's AC carries the owning QE's id
- **WHEN** a `nonconformityFixtures` entry has `id === 'nc-002'` (referenced by `qe-2026-002` via `ncId`)
- **THEN** at least one AC in that NC's `accionesCorrectivas` has `qeId === 'qe-2026-002'`
