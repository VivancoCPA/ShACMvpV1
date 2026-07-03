# Spec: quality-event-types

## Purpose

TypeScript type definitions for the Quality Event domain (`src/features/quality-events/types/qualityEvent.types.ts`). TBD: the full `QualityEvent` interface and its supporting union types are pending sync from `m4-s01-quality-event-tipos-schemas`. This spec currently documents only the fields added by `m4-s05-qe-detail`.

---

## Requirements

### Requirement: QualityEvent tracks pending AC requests via solicitudesAC
The system SHALL add a `solicitudesAC: number` field (default `0`) to the `QualityEvent` interface in `src/features/quality-events/types/qualityEvent.types.ts`, incremented each time an NC or Incident owner requests that a new AC be created against the QE.

#### Scenario: New QE defaults solicitudesAC to 0
- **WHEN** a `QualityEvent` fixture or newly created QE has no explicit `solicitudesAC`
- **THEN** `solicitudesAC` defaults to `0`

#### Scenario: solicitudesAC is typed as a required number
- **WHEN** a developer constructs a `QualityEvent` without `solicitudesAC`
- **THEN** TypeScript emits a compile error for the missing required field
