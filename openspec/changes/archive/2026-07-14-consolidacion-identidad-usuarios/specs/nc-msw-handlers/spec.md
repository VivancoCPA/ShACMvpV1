## MODIFIED Requirements

### Requirement: POST /api/nonconformities/:id/acciones-correctivas handler
The system SHALL implement an MSW v2 handler for `POST /api/nonconformities/:id/acciones-correctivas` that: (1) returns HTTP 404 if the NC does not exist; (2) validates that `descripcion`, `responsableId`, and `plazoFecha` are present — returns HTTP 400 if any is missing; (3) creates a new `AccionCorrectiva` with `estado: 'PENDIENTE'`, resolving its `responsableNombre` from `responsableId` via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`) — never falling back to the literal string `'Usuario'` for a `responsableId` that resolves to a real `authFixtures` account or a `seedLegacyNames` entry — appends it to `nc.accionesCorrectivas`, appends an audit trail entry with `accion: 'AC_CREADA'`, and returns HTTP 201 with `ApiResponse<AccionCorrectiva>`.

#### Scenario: POST creates AC with PENDIENTE state
- **WHEN** a client calls `POST /api/nonconformities/nc-001/acciones-correctivas` with valid `{ descripcion, responsableId, plazoFecha }`
- **THEN** the handler returns HTTP 201 with `data.estado === 'PENDIENTE'`

#### Scenario: POST returns 400 when descripcion is missing
- **WHEN** a client calls `POST /api/nonconformities/nc-001/acciones-correctivas` without `descripcion`
- **THEN** the handler returns HTTP 400

#### Scenario: POST resolves responsableNombre for a real, non-legacy account
- **WHEN** a client calls `POST /api/nonconformities/nc-001/acciones-correctivas` with `{ ..., responsableId: 'user-supervisor-002' }`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the created AC's `responsableNombre` is the resolved display name, never the literal string `'Usuario'`
