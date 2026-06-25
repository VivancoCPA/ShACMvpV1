## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: createDocument Zod schema
The system SHALL provide a `createDocumentSchema` in `src/features/documents/schemas/createDocument.schema.ts` that validates: `titulo` (string, min 5, max 200), `tipo` (DocType enum), `area` (string, min 1), `confidencialidad` (DocConfidencialidad enum, required, default `'INTERNO'`), `rolesAutorizados` (array of UserRole enum, required with min(1) when `confidencialidad === 'RESTRINGIDO'`, otherwise optional), `revisorId` (UUID string), `aprobadorId` (UUID string), `descripcion` (string, max 2000, optional). The file SHALL also export `CreateDocumentInput` as the inferred type.

#### Scenario: RESTRINGIDO without rolesAutorizados fails createDocument validation
- **WHEN** `createDocumentSchema.safeParse` receives `{ confidencialidad: 'RESTRINGIDO', rolesAutorizados: [] }`
- **THEN** `success` is `false` and the error path includes `rolesAutorizados`

#### Scenario: INTERNO without rolesAutorizados passes createDocument validation
- **WHEN** `createDocumentSchema.safeParse` receives a valid payload with `confidencialidad: 'INTERNO'` and no `rolesAutorizados`
- **THEN** `success` is `true`

### Requirement: updateDocument Zod schema
The system SHALL provide an `updateDocumentSchema` in `src/features/documents/schemas/updateDocument.schema.ts` that validates the fields editable after creation: `titulo?`, `descripcion?`, `revisorId?`, `aprobadorId?`, `fechaVigencia?` (ISO date string), `confidencialidad?` (DocConfidencialidad enum), `rolesAutorizados?` (array of UserRole enum, required with min(1) when `confidencialidad === 'RESTRINGIDO'`). All fields are optional (partial update). The file SHALL also export `UpdateDocumentInput` as the inferred type.

#### Scenario: Partial update with only confidencialidad RESTRINGIDO fails without rolesAutorizados
- **WHEN** `updateDocumentSchema.safeParse` receives `{ confidencialidad: 'RESTRINGIDO', rolesAutorizados: [] }`
- **THEN** `success` is `false` and the error path includes `rolesAutorizados`

#### Scenario: Partial update changing confidencialidad to INTERNO passes without rolesAutorizados
- **WHEN** `updateDocumentSchema.safeParse` receives `{ confidencialidad: 'INTERNO' }`
- **THEN** `success` is `true`
