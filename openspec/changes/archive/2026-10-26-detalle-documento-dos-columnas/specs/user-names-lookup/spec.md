## MODIFIED Requirements

### Requirement: GET /api/users/nombres resolves display names for a list of ids
The system SHALL expose `GET /api/users/nombres?ids=<guid>,<guid>,...`, protected by `RequireAuthorization()` and `RequireEmpresaActivaFilter` (no role restriction — any authenticated user with an active empresa may call it). Given a comma-separated list of user ids, it SHALL return `ApiResponse<UserNombreDto[]>` where `UserNombreDto = { id: string, nombreCompleto: string, nombre?: string, apellido?: string, avatarUrl?: string }` — `nombre`, `apellido`, and `avatarUrl` are additive and optional (never `email` or `rol`, which SHALL continue to never appear in the response). The response SHALL include an entry for every requested id that belongs to the caller's active empresa (via any `usuarios_empresa` row, active or inactive — see the inclusion-of-inactive-users requirement below) and SHALL silently omit any id that does not — belonging to another empresa, or not existing at all — without returning an error or a 404 for those ids specifically.

#### Scenario: Resolves names for ids belonging to the active empresa
- **WHEN** an authenticated user with active empresa `empresa-001` calls `GET /api/users/nombres?ids=<id-a>,<id-b>` and both ids belong to `empresa-001`
- **THEN** the response is `200` with an array containing `{ id, nombreCompleto, nombre, apellido }` (plus `avatarUrl` when the user has one) for both ids

#### Scenario: Silently omits an id from another empresa
- **WHEN** the requested `ids` list includes one id that belongs only to a different empresa than the caller's active one
- **THEN** that id is simply absent from the response array — the request still returns `200`, no error is raised for that id

#### Scenario: Silently omits a non-existent id
- **WHEN** the requested `ids` list includes a well-formed GUID that does not correspond to any user
- **THEN** that id is absent from the response array, with no error

#### Scenario: Response never includes email or rol
- **WHEN** any `GET /api/users/nombres` response is inspected
- **THEN** no entry has an `email` or `rol` property, regardless of whether `avatarUrl` is present

#### Scenario: avatarUrl is included when the user has one
- **WHEN** a requested id belongs to a user whose `avatarUrl` (a base64 data URI) is set
- **THEN** that entry's `avatarUrl` matches the stored value exactly

#### Scenario: avatarUrl is omitted (not an empty string) when the user has none
- **WHEN** a requested id belongs to a user with no `avatarUrl` set
- **THEN** that entry has no `avatarUrl` property (or it is `null`/`undefined`), never an empty string standing in for "no photo"

#### Scenario: Existing nombreCompleto-only consumers keep working
- **WHEN** a caller reads only `nombreCompleto` from a response entry (the pre-existing contract)
- **THEN** that field is present and unchanged in format (`` `${nombre} ${apellido}`.trim() ``), independent of whether the new optional fields are also read

### Requirement: Inactive users and inactive company assignments are still resolved
Unlike `documentos-candidatos-asignacion` (which requires an active user with an active assignment), `GET /api/users/nombres` SHALL resolve a user's name — and, per the requirement above, their `nombre`/`apellido`/`avatarUrl` — as long as **any** `usuarios_empresa` row exists for that `(usuario_id, empresa_id)` pair, regardless of the user's `activo` flag or the assignment's `estado`. This ensures a document signed by a since-deactivated user, or an incident reported by someone no longer assigned to that area, continues to display a real name (and photo, if one was ever set) rather than falling back to "unavailable".

#### Scenario: Resolves the name of a deactivated user
- **WHEN** `ids` includes a user id whose `asp_net_users.activo` is `false` but who has a `usuarios_empresa` row for the caller's active empresa
- **THEN** that user's `nombreCompleto` (and `avatarUrl`, if set) is included in the response

#### Scenario: Resolves the name of a user with an inactive company assignment
- **WHEN** `ids` includes a user id whose `usuarios_empresa` row for the caller's active empresa has `estado` other than `'ACTIVO'`
- **THEN** that user's name is still resolved and included
