## Why

`src/mocks/fixtures/users.fixtures.ts` (`userFixtures`/`USER_NOMBRE_MAP`) is a
person catalog that has drifted out of sync with `auth.fixtures.ts`
(`authFixtures`), the catalog actually served by `/api/users` and used for
login, real sessions, and every responsible/reviewer picker in the app. Only
4 of ~15 real accounts have a matching ID between the two files. Every place
that still resolves a display name via `userFixtures`/`USER_NOMBRE_MAP`
silently fails — or worse, persists corrupted data (`responsableNombre` saved
literally as `'Usuario'` or as a raw ID) — whenever a real, non-legacy
account is used. This blocks reliable end-to-end testing of RN-QE-004
(second-signature escalation) and produces broken "detectado/reportado/
aprobado por" displays across M2/M3/M4.

## What Changes

- Remove `src/mocks/fixtures/users.fixtures.ts` and its `userFixtures` /
  `USER_NOMBRE_MAP` exports entirely (**BREAKING** for any remaining
  internal import of that module — none are expected to survive this
  change).
- Add `src/mocks/fixtures/seedLegacyNames.fixtures.ts`: a minimal
  `Record<string, {nombre: string; apellido: string}>` covering only the 4
  legacy IDs that never got real login credentials (`user-001`, `user-002`,
  `user-003`, `user-008`) and are used solely to seed historical display
  names (`REPORTEROS_ROTACION`).
- Add a single resolution helper, `resolveUserDisplayName(id: string): string`,
  that checks `authFixtures` first (primary source, covers real
  sessions/pickers), falls back to `seedLegacyNames` for the 4 legacy seed
  IDs, and returns the raw ID as a last resort.
- Replace every direct read of `userFixtures`/`USER_NOMBRE_MAP` (8 call
  sites across M2/M3/M4 components, handlers, and permission logic, plus 2
  fixture-generation helpers) with `resolveUserDisplayName()`.
- No change to any `RN-*` business rule, state machine, or permission
  matrix — this is purely a data-identity correction underneath existing
  behavior.

## Capabilities

### New Capabilities

- `shared-user-identity`: single-source user display-name resolution for
  mocks (`resolveUserDisplayName`), backed by `authFixtures` plus a minimal
  `seedLegacyNames` fallback for the 4 login-less legacy seed IDs.

### Modified Capabilities

- `quality-event-permissions`: `resolveRolSegundaFirma` (RN-QE-004
  second-signature escalation check) resolves the first signer's role/area
  via `resolveUserDisplayName`'s source of truth instead of the
  out-of-sync `userFixtures`, so escalation to `ALTA_DIRECCION` fires
  correctly for real, non-legacy accounts.
- `nc-detail-page`: the "Detectado por" row in `NonconformityDetailPage`
  resolves the name via `resolveUserDisplayName` instead of disappearing
  when `nc.detectadoPorId` doesn't match a `userFixtures` entry.
- `quality-event-detail-page`: `QEHeaderSection`'s "Reportado por" field
  resolves via `resolveUserDisplayName`.
- `quality-event-investigation`: `QEInvestigationSection`'s "Causa raíz
  aprobada por" field resolves via `resolveUserDisplayName`.
- `quality-event-form`: `QualityEventForm`'s read-only "Reportado por"
  field resolves via `resolveUserDisplayName`.
- `quality-event-msw-handlers`: creating an AC on a Quality Event stores
  `responsableNombre` via `resolveUserDisplayName` instead of falling back
  to the literal string `'Usuario'`.
- `nc-msw-handlers`: creating an AC on a Nonconformity stores
  `responsableNombre` via `resolveUserDisplayName` instead of falling back
  to the literal string `'Usuario'`.
- `incident-msw-handlers`: creating an AC on an Incident stores
  `responsableNombre` via `resolveUserDisplayName` instead of a raw,
  unresolved ID.
- `quality-event-msw-fixtures`: `nombrePor()` and `REPORTEROS_ROTACION`
  (seed data generation) resolve names via `resolveUserDisplayName`
  instead of importing `userFixtures` directly.

## Impact

- Affected code (8 corrected call sites + 2 fixture files):
  - `src/features/quality-events/utils/qualityEventPermissions.ts:131`
  - `src/features/nonconformities/pages/NonconformityDetailPage.tsx:230`
  - `src/features/quality-events/components/QEHeaderSection.tsx:30`
  - `src/features/quality-events/components/QEInvestigationSection.tsx:208`
  - `src/features/quality-events/pages/QualityEventForm.tsx:373`
  - `src/mocks/handlers/quality-events.handlers.ts:337`
  - `src/mocks/handlers/nonconformities.handlers.ts:356`
  - `src/mocks/handlers/incidents.handlers.ts:359-360`
  - `src/mocks/fixtures/quality-events.fixtures.ts:9,365`
  - `src/mocks/fixtures/index.ts` (drop `userFixtures`/`USER_NOMBRE_MAP`
    re-export, add `resolveUserDisplayName`/`seedLegacyNames` re-export)
- Removed file: `src/mocks/fixtures/users.fixtures.ts`.
- New file: `src/mocks/fixtures/seedLegacyNames.fixtures.ts`.
- New file (helper): `resolveUserDisplayName`, colocated with the mock
  fixtures layer (see design.md for exact location).
- Test impact: `src/features/quality-events/utils/__tests__/qualityEventPermissions.test.ts`
  mocks `userFixtures` directly and must be updated to mock
  `authFixtures`/`resolveUserDisplayName` instead.
- No changes to production types, API contracts, business rules, or the
  QE/Document state machines.
