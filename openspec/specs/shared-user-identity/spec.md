# Spec: shared-user-identity

## Purpose

Single-source user display-name resolution shared across mock handlers, fixtures, and UI components. Consolidates identity lookups behind `resolveUserDisplayName`, backed primarily by the live `authFixtures` user store with a minimal fallback map (`seedLegacyNames`) for a handful of login-less legacy ids used only by historical seed data. Replaces the removed `src/mocks/fixtures/users.fixtures.ts` (`USER_NOMBRE_MAP`/`userFixtures`) catalog, which no longer exists — no module in `src/mocks/` or `src/features/` may read it or any `USER_NOMBRE_MAP`-shaped export.

---

## Requirements

### Requirement: resolveUserDisplayName single-source resolution helper
The system SHALL export a pure function `resolveUserDisplayName(id: string): string` from `src/mocks/fixtures/userIdentity.fixtures.ts`. Given a user id, the function SHALL: (1) look up the id in the live `authFixtures` user store (via `getUsersStore()` from `src/mocks/fixtures/auth.fixtures.ts`) and, if found, return `` `${nombre} ${apellido}` ``; (2) if not found there, look up the id in `seedLegacyNames` and, if found, return `` `${nombre} ${apellido}` ``; (3) if not found in either source, return the raw `id` unchanged. No other module in `src/mocks/` or `src/features/` SHALL read `src/mocks/fixtures/users.fixtures.ts` or any `USER_NOMBRE_MAP`-shaped export — that file and export SHALL NOT exist after this capability is implemented.

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

### Requirement: seedLegacyNames minimal fallback map
The system SHALL export `seedLegacyNames: Record<string, { nombre: string; apellido: string }>` from `src/mocks/fixtures/userIdentity.fixtures.ts`, containing exactly the four login-less legacy ids used by historical seed data: `user-001`, `user-002`, `user-003`, `user-008`. Each entry SHALL contain only `nombre` and `apellido` — no `rol`, `area`, `email`, or other `User`-shaped fields.

#### Scenario: seedLegacyNames contains exactly the four legacy ids
- **WHEN** the keys of `seedLegacyNames` are inspected
- **THEN** they are exactly `['user-001', 'user-002', 'user-003', 'user-008']`, in any order

#### Scenario: seedLegacyNames entries are name-only
- **WHEN** any entry of `seedLegacyNames` is inspected
- **THEN** its only properties are `nombre` and `apellido`
