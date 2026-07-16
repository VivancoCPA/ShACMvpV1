## ADDED Requirements

### Requirement: Seeded reporter names resolve through resolveUserDisplayName
`quality-events.fixtures.ts`'s reporter-rotation seed helper (`nombrePor`, used by `REPORTEROS_ROTACION` to populate `reportadoPorId`/display-name pairs on synthetic trend-seed `QualityEvent`s) SHALL resolve every id via `resolveUserDisplayName` (from `src/mocks/fixtures/userIdentity.fixtures.ts`) instead of importing `USER_NOMBRE_MAP`/`userFixtures` from the removed `src/mocks/fixtures/users.fixtures.ts` directly. `REPORTEROS_ROTACION` mixes ids with a real `authFixtures` login (e.g. `user-005`) and login-less legacy ids covered only by `seedLegacyNames` (`user-001`, `user-002`, `user-003`, `user-008`); both categories SHALL resolve to a correct display name from the same call site.

#### Scenario: Rotation seed resolves a login-less legacy id
- **WHEN** `nombrePor('user-001')` is called
- **THEN** the return value is the name resolved from `seedLegacyNames['user-001']`

#### Scenario: Rotation seed resolves a real authFixtures id
- **WHEN** `nombrePor('user-005')` is called and `user-005` exists in `authFixtures`
- **THEN** the return value is the name resolved from the matching `authFixtures` entry

#### Scenario: Trend-seed QEs built from REPORTEROS_ROTACION show correct names after the catalog consolidation
- **WHEN** `qualityEventFixtures` seed data built via `buildTendenciaSeedQE` is inspected for any `QualityEvent` whose `reportadoPorId` is one of `REPORTEROS_ROTACION`
- **THEN** the corresponding display name resolves correctly for both the legacy and the real-login ids in that list
