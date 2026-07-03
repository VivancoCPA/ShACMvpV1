## ADDED Requirements

### Requirement: QualityEvent tracks pending AC requests via solicitudesAC
The system SHALL add a `solicitudesAC: number` field (default `0`) to the `QualityEvent` interface in `src/features/quality-events/types/qualityEvent.types.ts`, incremented each time an NC or Incident owner requests that a new AC be created against the QE.

#### Scenario: New QE defaults solicitudesAC to 0
- **WHEN** a `QualityEvent` fixture or newly created QE has no explicit `solicitudesAC`
- **THEN** `solicitudesAC` defaults to `0`

#### Scenario: solicitudesAC is typed as a required number
- **WHEN** a developer constructs a `QualityEvent` without `solicitudesAC`
- **THEN** TypeScript emits a compile error for the missing required field
