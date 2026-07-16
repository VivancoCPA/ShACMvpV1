## 1. Foundation — new resolution helper (additive, nothing rewired yet)

- [x] 1.1 Create `src/mocks/fixtures/seedLegacyNames.fixtures.ts` exporting `seedLegacyNames: Record<string, { nombre: string; apellido: string }>` with exactly the 4 entries for `user-001`, `user-002`, `user-003`, `user-008` (names copied from the current `userFixtures` entries in `users.fixtures.ts` before it is deleted).
- [x] 1.2 Create `src/mocks/fixtures/userIdentity.fixtures.ts` exporting `resolveUserDisplayName(id: string): string`, implementing the lookup order: `getUsersStore()` (from `auth.fixtures.ts`) → `seedLegacyNames` → raw `id` (per design.md D1/D2).
- [x] 1.3 Add a unit test file for `resolveUserDisplayName` covering: a real `authFixtures` account, a `seedLegacyNames`-only legacy id, an id present in both sources (authFixtures wins), and a fully unmapped id (raw id fallback).

## 2. Rewire M4 — Quality Events

- [x] 2.1 `src/features/quality-events/utils/qualityEventPermissions.ts:131` — change `resolveRolSegundaFirma` to look up `primerFirmanteId` via `getUsersStore()` instead of `userFixtures`; remove the `userFixtures` import.
- [x] 2.2 Update `src/features/quality-events/utils/__tests__/qualityEventPermissions.test.ts` to mock `authFixtures`/`getUsersStore()` instead of `userFixtures`, keeping the existing 4 scenarios (escalates for area match, no escalation for JEFE_CALIDAD_SYST, no escalation for area mismatch, fallback when user not found) passing.
- [x] 2.3 `src/features/quality-events/components/QEHeaderSection.tsx:30` — replace `userFixtures.find(...)` with `resolveUserDisplayName(qe.reportadoPorId)`; remove the `userFixtures` import.
- [x] 2.4 `src/features/quality-events/components/QEInvestigationSection.tsx:208` (and the second usage around line 342, if it's a separate call) — replace `userFixtures.find(...)` with `resolveUserDisplayName(qe.causaRaizAprobadaPorId)`; remove the `userFixtures` import.
- [x] 2.5 `src/features/quality-events/pages/QualityEventForm.tsx:373` — replace `USER_NOMBRE_MAP[qe.reportadoPorId] ?? qe.reportadoPorId` with `resolveUserDisplayName(qe.reportadoPorId)`; remove the `USER_NOMBRE_MAP` import.
- [x] 2.6 `src/mocks/handlers/quality-events.handlers.ts:337` — replace `USER_NOMBRE_MAP[responsableId] ?? 'Usuario'` with `resolveUserDisplayName(responsableId)`; remove the `USER_NOMBRE_MAP` import.
- [x] 2.7 `src/mocks/fixtures/quality-events.fixtures.ts:9,365` — replace the `USER_NOMBRE_MAP` import and `nombrePor()`'s body (`USER_NOMBRE_MAP[id] ?? id`) with a call to `resolveUserDisplayName(id)`.
- [x] 2.8 Manually re-verify in browser (logged in as a real, non-legacy account, e.g. `supervisor.almacen@shac.pe`): QE header "Reportado por", investigation "Causa raíz aprobada por", form read-only "Reportado por", and RN-QE-004 second-signature escalation to `ALTA_DIRECCION` (CA-01).

## 3. Rewire M2 — Nonconformities

- [x] 3.1 `src/features/nonconformities/pages/NonconformityDetailPage.tsx:230` — replace `userFixtures.find(...)` with `resolveUserDisplayName(nc.detectadoPorId)`; remove the `userFixtures` import.
- [x] 3.2 `src/mocks/handlers/nonconformities.handlers.ts:356` — replace `USER_NOMBRE_MAP[responsableId] ?? 'Usuario'` with `resolveUserDisplayName(responsableId)`; remove the `USER_NOMBRE_MAP` import.
- [x] 3.3 Manually re-verify in browser (logged in as a real, non-legacy account): create an NC and set "Detectado por" to that account, confirm the detail page always shows the row with the resolved name (CA-02); create an AC on that NC and confirm `responsableNombre` is never `'Usuario'` (part of CA-03).

## 4. Rewire M3 — Incidents

- [x] 4.1 `src/mocks/handlers/incidents.handlers.ts:359-360` — replace `userFixtures.find(...)` (then reading `.nombre`/`.apellido`) with a single `resolveUserDisplayName(responsableId)` call; remove the `userFixtures` import.
- [x] 4.2 Manually re-verify in browser: create an incident AC assigning a real, non-legacy responsable and confirm `responsableNombre` is never `undefined` or a raw id fragment (part of CA-03).

## 5. Remove the old parallel catalog

- [x] 5.1 Confirm (via a repo-wide search) that no remaining import references `src/mocks/fixtures/users.fixtures.ts`, `userFixtures`, or `USER_NOMBRE_MAP` outside of the file itself.
- [x] 5.2 Delete `src/mocks/fixtures/users.fixtures.ts`.
- [x] 5.3 Update `src/mocks/fixtures/index.ts`: remove `export { userFixtures, USER_NOMBRE_MAP } from './users.fixtures'`, add `export { resolveUserDisplayName } from './userIdentity.fixtures'` and `export { seedLegacyNames } from './seedLegacyNames.fixtures'`.

## 6. Verification

- [x] 6.1 Run `tsc -p tsconfig.app.json` and confirm no `TS2739` (or any) error references `mocks/fixtures/users.fixtures.ts` — the file no longer exists (CA-05).
- [x] 6.2 Run the full test suite (`npm test` / project's test command) and confirm it passes, including the updated `qualityEventPermissions.test.ts`. (5 pre-existing failures unrelated to this change confirmed via git stash baseline comparison — see session notes.)
- [x] 6.3 Manually re-verify CA-01 with at least 2 distinct real, non-legacy accounts (not only the 4 previously-synced ids).
- [x] 6.4 Manually re-verify CA-04: QE seed data using `REPORTEROS_ROTACION` (dashboard trend widgets / list views that surface those seeded QEs) still shows correct reporter names after the catalog swap.
- [x] 6.5 Run through the full regression checklist in proposal.md §6 (CA-01 through CA-06) end-to-end in a single pass and record results.
