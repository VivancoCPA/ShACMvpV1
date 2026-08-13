## Context

50 of the 82 current `tsc -b` errors are `User`/role literal mismatches spread across 16 test files. This is at least the second time a `User`-shape change has broken scattered fixtures (the original diagnosis handoff already flagged this pattern), and the `UserRole` union has grown again since — from 7 to 9 roles — during the change that produced this cleanup task itself, confirming the duplication is an active liability, not a one-off.

## Goals / Non-Goals

**Goals:**
- Zero `tsc -b` errors in all 16 files listed in the proposal.
- Stop the "next required-field addition breaks N scattered fixtures" pattern from recurring a third time.
- Every content fix (not just type fix) is backed by a real, already-seeded fixture — no invented test users or made-up emails.

**Non-Goals:**
- Migrating every `User`-literal construction in the codebase to the new factory — only the files `tsc` currently flags. A broader migration is a separate, opt-in cleanup, not bundled here.
- Changing `MockUser` (the MSW-login-store shape in `auth.fixtures.ts`, which includes `password` and is a different concern from the pure `User` type used elsewhere).

## Decisions

**Decision: introduce `createMockUser(overrides?: Partial<User>): User`, migrate the 9 affected `User`-shape files to it.**

Grep confirms no such factory exists anywhere today — every test file hand-rolls its own `User` literal, which is exactly why a single required-field addition (`createdAt`, `activo`) broke 9+ files at once, and why a role addition (`ADMINISTRADOR_EMPRESA`, `SUPERADMIN`) is doing it again right now.

Recommended over patching each of the 50 error sites in place, for one reason: patching in place fixes today's 50 errors but leaves the next `User` field addition to break the same files again — the actual root cause (duplicated literal construction, not "missing fields") stays. The factory approach costs more up-front file touches (9 files instead of leaving them alone) but removes the recurring failure mode.

**Update:** `useAccionesRequeridas.test.ts` already has its own local `buildUser(overrides: Partial<User>): User` helper (discovered while investigating that file's separate `Documento.area` bug) — real precedent that this pattern is already independently converged on elsewhere. It's simply missing the `createdAt`/`activo` defaults, same bug as the other 9 files. Decision: complete its existing local factory in place rather than replacing it with the new shared one — it's already doing the right thing structurally, and replacing a working local factory with the shared one isn't necessary just because the shared one now exists.

Location: a new `src/mocks/fixtures/mockUser.ts` (or `src/test-utils/mockUser.ts` if the project prefers a non-`mocks` home for pure-test helpers — confirm against how `test-setup.ts` and other cross-cutting test helpers are organized before creating a new top-level folder for just this one file). It should default every `User` field to a realistic value (e.g. `rol: 'OPERARIO'`, a fixed `createdAt`, `activo: true`) and accept `Partial<User>` overrides — mirroring the `overrides` pattern already used by fixture builders elsewhere in `src/mocks/fixtures/`. It is explicitly NOT the same as `MockUser` in `auth.fixtures.ts` (which carries `password` for the MSW login store) — `createMockUser` produces a plain `User` for tests that need a `User`-shaped value but never log in through the mock auth flow.

**Decision: `perfilAccess.test.tsx`'s `ROLE_EMAILS` map gets real seeded accounts, not placeholder strings.**

`auth.fixtures.ts` already seeds `superadmin@shac.pe` (`SUPERADMIN`) and `admin.empresa@shac.pe` (`ADMINISTRADOR_EMPRESA`) — confirmed by reading the fixture file directly. Per this project's established "fixtures desincronizados" rule (any test that logs in as a role must use a real seeded account, or the flow can't be tested end-to-end), the two missing map entries use these exact emails, not invented ones.

**Decision: the `area` → `areaId` rename fixes are direct literal edits, not a factory concern.**

Unlike the `User`-shape errors, the `area`/`areaId` mismatches in `useEditarMineral.test.ts`, `useEditarReporteInicial.test.ts`, `useEditarSeveridad.test.ts`, and `QualityEventForm.test.tsx` are a single field rename repeated across a fixed, already-known set of occurrences (4+4+5+8 = 21) — introducing the factory for these too is possible but not necessary, since a factory wouldn't have prevented a rename (only a missing-field addition). Fixed as direct search-and-replace per file instead. Same treatment for the two non-`User` `area` echoes (`useAccionesRequeridas.test.ts`'s `Documento` literal, `AuditorDashboard.test.tsx`'s inline shape).

## Risks / Trade-offs

- **[Risk]** Migrating 9 files to a shared factory could subtly change a test's behavior if the test currently relies on a specific field value that the factory's default doesn't match → **Mitigation**: read each file's actual usage before swapping in the factory; pass explicit overrides for every field the test's assertions actually depend on, don't rely on the factory's defaults for anything the test cares about.
- **[Risk]** The `perfilAccess.test.tsx` map completion adds 2 new test cases (one per new role) that could fail for reasons unrelated to this change (e.g. a route guard not yet updated for the new roles) → **Mitigation**: if either new case fails, that's a real access-control gap surfaced by this change, not a false positive from the fixture fix — report it rather than skipping/loosening the new test case to make it pass.
- **[Trade-off]** New file (`mockUser.ts`) plus 9 migrated files is more diff than patching 50 sites individually → accepted, per the Decision above.

## Open Questions

- Exact location for the new factory (`src/mocks/fixtures/` vs. a new `test-utils/` root) — resolve by checking how `test-setup.ts` and any other shared-but-not-MSW test helper is currently organized, during implementation.
