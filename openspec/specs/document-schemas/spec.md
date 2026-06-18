# document-schemas

Zod validation schemas for M1 Control Documentario mutation operations. Each schema validates its operation's input at the form/API boundary and exports an inferred TypeScript type.

## Requirements

### Requirement: createDocument Zod schema
The system SHALL provide a `createDocumentSchema` in `src/features/documents/schemas/createDocument.schema.ts` that validates: `titulo` (string, min 5, max 200), `tipo` (DocType enum), `area` (string, min 1), `revisorId` (UUID string), `aprobadorId` (UUID string), `descripcion` (string, max 2000, optional). The file SHALL also export `CreateDocumentInput` as the inferred type.

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

### Requirement: updateDocument Zod schema
The system SHALL provide an `updateDocumentSchema` in `src/features/documents/schemas/updateDocument.schema.ts` that validates the fields editable after creation: `titulo?`, `descripcion?`, `revisorId?`, `aprobadorId?`, `fechaVigencia?` (ISO date string). All fields are optional (partial update). The file SHALL also export `UpdateDocumentInput` as the inferred type.

#### Scenario: Partial update with only titulo passes validation
- **WHEN** `updateDocumentSchema.safeParse` receives `{ titulo: "Valid Title" }`
- **THEN** `success` is `true`

#### Scenario: Empty update object passes validation
- **WHEN** `updateDocumentSchema.safeParse` receives `{}`
- **THEN** `success` is `true` (all fields optional)

#### Scenario: Invalid revisorId UUID in update fails validation
- **WHEN** `updateDocumentSchema.safeParse` receives `{ revisorId: "not-a-uuid" }`
- **THEN** `success` is `false` and the error path includes `revisorId`

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
