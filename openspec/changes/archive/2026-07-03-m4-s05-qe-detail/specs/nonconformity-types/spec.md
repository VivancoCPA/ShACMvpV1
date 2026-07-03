## MODIFIED Requirements

### Requirement: AccionCorrectiva interface
The system SHALL define an `AccionCorrectiva` interface in `src/features/nonconformities/types/nonconformity.types.ts` with the following required fields: `id` (string), `ncId` (string), `descripcion` (string), `responsableId` (string), `responsableNombre` (string), `plazoFecha` (ISO 8601 string), `estado` (ACStatus), `creadoEn` (ISO 8601 string), `actualizadoEn` (ISO 8601 string). The interface SHALL include the following optional fields: `descripcionEvidencia` (string or undefined), `evidenciaUrl` (string or undefined), `fechaCierre` (ISO 8601 string or undefined), `qeId` (string or undefined — Modelo B: references the Quality Event that now owns this AC's continuation, when one exists).

#### Scenario: AccionCorrectiva requires all mandatory fields
- **WHEN** a developer constructs an `AccionCorrectiva` without `plazoFecha`
- **THEN** TypeScript emits a compile error for the missing required field

#### Scenario: AccionCorrectiva accepts absence of optional evidence fields
- **WHEN** a developer constructs an `AccionCorrectiva` with `descripcionEvidencia` and `evidenciaUrl` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: fechaCierre is only set when estado is COMPLETADA or VENCIDA
- **WHEN** a developer reads `accionCorrectiva.fechaCierre` on an AC in estado PENDIENTE
- **THEN** TypeScript allows `fechaCierre` to be `undefined` without narrowing error

#### Scenario: AccionCorrectiva accepts qeId as undefined
- **WHEN** a developer constructs an `AccionCorrectiva` with `qeId` omitted
- **THEN** TypeScript accepts the object without error

#### Scenario: qeId is typed as string or undefined
- **WHEN** a developer reads `accionCorrectiva.qeId`
- **THEN** TypeScript infers the type as `string | undefined`, not `string`
