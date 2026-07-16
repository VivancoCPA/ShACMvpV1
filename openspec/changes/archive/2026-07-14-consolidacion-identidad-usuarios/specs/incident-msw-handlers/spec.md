## MODIFIED Requirements

### Requirement: POST /api/incidents/:id/acciones
The handler MUST append a new `AccionCorrectivaIncidente` to the incident and return 201. The created AC's `responsableNombre` SHALL be resolved from the request's `responsableId` via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`) — the handler SHALL NOT persist `undefined`, a raw unresolved id, or an otherwise corrupted value for any `responsableId` that resolves to a real `authFixtures` account or a `seedLegacyNames` entry.

#### Scenario: AC created and appended
- **WHEN** `POST /api/incidents/inc-005/acciones` is called with a valid body
- **THEN** the response status is 201 and the incident's `accionesCorrectivas` array grows by 1

#### Scenario: POST resolves responsableNombre for a real, non-legacy account
- **WHEN** `POST /api/incidents/inc-005/acciones` is called with `{ ..., responsableId: 'user-supervisor-002' }`, an id present in `authFixtures` but absent from the removed `users.fixtures.ts` catalog
- **THEN** the created AC's `responsableNombre` is the resolved display name, never `undefined` or a raw id fragment
