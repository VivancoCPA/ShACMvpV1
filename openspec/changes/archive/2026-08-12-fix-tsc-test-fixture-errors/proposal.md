## Why

`npx tsc -b --force` reports 82 errors on the current tree; 50 of them (`TS2739`+`TS2353`) are hand-written `User`/role literals in 16 test files that have drifted from the current `User` interface and `UserRole` union (which has grown from 7 to 9 roles as recent work — including the MultiEmpresa admin roles — landed). This is the second of two changes splitting that cleanup; the first (`fix-tsc-production-type-errors`) covers the ~32 errors in real production code and is scoped separately.

**Update (post-implementation of `fix-tsc-production-type-errors`):** final verification of that change surfaced 2 more `User`-shape errors in files not in the original 16 — `useLogin.test.tsx` (same missing `createdAt`/`activo` pattern as the other 9 factory-migration files) and a second, independent error in `useAccionesRequeridas.test.ts` (its own local `buildUser()` helper has the same missing-fields bug, distinct from the `Documento.area` issue this file was already in scope for). Folded into this change's scope rather than opened separately, since they're the exact same root cause already being fixed here.

## What Changes

- Introduce a `createMockUser(overrides?: Partial<User>): User` test factory (see design.md for the recommended location and rationale) and migrate the 9 files whose only error is a missing `createdAt`/`activo` field to use it instead of a hand-rolled literal.
- Complete `perfilAccess.test.tsx`'s `ROLE_EMAILS: Record<UserRole, string>` map with the two roles it's missing (`ADMINISTRADOR_EMPRESA`, `SUPERADMIN`), using the real seeded test accounts already present in `auth.fixtures.ts` (`admin.empresa@shac.pe`, `superadmin@shac.pe`) rather than inventing new emails — per the project's existing "no orphan test user" convention.
- Rename `area` → `areaId` on every `User`-literal construction in `useEditarMineral.test.ts` (4 occurrences), `useEditarReporteInicial.test.ts` (4), `useEditarSeveridad.test.ts` (5), and `QualityEventForm.test.tsx` (8), matching the field the current `User` interface actually defines.
- Fix the two unrelated `area`-rename echoes that aren't `User` fixtures: `useAccionesRequeridas.test.ts`'s `Documento`-shaped literal, and `AuditorDashboard.test.tsx`'s inline `{areaId, tasaCierreEnPlazo, totalCerrados}`-shaped literal.
- No runtime test behavior is intended to change, except where a fixture was factually incomplete (the `perfilAccess.test.tsx` role map needs the two new roles to actually mean something, not just type-check).

## Capabilities

### New Capabilities

None — this is test-infrastructure cleanup, not a product capability.

### Modified Capabilities

- `routing`: `/perfil` is registered with no `RoleGuard` role restriction beyond authentication (confirmed in `router/index.tsx`, comment: "No RBAC restriction beyond auth"), but this was never captured as a spec requirement — `openspec/specs/routing/spec.md` has no `/perfil` entry at all today, even though `perfilAccess.test.tsx` already tests it for 7 roles. Completing that test file's role coverage for the 2 newer roles (`SUPERADMIN`, `ADMINISTRADOR_EMPRESA`) is the first time this route's "any authenticated role" behavior gets verified for them, which is a good point to also formalize it as a requirement — no code changes, since the route already behaves this way.

## Impact

- **Affected code (test-only)**: `src/features/auth/pages/LoginPage.test.tsx`, `src/features/auth/hooks/useLogin.test.tsx`, `src/features/dashboard/components/ExportButton.test.tsx`, `src/features/dashboard/pages/DashboardPage.test.tsx`, `src/features/locations/permissions/localesPermissions.test.ts`, `src/features/quality-events/components/QEACSection.test.tsx`, `src/features/quality-events/components/QEList.batchExport.test.tsx`, `src/features/quality-events/components/QEList.test.tsx`, `src/features/quality-events/components/QEVerificacionSection.test.tsx`, `src/mocks/handlers/quality-events.handlers.test.ts`, `src/router/perfilAccess.test.tsx`, `src/features/quality-events/hooks/useEditarMineral.test.ts`, `useEditarReporteInicial.test.ts`, `useEditarSeveridad.test.ts`, `src/features/quality-events/pages/QualityEventForm.test.tsx`, `src/features/dashboard/hooks/useAccionesRequeridas.test.ts`, `src/features/dashboard/pages/AuditorDashboard.test.tsx`.
- **New file**: a `createMockUser` test helper (location decided in design.md).
- **Out of scope**: the ~32 production-code errors, tracked in `fix-tsc-production-type-errors`.
- **CI**: `npx tsc -b --force` should report zero errors across all 16 files above once this lands, with the full 82-error count from both changes combined reaching zero.
