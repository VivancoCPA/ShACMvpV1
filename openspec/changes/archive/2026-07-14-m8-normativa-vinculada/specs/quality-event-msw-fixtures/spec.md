## ADDED Requirements

### Requirement: O3 fixtures carry hallazgoCodigo and normativaVinculada, not hallazgoAuditoriaRef
Every fixture `QualityEvent` with `origen === 'O3_HALLAZGO_AUDITORIA'` SHALL define `hallazgoCodigo` and `normativaVinculada` and SHALL NOT define `hallazgoAuditoriaRef`. Fixtures previously carrying `hallazgoAuditoriaRef: 'HAL-XXXX-NNN · <Norma> · §<Cláusula>'` SHALL be migrated field-by-field: the `HAL-XXXX-NNN` segment becomes `hallazgoCodigo`; the `<Norma>` segment maps to `normativaVinculada.norma` (`'ISO 9001:2015'` → `'ISO_9001_2015'`, `'ISO 45001:2018'` → `'ISO_45001_2018'`, any non-ISO label → `'OTRA'` with that label preserved verbatim in `normativaVinculada.normaOtraDetalle`); the `§<Cláusula>` segment becomes `normativaVinculada.clausula` (without the `§` prefix). Any `auditTrail` entry in the same fixture with `campoModificado: 'hallazgoAuditoriaRef'` SHALL be updated to `campoModificado: 'normativaVinculada'` with `valorNuevo` reflecting the migrated value.

#### Scenario: QE-2026-003 migrates ISO 9001:2015 clause 8.4.1
- **WHEN** fixtures are loaded and the QE with `numero: 'QE-2026-003'` is read
- **THEN** it has `hallazgoCodigo: 'HAL-2026-001'`, `normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' }`, and no `hallazgoAuditoriaRef` property

#### Scenario: QE-2026-011 migrates ISO 45001:2018 clause 8.2
- **WHEN** fixtures are loaded and the QE with `numero: 'QE-2026-011'` is read
- **THEN** it has `hallazgoCodigo: 'HAL-2026-003'`, `normativaVinculada: { norma: 'ISO_45001_2018', clausula: '8.2' }`, and no `hallazgoAuditoriaRef` property

#### Scenario: QE-2026-015 migrates a non-ISO reference to norma OTRA
- **WHEN** fixtures are loaded and the QE with `numero: 'QE-2026-015'` (previously `hallazgoAuditoriaRef: 'HAL-2026-004 · Auditoría Operacional · §3.2'`) is read
- **THEN** it has `hallazgoCodigo: 'HAL-2026-004'` and `normativaVinculada: { norma: 'OTRA', normaOtraDetalle: 'Auditoría Operacional', clausula: '3.2' }`

#### Scenario: No fixture QE retains hallazgoAuditoriaRef
- **WHEN** all fixtures are loaded and filtered to `origen === 'O3_HALLAZGO_AUDITORIA'`
- **THEN** none of them has a `hallazgoAuditoriaRef` property, migrated or otherwise

#### Scenario: Migrated audit trail entries reference normativaVinculada, not hallazgoAuditoriaRef
- **WHEN** the fixture QE with `numero: 'QE-2026-011'` or `numero: 'QE-2026-019'` is read
- **THEN** any `auditTrail` entry that previously had `campoModificado: 'hallazgoAuditoriaRef'` now has `campoModificado: 'normativaVinculada'`
