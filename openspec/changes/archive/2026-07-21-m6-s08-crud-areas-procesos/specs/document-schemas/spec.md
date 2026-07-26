## MODIFIED Requirements

### Requirement: createDocument Zod schema

The system SHALL provide a `createDocumentSchema` in `src/features/documents/schemas/createDocument.schema.ts` that validates: `titulo` (string, min 5, max 200), `tipo` (DocType enum), `areaId` (string, min 1 — FK to `Area.id`, the M6-S08 administered area catalog), `confidencialidad` (DocConfidencialidad enum, required, default `'INTERNO'`), `rolesAutorizados` (array of UserRole enum, required with min(1) when `confidencialidad === 'RESTRINGIDO'`, otherwise optional), `revisorId` (UUID string), `aprobadorId` (UUID string), `descripcion` (string, max 2000, optional). The file SHALL also export `CreateDocumentInput` as the inferred type.

#### Scenario: Valid create payload passes validation

- **WHEN** `createDocumentSchema.safeParse` receives a complete valid payload
- **THEN** `success` is `true` and the parsed data matches the input

#### Scenario: titulo below minimum length fails validation

- **WHEN** `createDocumentSchema.safeParse` receives `titulo` with fewer than 5 characters
- **THEN** `success` is `false` and the error path includes `titulo`

#### Scenario: titulo above maximum length fails validation

- **WHEN** `createDocumentSchema.safeParse` receives `titulo` with more than 200 characters
- **THEN** `success` is `false` and the error path includes `titulo`

#### Scenario: Invalid tipo value fails validation

- **WHEN** `createDocumentSchema.safeParse` receives a `tipo` value not in the DocType union
- **THEN** `success` is `false` and the error path includes `tipo`

#### Scenario: Invalid UUID for revisorId fails validation

- **WHEN** `createDocumentSchema.safeParse` receives `revisorId` that is not a valid UUID
- **THEN** `success` is `false` and the error path includes `revisorId`

#### Scenario: Missing optional descripcion passes validation

- **WHEN** `createDocumentSchema.safeParse` receives a payload without `descripcion`
- **THEN** `success` is `true`

#### Scenario: RESTRINGIDO without rolesAutorizados fails createDocument validation

- **WHEN** `createDocumentSchema.safeParse` receives `{ confidencialidad: 'RESTRINGIDO', rolesAutorizados: [] }`
- **THEN** `success` is `false` and the error path includes `rolesAutorizados`

#### Scenario: INTERNO without rolesAutorizados passes createDocument validation

- **WHEN** `createDocumentSchema.safeParse` receives a valid payload with `confidencialidad: 'INTERNO'` and no `rolesAutorizados`
- **THEN** `success` is `true`

#### Scenario: Missing areaId fails validation

- **WHEN** `createDocumentSchema.safeParse` receives a payload without `areaId`
- **THEN** `success` is `false` and the error path includes `areaId`
