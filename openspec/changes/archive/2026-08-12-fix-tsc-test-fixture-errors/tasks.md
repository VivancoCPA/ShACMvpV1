## 1. Create the mock user factory

- [x] 1.1 Confirmed `src/mocks/fixtures/` already hosts non-MSW-data helpers (e.g. `userIdentity.fixtures.ts`'s `resolveUserDisplayName`), and no `test-utils` convention exists anywhere in the codebase — created `src/mocks/fixtures/mockUser.ts`.
- [x] 1.2 Implemented `createMockUser(overrides?: Partial<User>): User` with defaults for every required field.
- [x] 1.3 Distinct from `MockUser`/`auth.fixtures.ts` by construction — different file, different type, no `password` field; `auth.fixtures.ts` untouched.

## 2. Migrate the 9 files with missing createdAt/activo to the factory

- [x] 2.1 `src/features/auth/pages/LoginPage.test.tsx` — wrapped the single literal with `createMockUser(...)`.
- [x] 2.2 `src/features/dashboard/components/ExportButton.test.tsx` — 4 literals wrapped.
- [x] 2.3 `src/features/dashboard/pages/DashboardPage.test.tsx` — 1 literal wrapped.
- [x] 2.4 `src/features/locations/permissions/localesPermissions.test.ts` — this file already had its own local `buildUser(rol)` helper; kept the helper's simple call sites and had it delegate to `createMockUser` internally instead of migrating every call site.
- [x] 2.5 `src/features/quality-events/components/QEACSection.test.tsx` — 6 literals wrapped (one more than originally estimated — `tsc` caught a 6th occurrence at line 228 on the second pass).
- [x] 2.6 `src/features/quality-events/components/QEList.batchExport.test.tsx` — 1 literal wrapped.
- [x] 2.7 `src/features/quality-events/components/QEList.test.tsx` — 8 distinct literals wrapped individually.
- [x] 2.8 `src/features/quality-events/components/QEVerificacionSection.test.tsx` — 4 literals wrapped (the mocked `useUsers()` list at lines 33-34 was left alone — `tsc` doesn't flag it, confirming it's not `User`-typed there).
- [x] 2.9 `src/mocks/handlers/quality-events.handlers.test.ts` — 1 literal (inside `setCurrentUser()`) wrapped.
- [x] 2.10 `src/features/auth/hooks/useLogin.test.tsx` — this file also already had its own local `makeUser(overrides)` helper (same pattern as 2.4); delegated to `createMockUser` internally.
- [x] 2.11 Ran `npx tsc -b --force`: all `TS2739`/`TS2322` errors from these 10 files gone. 52 → 25.
- [x] 2.12 Ran `npx vitest run` on all 10 files: 92/95 pass. The 3 failures (`ADMINISTRADOR_SISTEMA` → `/usuarios` routing in `LoginPage.test.tsx`/`useLogin.test.tsx`) are confirmed pre-existing — identical to 3 entries already documented as pre-existing WIP gaps in `fix-tsc-production-type-errors`' final verification (task 7.2), not caused by this migration.

## 3. Complete perfilAccess.test.tsx's role coverage

- [x] 3.1 Added `ADMINISTRADOR_EMPRESA: 'admin.empresa@shac.pe'` and `SUPERADMIN: 'superadmin@shac.pe'` to `ROLE_EMAILS`, matching the real seeded accounts exactly.
- [x] 3.2 Ran `npx tsc -b --force`: the `TS2739` is gone. 25 → 24.
- [x] 3.3 Ran `npx vitest run src/router/perfilAccess.test.tsx`: 10/10 pass, including both new role cases. No access-control gap — `/perfil` genuinely has no RBAC restriction for either new role.

## 4. area → areaId rename in QE hook/form tests

- [x] 4.1 `src/features/quality-events/hooks/useEditarMineral.test.ts` — renamed `area` to `areaId` on all 4 occurrences.
- [x] 4.2 `src/features/quality-events/hooks/useEditarReporteInicial.test.ts` — same, 4 occurrences.
- [x] 4.3 `src/features/quality-events/hooks/useEditarSeveridad.test.ts` — same, 5 occurrences.
- [x] 4.4 `src/features/quality-events/pages/QualityEventForm.test.tsx` — same, 8 occurrences.
- **Discovered mid-fix, not in the original diagnosis:** the `area` rename unmasked a second, previously-hidden error in the exact same literals — `TS2353` (excess property) was reported instead of the also-true `TS2739` (missing `createdAt`/`activo`), since TS only surfaces one mismatch class at a time. All 4 files needed the same `createMockUser` treatment as group 2. The 3 hook test files (`useEditarMineral`, `useEditarReporteInicial`, `useEditarSeveridad`) each had their own local `loginAs(user: User)` helper — changed its parameter to `Partial<User>` and had it call `createMockUser(overrides)` internally, so every call site stayed a plain object literal with no per-site wrapping needed. `QualityEventForm.test.tsx` has no such helper — its 8 call sites (5 identical + 3 distinct) were wrapped individually with `createMockUser(...)`.
- [x] 4.5 Ran `npx tsc -b --force`: all errors from these 4 files gone (including the newly-discovered ones). Ran `npx vitest run` on all 4: 41/41 pass.

## 5. Independent area-rename echoes (non-User fixtures)

- [x] 5.1 `src/features/dashboard/hooks/useAccionesRequeridas.test.ts` — renamed `area` to `areaId` on the `buildDocumento()` literal. This unmasked a second hidden error (same pattern as group 4): `empresaId` was also missing on the same literal, hidden behind the `area` excess-property error — added `empresaId: 'empresa-001'`.
- [x] 5.2 `src/features/dashboard/hooks/useAccionesRequeridas.test.ts` — completed the existing local `buildUser()` helper by delegating to `createMockUser` (same treatment as group 2/4's local factories), rather than hand-adding `createdAt`/`activo` defaults directly — consistent with the rest of this change.
- [x] 5.3 `src/features/dashboard/pages/AuditorDashboard.test.tsx` — renamed `area` to `areaId` on the inline literal.
- [x] 5.4 Ran `npx tsc -b --force`: **zero errors project-wide.** Ran `npx vitest run` on both files: 13/13 pass.

## 6. Final verification

- [x] 6.1 Ran `npx tsc -b --force`: **zero errors** across all 17 files (confirmed via full project-wide run, exit code 0).
- [x] 6.2 Ran `npx vitest run` (full suite): 35 failing tests, identical file-for-file and test-for-test to the pre-existing baseline documented in `fix-tsc-production-type-errors`' final verification — zero new failures introduced by this change.
- [x] 6.3 Confirmed: `npx tsc -b --force` reports **zero errors project-wide** (exit code 0, no output) — the full 724 → 0 arc across all three changes is complete.
- [ ] 6.4 Pending archive of all three changes — sync `openspec/specs/routing/spec.md` at that point.
