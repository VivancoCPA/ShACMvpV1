# Spec: incident-severidad

## Purpose

Auto-severity calculation for the incident domain. Provides a deterministic mapping from incident type and injured count to a severity level, used in M3-S04 to pre-fill the severity field in the incident creation form. The user may adjust the auto-calculated value.

---

## Requirements

### Requirement: getAutoSeveridad helper function
The system SHALL export a pure function `getAutoSeveridad(tipo: IncidentType, numLesionados?: number): IncidentSeveridad` from `src/features/incidents/utils/incidentSeveridad.ts`. The function SHALL return a severity level based on the following deterministic rules:
- `tipo === 'ACCIDENTE'` AND `numLesionados` > 1 → `'CRITICA'`
- `tipo === 'ACCIDENTE'` AND `numLesionados` === 1 → `'ALTA'`
- `tipo === 'ACCIDENTE'` AND `numLesionados` is absent or 0 → `'ALTA'` (default for ACCIDENTE without lesionados data)
- `tipo === 'INCIDENTE'` → `'MEDIA'`
- `tipo === 'CUASI_ACCIDENTE'` → `'MEDIA'`
- `tipo === 'CONDICION_INSEGURA'` → `'BAJA'`

The function is used in M3-S04 to pre-fill the severidad field in the incident creation form. The user MAY adjust the auto-calculated value.

#### Scenario: getAutoSeveridad returns CRITICA for ACCIDENTE with more than one injured
- **WHEN** a developer calls `getAutoSeveridad('ACCIDENTE', 2)`
- **THEN** the function returns `'CRITICA'`

#### Scenario: getAutoSeveridad returns ALTA for ACCIDENTE with exactly one injured
- **WHEN** a developer calls `getAutoSeveridad('ACCIDENTE', 1)`
- **THEN** the function returns `'ALTA'`

#### Scenario: getAutoSeveridad returns ALTA for ACCIDENTE with no lesionados data
- **WHEN** a developer calls `getAutoSeveridad('ACCIDENTE')`
- **THEN** the function returns `'ALTA'`

#### Scenario: getAutoSeveridad returns MEDIA for INCIDENTE
- **WHEN** a developer calls `getAutoSeveridad('INCIDENTE')`
- **THEN** the function returns `'MEDIA'`

#### Scenario: getAutoSeveridad returns MEDIA for CUASI_ACCIDENTE
- **WHEN** a developer calls `getAutoSeveridad('CUASI_ACCIDENTE')`
- **THEN** the function returns `'MEDIA'`

#### Scenario: getAutoSeveridad returns BAJA for CONDICION_INSEGURA
- **WHEN** a developer calls `getAutoSeveridad('CONDICION_INSEGURA')`
- **THEN** the function returns `'BAJA'`
