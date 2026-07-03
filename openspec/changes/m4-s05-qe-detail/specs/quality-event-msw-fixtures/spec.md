## ADDED Requirements

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
