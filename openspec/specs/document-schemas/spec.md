# document-schemas

Zod validation schemas for M1 Control Documentario mutation operations. Each schema validates its operation's input at the form/API boundary and exports an inferred TypeScript type.

## Requirements

### Requirement: DocConfidencialidad type
The system SHALL define a `DocConfidencialidad` union type in `src/types/api.types.ts` (alongside the existing M1 types) with four values: `'PUBLICO' | 'INTERNO' | 'CONFIDENCIAL' | 'RESTRINGIDO'`. The `Documento` interface SHALL include `confidencialidad: DocConfidencialidad` (required, default `'INTERNO'`) and `rolesAutorizados?: UserRole[]` (optional, present only when `confidencialidad === 'RESTRINGIDO'`). MSW document fixtures SHALL include a `confidencialidad` field on every mock document using varied values across the fixture set, and a `rolesAutorizados` array (empty or populated) on fixtures whose `confidencialidad` is `'RESTRINGIDO'`.

#### Scenario: Documento type includes confidencialidad field
- **WHEN** a `Documento` object is constructed in TypeScript
- **THEN** omitting `confidencialidad` causes a compile error (required field)

#### Scenario: rolesAutorizados is typed as optional UserRole array
- **WHEN** a `Documento` object has `confidencialidad: 'RESTRINGIDO'`
- **THEN** `rolesAutorizados` can hold an array of `UserRole` values without type errors

#### Scenario: MSW fixtures include confidencialidad with varied values
- **WHEN** the document fixtures are loaded
- **THEN** each fixture document has a `confidencialidad` value and RESTRINGIDO fixtures have a non-empty `rolesAutorizados` array

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

### Requirement: updateDocument Zod schema
The system SHALL provide an `updateDocumentSchema` in `src/features/documents/schemas/updateDocument.schema.ts` that validates the fields editable after creation: `titulo?`, `descripcion?`, `revisorId?`, `aprobadorId?`, `fechaVigencia?` (ISO date string), `confidencialidad?` (DocConfidencialidad enum), `rolesAutorizados?` (array of UserRole enum, required with min(1) when `confidencialidad === 'RESTRINGIDO'`). All fields are optional (partial update). The file SHALL also export `UpdateDocumentInput` as the inferred type.

#### Scenario: Partial update with only titulo passes validation
- **WHEN** `updateDocumentSchema.safeParse` receives `{ titulo: "Valid Title" }`
- **THEN** `success` is `true`

#### Scenario: Empty update object passes validation
- **WHEN** `updateDocumentSchema.safeParse` receives `{}`
- **THEN** `success` is `true` (all fields optional)

#### Scenario: Invalid revisorId UUID in update fails validation
- **WHEN** `updateDocumentSchema.safeParse` receives `{ revisorId: "not-a-uuid" }`
- **THEN** `success` is `false` and the error path includes `revisorId`

#### Scenario: Partial update with only confidencialidad RESTRINGIDO fails without rolesAutorizados
- **WHEN** `updateDocumentSchema.safeParse` receives `{ confidencialidad: 'RESTRINGIDO', rolesAutorizados: [] }`
- **THEN** `success` is `false` and the error path includes `rolesAutorizados`

#### Scenario: Partial update changing confidencialidad to INTERNO passes without rolesAutorizados
- **WHEN** `updateDocumentSchema.safeParse` receives `{ confidencialidad: 'INTERNO' }`
- **THEN** `success` is `true`

### Requirement: changeDocumentStatus Zod schema
The system SHALL provide a `changeDocumentStatusSchema` in `src/features/documents/schemas/changeDocumentStatus.schema.ts` that validates: `nuevoEstado` (DocStatus enum), `comentario?` (string, max 1000). The file SHALL also export `ChangeDocumentStatusInput` as the inferred type.

#### Scenario: Valid status transition payload passes validation
- **WHEN** `changeDocumentStatusSchema.safeParse` receives `{ nuevoEstado: 'EN_REVISION' }`
- **THEN** `success` is `true`

#### Scenario: Invalid status value fails validation
- **WHEN** `changeDocumentStatusSchema.safeParse` receives `{ nuevoEstado: 'INVALID_STATE' }`
- **THEN** `success` is `false` and the error path includes `nuevoEstado`

#### Scenario: Optional comentario accepted when provided
- **WHEN** `changeDocumentStatusSchema.safeParse` receives `{ nuevoEstado: 'PUBLICADO', comentario: 'Aprobado' }`
- **THEN** `success` is `true`
