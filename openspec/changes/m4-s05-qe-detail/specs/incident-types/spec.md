## MODIFIED Requirements

### Requirement: AccionCorrectivaIncidente interface
The system SHALL define an `AccionCorrectivaIncidente` interface in `src/features/incidents/types/incident.types.ts` with the following required fields: `id` (string), `incidenteId` (string — provisional until M4), `descripcion` (string), `responsableId` (string), `fechaLimite` (ISO 8601 date string), `estado` (`'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'CERRADA'`), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `evidencia` (string or undefined), `qeId` (string or undefined — Modelo B: references the Quality Event that now owns this AC's continuation, when one exists).

#### Scenario: AccionCorrectivaIncidente requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` without `fechaLimite`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectivaIncidente accepts absence of evidencia
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` with `evidencia` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: AccionCorrectivaIncidente accepts qeId as undefined
- **WHEN** a developer constructs an `AccionCorrectivaIncidente` with `qeId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: qeId is typed as string or undefined
- **WHEN** a developer reads `accionCorrectivaIncidente.qeId`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`
