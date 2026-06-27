# nonconformity-schemas

Zod validation schemas for M2 non-conformity operations. Consumed by React Hook Form in create/edit forms and by API mutation hooks.

## Requirements

### Requirement: createNCSchema validates required fields for reporting a new NC
The system SHALL export a `createNCSchema` Zod schema from `src/features/nonconformities/schemas/createNC.schema.ts` that validates: `origen` (NCOrigen enum), `tipo` (NCTipo enum), `severidad` (NCSeveridad enum), `areaAfectada` (string, min 1, max 200), `descripcion` (string, min 10, max 2000), `fechaDeteccion` (ISO 8601 datetime string), `turno` (optional, `'DIA' | 'TARDE' | 'NOCHE'`), `mineralInvolucrado` (optional string, max 100), `accionInmediata` (optional string, max 1000), `documentosVinculados` (optional string array, defaults to `[]`).

#### Scenario: createNCSchema rejects missing origen
- **WHEN** a developer parses an object without `origen` through `createNCSchema`
- **THEN** Zod returns an error with path `['origen']`

#### Scenario: createNCSchema rejects descripcion shorter than 10 characters
- **WHEN** a developer parses an object with `descripcion: 'Corto'` (5 chars) through `createNCSchema`
- **THEN** Zod returns an error with path `['descripcion']`

#### Scenario: createNCSchema accepts valid optional fields as absent
- **WHEN** a developer parses a valid payload without `mineralInvolucrado` and `turno` through `createNCSchema`
- **THEN** Zod returns success with those fields as `undefined`

#### Scenario: CreateNCInput type is inferred from createNCSchema
- **WHEN** a developer imports `CreateNCInput` from the schemas file
- **THEN** TypeScript infers it as `z.infer<typeof createNCSchema>` with no `any`

### Requirement: updateNCSchema validates only fields editable after creation
The system SHALL export an `updateNCSchema` Zod schema from `src/features/nonconformities/schemas/updateNC.schema.ts` that accepts only fields that remain editable after `DETECTADA`: `responsableInvestigacionId` (optional UUID), `accionInmediata` (optional string, max 1000), `accionInmediataFecha` (optional ISO 8601 date), `correccion` (optional string, max 2000), `correccionEvidenciaUrl` (optional URL string), `causaRaiz` (optional string, max 2000), `documentosVinculados` (optional string array). The schema SHALL use `.partial()` or all fields optional so a partial update is valid.

#### Scenario: updateNCSchema accepts partial payload with only one field
- **WHEN** a developer parses `{ causaRaiz: 'Falta de procedimiento' }` through `updateNCSchema`
- **THEN** Zod returns success

#### Scenario: updateNCSchema rejects fields that belong to createNCSchema only
- **WHEN** a developer parses an object containing `descripcion` through `updateNCSchema`
- **THEN** Zod strips `descripcion` (strict mode) or TypeScript rejects the field at compile time via `UpdateNCInput` type

#### Scenario: UpdateNCInput type is inferred from updateNCSchema
- **WHEN** a developer imports `UpdateNCInput` from the schemas file
- **THEN** TypeScript infers it as `z.infer<typeof updateNCSchema>` with all fields optional and no `any`

### Requirement: cambiarEstadoNCSchema validates state transition payload
The system SHALL export a `cambiarEstadoNCSchema` Zod schema from `src/features/nonconformities/schemas/cambiarEstadoNC.schema.ts` that validates: `nuevoEstado` (NCStatus enum), `comentario` (string, min 1, max 500), `correccionEvidenciaUrl` (optional URL string, required when `nuevoEstado === 'PENDIENTE_CIERRE'`).

#### Scenario: cambiarEstadoNCSchema rejects missing comentario
- **WHEN** a developer parses `{ nuevoEstado: 'EN_INVESTIGACION' }` through `cambiarEstadoNCSchema`
- **THEN** Zod returns an error with path `['comentario']`

#### Scenario: cambiarEstadoNCSchema requires correccionEvidenciaUrl when transitioning to PENDIENTE_CIERRE
- **WHEN** a developer parses `{ nuevoEstado: 'PENDIENTE_CIERRE', comentario: 'Listo' }` without `correccionEvidenciaUrl` through `cambiarEstadoNCSchema`
- **THEN** Zod returns an error with path `['correccionEvidenciaUrl']`

#### Scenario: cambiarEstadoNCSchema does not require correccionEvidenciaUrl for other transitions
- **WHEN** a developer parses `{ nuevoEstado: 'EN_INVESTIGACION', comentario: 'Iniciando' }` through `cambiarEstadoNCSchema`
- **THEN** Zod returns success without requiring `correccionEvidenciaUrl`

#### Scenario: CambiarEstadoNCInput type is inferred from cambiarEstadoNCSchema
- **WHEN** a developer imports `CambiarEstadoNCInput` from the schemas file
- **THEN** TypeScript infers it as `z.infer<typeof cambiarEstadoNCSchema>` with no `any`
