# Spec: incident-plazo

## Purpose

Investigation deadline helper for the incident domain. Provides a deterministic mapping from severity level to maximum business-day deadline per ISO 45001 §10.2. Used in M3-S04 to compute the suggested investigation deadline when a new incident is reported.

---

## Requirements

### Requirement: getPlazoInvestigacion helper function
The system SHALL export a pure function `getPlazoInvestigacion(severidad: IncidentSeveridad): number` from `src/features/incidents/utils/incidentPlazoInvestigacion.ts`. The function SHALL return the maximum investigation deadline in business days according to the following rules:
- `'CRITICA'` → 3
- `'ALTA'` → 7
- `'MEDIA'` → 10
- `'BAJA'` → 15

The returned number represents calendar-equivalent business days for ISO 45001 §10.2 compliance. The value is used in M3-S04 to compute the suggested investigation deadline when a new incident is reported.

#### Scenario: getPlazoInvestigacion returns 3 for CRITICA
- **WHEN** a developer calls `getPlazoInvestigacion('CRITICA')`
- **THEN** the function returns `3`

#### Scenario: getPlazoInvestigacion returns 7 for ALTA
- **WHEN** a developer calls `getPlazoInvestigacion('ALTA')`
- **THEN** the function returns `7`

#### Scenario: getPlazoInvestigacion returns 10 for MEDIA
- **WHEN** a developer calls `getPlazoInvestigacion('MEDIA')`
- **THEN** the function returns `10`

#### Scenario: getPlazoInvestigacion returns 15 for BAJA
- **WHEN** a developer calls `getPlazoInvestigacion('BAJA')`
- **THEN** the function returns `15`

#### Scenario: getPlazoInvestigacion return type is number
- **WHEN** a developer inspects the return type of `getPlazoInvestigacion`
- **THEN** TypeScript infers the return type as `number`, not `3 | 7 | 10 | 15`
