## MODIFIED Requirements

### Requirement: resolveUserDisplayName single-source resolution helper
The system SHALL export a pure function `resolveUserDisplayName(id: string): string` from `src/mocks/fixtures/userIdentity.fixtures.ts`. Given a user id, the function SHALL: (1) look up the id in the live `authFixtures` user store (via `getUsersStore()` from `src/mocks/fixtures/auth.fixtures.ts`) and, if found, return `` `${nombre} ${apellido}` ``; (2) if not found there, look up the id in `seedLegacyNames` and, if found, return `` `${nombre} ${apellido}` ``; (3) if not found in either source, return the raw `id` unchanged. No other module in `src/mocks/` or `src/features/` SHALL read `src/mocks/fixtures/users.fixtures.ts` or any `USER_NOMBRE_MAP`-shaped export — that file and export SHALL NOT exist after this capability is implemented.

`resolveUserDisplayName` SHALL be used only by MSW handlers/fixtures and by test files — no file under `src/` outside `src/mocks/` and outside `*.test.*`/`*.test.tsx` SHALL import it. (Production display of a user's name SHALL instead go through the `useUserNames` hook from `user-names-lookup`, which calls the real `GET /api/users/nombres` endpoint.)

#### Scenario: Resolves a real, non-legacy authFixtures account
- **WHEN** `resolveUserDisplayName('user-supervisor-002')` is called and `authFixtures` contains `{ id: 'user-supervisor-002', nombre: 'Diego', apellido: 'Salazar' }`
- **THEN** the return value is `'Diego Salazar'`

#### Scenario: Falls back to seedLegacyNames for a login-less legacy id
- **WHEN** `resolveUserDisplayName('user-001')` is called and `'user-001'` does not exist in `authFixtures`
- **THEN** the return value is resolved from `seedLegacyNames['user-001']`

#### Scenario: Falls back to the raw id when unmapped in both sources
- **WHEN** `resolveUserDisplayName('user-does-not-exist')` is called and the id is absent from both `authFixtures` and `seedLegacyNames`
- **THEN** the return value is the literal string `'user-does-not-exist'`

#### Scenario: Prefers authFixtures when an id exists in both sources
- **WHEN** `resolveUserDisplayName(id)` is called for an id present in both `authFixtures` and `seedLegacyNames`
- **THEN** the resolved name SHALL come from the matching `authFixtures` entry, not `seedLegacyNames`

#### Scenario: No production component imports resolveUserDisplayName
- **WHEN** `src/` is searched for imports of `resolveUserDisplayName`, excluding `src/mocks/` and any `*.test.*` file
- **THEN** no matches are found
