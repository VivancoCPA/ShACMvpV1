# nc-msw-handlers

## ADDED Requirements

### Requirement: GET /api/users handler returning one fixture user per role
The system SHALL implement an MSW v2 handler for `GET /api/users` in `src/mocks/handlers/nonconformities.handlers.ts` (or a shared `users.handlers.ts` added to the handlers index) that returns `ApiResponse<User[]>` with exactly six fixture users — one per `UserRole`. The handler SHALL simulate 400 ms latency using `delay(400)`. Each user object SHALL have at minimum: `id` (string), `nombre` (string), `apellido` (string), `rol` (UserRole), `email` (string). The fixture data SHALL live in `src/mocks/fixtures/users.fixtures.ts`.

#### Scenario: GET /api/users returns six fixture users
- **WHEN** a client calls `GET /api/users` with no query parameters
- **THEN** the handler returns HTTP 200 with `data` containing exactly six users, one per role

#### Scenario: GET /api/users returns data in ApiResponse shape
- **WHEN** a client calls `GET /api/users`
- **THEN** the response body satisfies `ApiResponse<User[]>` with `success: true`

### Requirement: POST /api/nonconformities accepts optional forzar flag to bypass duplicate check
The existing `POST /api/nonconformities` handler SHALL be extended to accept an optional `forzar: boolean` field in the request body. When `forzar === true`, the handler SHALL skip the duplicate detection logic (RN-NC-005) and return HTTP 201 with the created NC and no `warning` field in the response.

#### Scenario: POST with forzar=true skips duplicate detection
- **WHEN** a client calls `POST /api/nonconformities` with `forzar: true` and a payload that would normally trigger a POSIBLE_DUPLICADO warning
- **THEN** the handler returns HTTP 201 with no `warning` field in the response body

#### Scenario: POST with forzar=false behaves identically to POST without forzar
- **WHEN** a client calls `POST /api/nonconformities` with `forzar: false` and a duplicate-triggering payload
- **THEN** the handler returns HTTP 201 with `warning: 'POSIBLE_DUPLICADO'`
