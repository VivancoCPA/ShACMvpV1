# nc-msw-fixtures

Statically-typed fixture dataset for the M2 Non-Conformities domain. Used as the in-memory store for MSW handlers in development. Exported from `src/mocks/fixtures/nonconformities.fixtures.ts` and re-exported from `src/mocks/fixtures/index.ts`.

## ADDED Requirements

### Requirement: Minimum 8 NC fixtures covering all four domains
The system SHALL export a `nonconformityFixtures` constant from `src/mocks/fixtures/nonconformities.fixtures.ts` typed as `NoConformidad[]` containing at least 8 NC records. The fixtures SHALL include at least 2 NCs of domain `'CALIDAD'` (prefix NC-CAL), 2 of domain `'SST'` (prefix NC-SST), 2 of domain `'ADUANERO'` (prefix NC-ADU), and 2 of domain `'OPERACIONAL'` (prefix NC-OPE).

#### Scenario: nonconformityFixtures has at least 8 entries
- **WHEN** a developer reads `nonconformityFixtures.length`
- **THEN** the value is greater than or equal to 8

#### Scenario: All four domains are represented in fixtures
- **WHEN** a developer maps `nonconformityFixtures` by `dominio`
- **THEN** the set contains `'CALIDAD'`, `'SST'`, `'ADUANERO'`, and `'OPERACIONAL'`

#### Scenario: Each NC numero matches its dominio prefix
- **WHEN** a developer reads `nc.numero` for a fixture with `dominio='SST'`
- **THEN** the value starts with `'NC-SST-'`

### Requirement: Fixtures cover all three severities
The fixture set SHALL include at least one NC with `severidad='MENOR'`, at least one with `severidad='MAYOR'`, and at least one with `severidad='CRITICA'`.

#### Scenario: CRITICA severity is represented
- **WHEN** a developer filters `nonconformityFixtures` by `severidad === 'CRITICA'`
- **THEN** at least one NC is found

### Requirement: Fixtures cover all lifecycle states
The fixture set SHALL include NCs in at least four distinct `NCStatus` states, including `DETECTADA`, `EN_INVESTIGACION`, `CERRADA`, and at least one other state (`EN_CORRECCION`, `PENDIENTE_CIERRE`, or `REABIERTA`).

#### Scenario: CERRADA state is represented
- **WHEN** a developer filters `nonconformityFixtures` by `estado === 'CERRADA'`
- **THEN** at least one NC is found

#### Scenario: DETECTADA state is represented
- **WHEN** a developer filters `nonconformityFixtures` by `estado === 'DETECTADA'`
- **THEN** at least one NC is found

### Requirement: Each NC fixture has 1 to 3 AccionesCorrectivas
Each fixture NC SHALL have between 1 and 3 entries in its `accionesCorrectivas` array. The AC dataset SHALL include ACs in at least three distinct `ACStatus` states: `'PENDIENTE'`, `'EN_EJECUCION'`, and `'COMPLETADA'`.

#### Scenario: Every fixture NC has at least one AccionCorrectiva
- **WHEN** a developer reads any fixture NC's `accionesCorrectivas`
- **THEN** the array length is between 1 and 3 inclusive

#### Scenario: AC status variety exists across fixtures
- **WHEN** a developer collects all ACs from all fixtures
- **THEN** the set of distinct `estado` values includes `'PENDIENTE'`, `'EN_EJECUCION'`, and `'COMPLETADA'`

### Requirement: At least one NC-SST fixture has requiereIPER set to true
The fixture set SHALL include at least one NC with `dominio='SST'` and `requiereIPER=true`.

#### Scenario: SST NC with requiereIPER true exists
- **WHEN** a developer filters `nonconformityFixtures` by `dominio === 'SST' && requiereIPER === true`
- **THEN** at least one NC is found

### Requirement: At least one NC-ADU fixture has notificacionComercioExterior populated
The fixture set SHALL include at least one NC with `dominio='ADUANERO'` and `notificacionComercioExterior` set to a valid `NCNotificacionComercioExterior` object with non-empty `fecha`, `referencia`, and `descripcion` fields.

#### Scenario: ADU NC with notificacionComercioExterior exists
- **WHEN** a developer filters `nonconformityFixtures` by `dominio === 'ADUANERO' && notificacionComercioExterior !== undefined`
- **THEN** at least one NC is found with all three `NCNotificacionComercioExterior` fields populated

### Requirement: At least one NC fixture has qeGeneradoId set
The fixture set SHALL include at least one NC with `qeGeneradoId` set to a non-empty string referencing a simulated Quality Event ID (e.g., `'qe-001'`). This represents an NC that triggered automatic QE creation.

#### Scenario: At least one NC has a qeGeneradoId
- **WHEN** a developer filters `nonconformityFixtures` by `nc => nc.qeGeneradoId !== undefined`
- **THEN** at least one NC is found

### Requirement: All fixture NCs are fully typed as NoConformidad
The `nonconformityFixtures` constant SHALL be typed as `NoConformidad[]` with no type assertions (`as NoConformidad` casts) and no `any`. Each fixture SHALL satisfy the complete `NoConformidad` interface including all required fields.

#### Scenario: nonconformityFixtures is assignable to NoConformidad[]
- **WHEN** a developer assigns `nonconformityFixtures` to a variable typed `NoConformidad[]`
- **THEN** TypeScript accepts the assignment without errors or casts

### Requirement: Fixtures are re-exported from the fixtures index
The system SHALL re-export `nonconformityFixtures` from `src/mocks/fixtures/index.ts` so that MSW handlers and tests can import from the index without knowing the fixture file path.

#### Scenario: nonconformityFixtures importable from fixtures index
- **WHEN** a developer writes `import { nonconformityFixtures } from 'src/mocks/fixtures'`
- **THEN** TypeScript resolves the import without error
