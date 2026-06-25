## ADDED Requirements

### Requirement: getDocuments pure function
The system SHALL export a `getDocuments(filters: DocFilters)` async function from `src/api/endpoints/documents.api.ts` that calls `GET /api/documents` via the shared Axios instance and returns `Promise<ApiResponse<Documento[]>>`. The function SHALL serialize all non-undefined filter fields as query parameters.

#### Scenario: getDocuments with no filters returns all documents
- **WHEN** `getDocuments({})` is called
- **THEN** it resolves with an `ApiResponse` containing a `data` array and a `pagination` object

#### Scenario: getDocuments with estado filter serializes parameter
- **WHEN** `getDocuments({ estado: 'PUBLICADO' })` is called
- **THEN** the HTTP request includes `?estado=PUBLICADO` in the query string

#### Scenario: getDocuments with search filter serializes parameter
- **WHEN** `getDocuments({ search: 'procedimiento' })` is called
- **THEN** the HTTP request includes `search=procedimiento` in the query string

### Requirement: getDocumentById pure function
The system SHALL export a `getDocumentById(id: string)` async function that calls `GET /api/documents/:id` and returns `Promise<ApiResponse<Documento>>`.

#### Scenario: getDocumentById with valid id resolves with document
- **WHEN** `getDocumentById('doc-001')` is called
- **THEN** it resolves with an `ApiResponse` whose `data` field is the matching `Documento`

#### Scenario: getDocumentById with unknown id rejects with 404 error
- **WHEN** `getDocumentById('nonexistent-id')` is called
- **THEN** the promise rejects with an Axios error whose response status is 404

### Requirement: createDocument pure function
The system SHALL export a `createDocument(data: CreateDocumentInput)` async function that calls `POST /api/documents` with the payload and returns `Promise<ApiResponse<Documento>>`.

#### Scenario: createDocument with valid payload resolves with new document
- **WHEN** `createDocument({ titulo: 'Política de Calidad', tipo: 'POL', area: 'Calidad', revisorId: '<uuid>', aprobadorId: '<uuid>' })` is called
- **THEN** it resolves with an `ApiResponse` whose `data.estado` is `'BORRADOR'`

### Requirement: updateDocument pure function
The system SHALL export an `updateDocument(id: string, data: UpdateDocumentInput)` async function that calls `PUT /api/documents/:id` with the partial payload and returns `Promise<ApiResponse<Documento>>`.

#### Scenario: updateDocument sends only provided fields
- **WHEN** `updateDocument('doc-001', { titulo: 'Nuevo Título' })` is called
- **THEN** the request body contains `{ titulo: 'Nuevo Título' }` and no other fields

### Requirement: changeDocumentStatus pure function
The system SHALL export a `changeDocumentStatus(id: string, payload: ChangeDocumentStatusPayload)` async function that calls `POST /api/documents/:id/status` and returns `Promise<ApiResponse<Documento>>`. The `ChangeDocumentStatusPayload` type SHALL include: `nuevoEstado: DocStatus`, `comentario?: string`, `firma: string` (required PIN — enforces RN-DOC-004).

#### Scenario: changeDocumentStatus with valid transition resolves with updated document
- **WHEN** `changeDocumentStatus('doc-001', { nuevoEstado: 'EN_REVISION', firma: '1234' })` is called on a BORRADOR document
- **THEN** it resolves with an `ApiResponse` whose `data.estado` is `'EN_REVISION'`

#### Scenario: changeDocumentStatus missing firma fails at type level
- **WHEN** a developer calls `changeDocumentStatus` without providing `firma`
- **THEN** TypeScript emits a compile error because `firma` is a required field

#### Scenario: changeDocumentStatus with invalid transition rejects
- **WHEN** `changeDocumentStatus('doc-001', { nuevoEstado: 'PUBLICADO', firma: '1234' })` is called on a BORRADOR document (invalid jump)
- **THEN** the promise rejects with an Axios error whose response status is 422

### Requirement: deleteDocument pure function
The system SHALL export a `deleteDocument(id: string)` async function that calls `DELETE /api/documents/:id` and returns `Promise<ApiResponse<void>>`.

#### Scenario: deleteDocument on BORRADOR document resolves successfully
- **WHEN** `deleteDocument('doc-borrador-id')` is called on a BORRADOR document with no QEs vinculados
- **THEN** it resolves with `success: true`

#### Scenario: deleteDocument on non-BORRADOR document rejects
- **WHEN** `deleteDocument('doc-publicado-id')` is called on a PUBLICADO document
- **THEN** the promise rejects with an Axios error whose response status is 409

### Requirement: Shared Axios instance
The API client SHALL import and use the singleton Axios instance from `src/lib/axios.ts`. It SHALL NOT create a new `axios.create()` instance or call `axios.get/post` directly.

#### Scenario: API functions use the shared instance
- **WHEN** the API module is imported
- **THEN** static analysis shows no `axios.create` call inside `documents.api.ts`
