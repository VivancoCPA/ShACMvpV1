## ADDED Requirements

### Requirement: Closure and verification data anchored to the current KPI period
A representative subset of `qualityEventFixtures` in `CERRADO` or `VERIFICADO` state SHALL carry `fechaCierre`, `ciclo`, `auditTrail` `ANALISIS_COMPLETADO` entries, and `resultadoVerificacion`/`fechaVerificacionRealizada` values anchored to the reference "current period" date 2026-07-01 (matching the reference date used elsewhere in this spec), so that the period-scoped dashboard KPI formulas (Tasa de cierre en plazo, Tiempo promedio de cierre, Tasa de reincidencia, Tasa de eficacia de ACs, Tiempo promedio de investigación) produce non-zero results from the static fixture set without any change to the calculation code.

#### Scenario: At least one CERRADO/VERIFICADO fixture closes in-plazo within the current month
- **WHEN** `qualityEventFixtures` is filtered to `estado ∈ {CERRADO, VERIFICADO}` with `fechaCierre` in 2026-07
- **THEN** at least one result has business days from `fechaHoraReporte` to `fechaCierre` at or under its severity's plazo (BAJA=22, MEDIA=17, ALTA=14, CRITICA=10 días hábiles)

#### Scenario: At least one CERRADO/VERIFICADO fixture closes out-of-plazo within the current month
- **WHEN** `qualityEventFixtures` is filtered to `estado ∈ {CERRADO, VERIFICADO}` with `fechaCierre` in 2026-07
- **THEN** at least one result has business days from `fechaHoraReporte` to `fechaCierre` over its severity's plazo

#### Scenario: At least one CERRADO/VERIFICADO fixture closing in-period has ciclo > 1
- **WHEN** `qualityEventFixtures` is filtered to `estado ∈ {CERRADO, VERIFICADO}` with `fechaCierre` in the 2026-Q3 quarter
- **THEN** at least one result has `ciclo > 1`

#### Scenario: At least one fixture has an ANALISIS_COMPLETADO audit entry timestamped in the current month
- **WHEN** each fixture's `auditTrail` is scanned for entries with `accion === 'ESTADO_CAMBIADO' && estadoNuevo === 'ANALISIS_COMPLETADO'`
- **THEN** at least one such entry across all fixtures has a `timestamp` in 2026-07, and that entry's `timestamp` is on or after the owning fixture's `fechaHoraReporte`

#### Scenario: At least one verified AccionCorrectiva is EFECTIVO and at least one is NO_EFECTIVO within the current month
- **WHEN** `qeAccionesCorrectivas` entries with `estado === 'CERRADA'` are joined to their owning fixture's `resultadoVerificacion` and `fechaVerificacionRealizada`
- **THEN** among entries whose owning fixture's `fechaVerificacionRealizada` falls in 2026-07, at least one owning fixture has `resultadoVerificacion === 'EFECTIVO'` and at least one has `resultadoVerificacion === 'NO_EFECTIVO'`
