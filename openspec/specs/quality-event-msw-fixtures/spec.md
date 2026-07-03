# Spec: quality-event-msw-fixtures

## Purpose

Static mock fixtures for the Quality Events module (`src/mocks/fixtures/quality-events.fixtures.ts`). Provides a deterministic array of at least 20 `QualityEvent` objects covering all enum values, reincidence cycles, terminal states, and a date distribution across the last 6 months so that pagination, date filtering, and badge rendering are all visually verifiable in development.

---

## Requirements

### Requirement: At least 20 static fixtures
The system SHALL define at least 20 fixtures of type `QualityEvent[]` exported as `qualityEventFixtures` from `src/mocks/fixtures/quality-events.fixtures.ts`. The minimum count of 20 ensures a second page exists when the default `pageSize` of 10 is applied.

#### Scenario: Fixture count satisfies pagination threshold
- **WHEN** `qualityEventFixtures` is imported
- **THEN** the array has at least 20 elements

---

### Requirement: Full enum coverage across fixtures
The fixtures SHALL collectively cover all values of `QEOrigin`, `QEType`, `QESeverity`, and `QEStatus` across the array. All 4 origins, 4 types, 4 severities, and all 9 lifecycle states SHALL appear at least once.

#### Scenario: All QEOrigin values present
- **WHEN** unique `origen` values are collected from all fixtures
- **THEN** `O1_INCIDENTE_CAMPO`, `O2_NC_DETECTADA`, `O3_HALLAZGO_AUDITORIA`, and `O4_REPORTE_EXTERNO` are all present

#### Scenario: All QEType values present
- **WHEN** unique `tipo` values are collected from all fixtures
- **THEN** `CALIDAD`, `SST`, `ADUANERO`, and `OPERACIONAL` are all present

#### Scenario: All QESeverity values present
- **WHEN** unique `severidad` values are collected from all fixtures
- **THEN** `BAJA`, `MEDIA`, `ALTA`, and `CRITICA` are all present

#### Scenario: All QEStatus values present
- **WHEN** unique `estado` values are collected from all fixtures
- **THEN** all 9 states (`ABIERTO`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`, `CERRADO`, `EN_VERIFICACION`, `VERIFICADO`, `REABIERTO`) are present

---

### Requirement: Fixture numbering format
Each fixture SHALL have a `numero` field in the format `QE-2025-NNN` or `QE-2026-NNN` where NNN is zero-padded to 3 digits. No two fixtures SHALL share the same `numero`.

#### Scenario: First fixture numero format
- **WHEN** `qualityEventFixtures[0].numero` is accessed
- **THEN** the value matches the pattern `QE-20\d\d-\d{3}`

#### Scenario: All numeros are unique
- **WHEN** `numero` values from all fixtures are placed in a Set
- **THEN** the Set size equals the total fixture count

---

### Requirement: fechaHoraEvento distributed across the last 6 months
The `fechaHoraEvento` field across all fixtures SHALL be spread across the 6-month window ending on the current reference date (2026-07-01), so that applying `fechaDesde`/`fechaHasta` date filters produces non-empty and non-full subsets for visual verification.

#### Scenario: Fixtures span multiple months
- **WHEN** unique month values are extracted from all `fechaHoraEvento` fields
- **THEN** at least 4 distinct calendar months are represented

#### Scenario: No fixture has a future fechaHoraEvento
- **WHEN** all `fechaHoraEvento` values are compared against the reference date 2026-07-01
- **THEN** all values are on or before 2026-07-01

---

### Requirement: At least 5 fixtures with ciclo > 1
At least 5 fixtures SHALL have `ciclo >= 2` to exercise the Reincidencia badge. Their `ciclo` values SHALL include at least one instance of `ciclo === 3` to verify that the badge label reads "Reincidencia ×3".

#### Scenario: Minimum reincidence fixtures
- **WHEN** `qualityEventFixtures` is filtered by `f => f.ciclo > 1`
- **THEN** the result has at least 5 elements

#### Scenario: ciclo 3 present in at least one fixture
- **WHEN** `qualityEventFixtures` is filtered by `f => f.ciclo === 3`
- **THEN** the result has at least 1 element

---

### Requirement: At least 2 fixtures in VERIFICADO state
At least 2 fixtures SHALL have `estado === 'VERIFICADO'` so that filtering by active states (e.g., `estado=ABIERTO`) produces a visually empty second page scenario, and filtering by `VERIFICADO` shows a non-empty result.

#### Scenario: At least 2 VERIFICADO fixtures
- **WHEN** `qualityEventFixtures` is filtered by `f => f.estado === 'VERIFICADO'`
- **THEN** the result has at least 2 elements

---

### Requirement: EN_VERIFICACION fixtures include fechaVerificacionProgramada
All fixtures with `estado === 'EN_VERIFICACION'` SHALL have `fechaVerificacionProgramada` set to a non-null ISO 8601 string so that `DeadlineBadge` always receives a valid date prop for those rows.

#### Scenario: EN_VERIFICACION fixtures have fechaVerificacionProgramada
- **WHEN** `qualityEventFixtures` is filtered by `f => f.estado === 'EN_VERIFICACION'`
- **THEN** every result has `fechaVerificacionProgramada` defined and parseable as a Date

---

### Requirement: AuditTrail and consistent date fields
Each fixture SHALL include at least one `AuditTrailEntry` in `auditTrail`. `fechaReporte` SHALL be a valid ISO 8601 string on or after `fechaHoraEvento`. `creadoEn` and `actualizadoEn` SHALL be valid ISO 8601 strings.

#### Scenario: Minimum audit trail per fixture
- **WHEN** any fixture's `auditTrail` is checked
- **THEN** `auditTrail.length >= 1`

#### Scenario: fechaReporte is not before fechaHoraEvento
- **WHEN** any fixture's `fechaReporte` and `fechaHoraEvento` are compared
- **THEN** `new Date(fechaReporte) >= new Date(fechaHoraEvento)`

---

### Requirement: reportadoPorId rotation
The `reportadoPorId` field across all fixtures SHALL rotate among at least 4 different user IDs from the mock user pool (`user-001` through `user-008`).

#### Scenario: At least 4 distinct reporter IDs
- **WHEN** unique `reportadoPorId` values are collected from all fixtures
- **THEN** the set has size >= 4

---

### Requirement: At least 5 fixtures carry seeded acciones-correctivas
The fixture file SHALL define a `qeAccionesCorrectivas: Record<string, AccionCorrectivaQE[]>` map with 2–3 ACs for at least 5 of the 20 `qualityEventFixtures`, used to seed each matching QE's `accionesCorrectivas` array at module load. The `TODO(M4-S05)` comments marking the unresolved Modelo A/B ownership question SHALL be removed from the file.

#### Scenario: At least 5 QEs have non-empty accionesCorrectivas
- **WHEN** `qualityEventFixtures` is imported
- **THEN** filtering by `qe => qe.accionesCorrectivas.length > 0` returns at least 5 QEs

#### Scenario: Seeded ACs have 2 to 3 entries and reference their owning QE
- **WHEN** any seeded QE's `accionesCorrectivas` is inspected
- **THEN** the array has between 2 and 3 elements, and every element's `qeId` equals that QE's `id`

#### Scenario: No TODO(M4-S05) markers remain
- **WHEN** `quality-events.fixtures.ts` is inspected
- **THEN** it contains no `TODO(M4-S05)` comment

---

### Requirement: Every fixture QE has at least 4 audit trail entries
Each of the 20 `qualityEventFixtures` SHALL have `auditTrail.length >= 4`, covering at minimum a creation entry, a state-change entry, a field-edit entry, and (for QEs whose `estado` has progressed past `EN_INVESTIGACION`) a causa-raíz-approval entry.

#### Scenario: Every fixture has at least 4 audit entries
- **WHEN** each fixture in `qualityEventFixtures` is inspected
- **THEN** `auditTrail.length >= 4` for all 20 fixtures
