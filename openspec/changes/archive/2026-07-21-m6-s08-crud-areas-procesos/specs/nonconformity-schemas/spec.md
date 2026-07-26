## MODIFIED Requirements

### Requirement: createNCSchema validates required fields for reporting a new NC

The system SHALL export a `createNCSchema` Zod schema from `src/features/nonconformities/schemas/createNC.schema.ts` that validates: `origen` (NCOrigen enum), `tipo` (NCTipo enum), `severidad` (NCSeveridad enum), `areaId` (string, min 1 — FK to `Area.id`, the M6-S08 administered area catalog), `descripcion` (string, min 10, max 2000), `fechaDeteccion` (ISO 8601 datetime string), `turno` (optional, `'DIA' | 'TARDE' | 'NOCHE'`), `mineralInvolucrado` (optional string, max 100), `accionInmediata` (optional string, max 1000), `documentosVinculados` (optional string array, defaults to `[]`).

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

#### Scenario: createNCSchema rejects missing areaId

- **WHEN** a developer parses an object without `areaId` through `createNCSchema`
- **THEN** Zod returns an error with path `['areaId']`
