## ADDED Requirements

### Requirement: EN_VERIFICACION fixtures include auditorAsignadoId
All fixtures with `estado === 'EN_VERIFICACION'` SHALL have `auditorAsignadoId` set to the id of a user fixture with `rol === 'AUDITOR_INTERNO'`, so that the `AUDITOR_INTERNO` role has at least one QE actionable in `dashboard-acciones-requeridas` and in `quality-event-verificacion`'s REG-EFEC-001 form during development. Fixtures that never reached `EN_VERIFICACION` (i.e. never `CERRADO` or beyond) SHALL leave `auditorAsignadoId` absent.

#### Scenario: EN_VERIFICACION fixtures have auditorAsignadoId
- **WHEN** `qualityEventFixtures` is filtered by `f => f.estado === 'EN_VERIFICACION'`
- **THEN** every resulting fixture has a non-empty `auditorAsignadoId` matching an existing `AUDITOR_INTERNO` user fixture

#### Scenario: At least one AUDITOR_INTERNO fixture user has an assigned QE
- **WHEN** `userFixtures` is filtered to `rol === 'AUDITOR_INTERNO'` and cross-referenced against `qualityEventFixtures`
- **THEN** at least one such user id appears as `auditorAsignadoId` on at least one `EN_VERIFICACION` fixture

#### Scenario: Fixtures that never reached EN_VERIFICACION leave auditorAsignadoId unset
- **WHEN** `qualityEventFixtures` is filtered by `f => ['ABIERTO', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE'].includes(f.estado)`
- **THEN** none of the resulting fixtures have `auditorAsignadoId` set
