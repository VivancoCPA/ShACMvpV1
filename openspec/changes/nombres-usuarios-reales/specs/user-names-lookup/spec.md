## ADDED Requirements

### Requirement: GET /api/users/nombres resolves display names for a list of ids
The system SHALL expose `GET /api/users/nombres?ids=<guid>,<guid>,...`, protected by `RequireAuthorization()` and `RequireEmpresaActivaFilter` (no role restriction — any authenticated user with an active empresa may call it). Given a comma-separated list of user ids, it SHALL return `ApiResponse<UserNombreDto[]>` where `UserNombreDto = { id: string, nombreCompleto: string }` — exactly `id` and `nombreCompleto`, no `email`, `rol`, or `avatarUrl`. The response SHALL include an entry for every requested id that belongs to the caller's active empresa (via any `usuarios_empresa` row, active or inactive — see the inclusion-of-inactive-users requirement below) and SHALL silently omit any id that does not — belonging to another empresa, or not existing at all — without returning an error or a 404 for those ids specifically.

#### Scenario: Resolves names for ids belonging to the active empresa
- **WHEN** an authenticated user with active empresa `empresa-001` calls `GET /api/users/nombres?ids=<id-a>,<id-b>` and both ids belong to `empresa-001`
- **THEN** the response is `200` with an array containing `{ id, nombreCompleto }` for both ids

#### Scenario: Silently omits an id from another empresa
- **WHEN** the requested `ids` list includes one id that belongs only to a different empresa than the caller's active one
- **THEN** that id is simply absent from the response array — the request still returns `200`, no error is raised for that id

#### Scenario: Silently omits a non-existent id
- **WHEN** the requested `ids` list includes a well-formed GUID that does not correspond to any user
- **THEN** that id is absent from the response array, with no error

#### Scenario: Response never includes email, rol, or avatarUrl
- **WHEN** any `GET /api/users/nombres` response is inspected
- **THEN** each entry has exactly the properties `id` and `nombreCompleto`

### Requirement: Inactive users and inactive company assignments are still resolved
Unlike `documentos-candidatos-asignacion` (which requires an active user with an active assignment), `GET /api/users/nombres` SHALL resolve a user's name as long as **any** `usuarios_empresa` row exists for that `(usuario_id, empresa_id)` pair, regardless of the user's `activo` flag or the assignment's `estado`. This ensures a document signed by a since-deactivated user, or an incident reported by someone no longer assigned to that area, continues to display a real name rather than falling back to "unavailable".

#### Scenario: Resolves the name of a deactivated user
- **WHEN** `ids` includes a user id whose `asp_net_users.activo` is `false` but who has a `usuarios_empresa` row for the caller's active empresa
- **THEN** that user's `nombreCompleto` is included in the response

#### Scenario: Resolves the name of a user with an inactive company assignment
- **WHEN** `ids` includes a user id whose `usuarios_empresa` row for the caller's active empresa has `estado` other than `'ACTIVO'`
- **THEN** that user's `nombreCompleto` is still included in the response

### Requirement: Request validation — id count limit and malformed ids
`GET /api/users/nombres` SHALL respond `400` when the `ids` query parameter contains more than 100 ids, and SHALL respond `400` when any single id is not a well-formed GUID. Both checks SHALL happen before any database query.

#### Scenario: Rejects a request exceeding the id limit
- **WHEN** `ids` contains 101 distinct ids
- **THEN** the response is `400` with a clear validation message, and no database query for user names is executed

#### Scenario: Rejects a malformed id
- **WHEN** `ids` contains a value that is not a valid GUID (e.g. `"not-a-guid"`)
- **THEN** the response is `400`

### Requirement: useUserNames shared hook resolves a set of ids in one request
The system SHALL export `useUserNames(ids: (string | null | undefined)[])` from `src/features/users/hooks/useUserNames.ts` (never from `src/mocks/`), built on TanStack Query. It SHALL filter out `null`/`undefined` entries, deduplicate the remaining ids, and sort them before building the query key, so that two calls requesting the same set of ids in a different order share the same cached request. It SHALL return a `getName(id?: string | null): string` resolver and an `isLoading` boolean. While the underlying query is loading, `getName` SHALL return a short placeholder (not the raw id). For an id the backend did not resolve (omitted from the response — different empresa, inexistent, or not yet loaded for another reason), `getName` SHALL return a generic i18n string (e.g. `t('common:userNames.noDisponible')`) — never the raw GUID. The hook SHALL use a generous `staleTime` (names change rarely).

#### Scenario: Deduplicates and orders ids for a stable query key
- **WHEN** `useUserNames(['id-b', 'id-a', 'id-a'])` and `useUserNames(['id-a', 'id-b'])` are both called
- **THEN** both calls produce the same query key and share one underlying request

#### Scenario: getName returns a placeholder while loading
- **WHEN** the underlying query is still `isLoading`
- **THEN** `getName(anyId)` returns a short placeholder, not the raw id and not `undefined`

#### Scenario: getName returns a generic fallback for an unresolved id
- **WHEN** the query has resolved and the requested id is not present in the response (e.g. it belongs to another empresa)
- **THEN** `getName(thatId)` returns the generic "Usuario no disponible" i18n string, never the raw GUID

#### Scenario: getName returns the resolved name once loaded
- **WHEN** the query has resolved and includes `{ id: 'user-x', nombreCompleto: 'Ana Pérez' }`
- **THEN** `getName('user-x')` returns `'Ana Pérez'`

#### Scenario: Null and undefined ids are filtered without affecting the query
- **WHEN** `useUserNames([undefined, 'user-x', null])` is called
- **THEN** the underlying request only asks for `['user-x']`, and `getName(undefined)` / `getName(null)` return the generic fallback without throwing

### Requirement: MSW handler mirrors the real endpoint's inclusion rule
`src/mocks/handlers/users.handlers.ts` SHALL include a handler for `GET /api/users/nombres` that: parses the comma-separated `ids` parameter, returns `400` for more than 100 ids or any malformed id, and resolves names from `getUsersStore()` filtered to users with at least one `usuarios_empresa` row (active or inactive) for the caller's active empresa — never filtering by the mock user's `activo` flag or the assignment's `estado`, consistent with the real backend's inclusion rule.

#### Scenario: Mock handler resolves an inactive mock user's name
- **WHEN** MSW is active and `ids` includes a mock user with `activo: false` who has a company assignment (active or inactive) in the active empresa
- **THEN** the mock response includes that user's `nombreCompleto`

#### Scenario: Mock handler omits a mock user from another empresa
- **WHEN** MSW is active and `ids` includes a user id assigned only to a different empresa than the active one
- **THEN** the mock response omits that id, same as the real backend
