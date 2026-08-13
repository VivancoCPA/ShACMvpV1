## Why

A full `npx tsc -b --force` currently reports 82 errors on `master` (verified 2026-08-12, after two other causes — missing `@testing-library/jest-dom` types and two test files missing `vitest` imports — were already fixed directly, dropping the count from 724). Of those 82, roughly 32 are in production code and schemas, not test fixtures. `tsc -b` is not run in CI today, so these have accumulated silently; several stem from a real API removal in the `zod` v4 upgrade (`required_error`/`invalid_type_error` no longer exist), which means the affected Zod schemas are currently relying on a config shape TypeScript already rejects — a signal worth fixing before it hides a real validation-message regression.

## What Changes

- Migrate `required_error`/`invalid_type_error` to zod v4's `error` param in the 3 schema files that still use the removed v3 API: `nuevaVersion.schema.ts`, `incidentForm.schema.ts`, `mobileIncidentReport.schema.ts` (root cause of 5 of 6 `TS2769` errors).
- Re-verify `IncidentForm.tsx`'s "two unrelated `Resolver` types" errors after the schema fix above — confirmed by investigation to be a likely downstream effect of the broken enum inference in `incidentForm.schema.ts`, not an independent bug.
- Investigate and fix the same "two unrelated `Resolver` types" pattern in `NCForm.tsx` and `QEACSection.tsx` independently — their schemas (`createNC.schema.ts`, `createQEAccion.schema.ts`, etc.) do **not** use the removed zod v3 API, so this is a separate type-drift issue between each form's hand-declared field-values type and its schema's `z.infer` output, requiring a per-file diff.
- Fix `vite.config.ts`'s `TS2769` (the `test` block not matching `UserConfigExport`'s overloads) — separate root cause from the zod issue, likely a `vite`/`vitest` type-version mismatch; investigate before patching.
- Fix the remaining independent, one-off production/schema errors: unused variable in `DocumentForm.tsx` (`TS6133`), missing `JSX` namespace import in `DocumentDetailPage.tsx` (`TS2503`), `UserRole[]` type mismatch in `useDocumentForm.ts` (`TS2322` — verify against the CLAUDE.md rule that `ADMINISTRADOR_SISTEMA` must never appear in an operational-module role list), and the unsafe `NoConformidad` → `Record<string, unknown>` cast in `nonconformities.handlers.ts` (`TS2352`).
- Fix the MSW-handler-test type errors that aren't fixture/`User`-shape issues (covered by the separate `fix-tsc-test-fixture-errors` change): `documents.types.test.ts` (`TS2344`, a type-level equality test comparing against the wrong entity name), `locales.handlers.test.ts` (`TS2345`), and the `AxiosResponse` vs. hand-rolled `Record<string,string>` headers mismatch in `auth.handlers.test.ts`/`documents.handlers.test.ts` (`TS2345`).
- No runtime/UI behavior changes are intended by this change — it is a type-correctness cleanup. Any fix that would change validation message wording or behavior gets called out explicitly during implementation for review, not applied silently.

## Capabilities

### New Capabilities

None — this change fixes type-correctness defects in existing code; it introduces no new user-facing capability.

### Modified Capabilities

- `document-types`: the existing spec (`openspec/specs/document-types/spec.md`) says `Documento.rolesAutorizados` is typed as plain `string[]` — but the actual field is meant to hold user roles authorized to read a `RESTRINGIDO`/`CONFIDENCIAL` document, and today's code already types it as the full `UserRole[]` (wider than the spec, and wider than what the create/update Zod schemas accept). Fixing `useDocumentForm.ts`'s `TS2322` the right way (per design.md D4) means narrowing this field to a dedicated `DocumentAuthorizedRole` literal union — the 6 operational roles already used by the schemas, deliberately excluding `ADMINISTRADOR_SISTEMA`/`ADMINISTRADOR_EMPRESA`/`SUPERADMIN` per the CLAUDE.md rule that none of those system-level roles ever gets document-module access. This is a genuine requirement change (from `string[]` to a specific literal union), not just an implementation cast.

## Impact

- **Affected code**: `src/features/documents/schemas/nuevaVersion.schema.ts`, `src/features/incidents/schemas/incidentForm.schema.ts`, `src/features/incidents/schemas/mobileIncidentReport.schema.ts`, `src/features/incidents/components/IncidentForm.tsx`, `src/features/nonconformities/components/NCForm.tsx`, `src/features/quality-events/components/QEACSection.tsx`, `src/features/documents/components/DocumentForm.tsx`, `src/features/documents/hooks/useDocumentForm.ts`, `src/features/documents/pages/DocumentDetailPage.tsx`, `src/mocks/handlers/nonconformities.handlers.ts`, `vite.config.ts`, plus the three test files listed above whose errors are not `User`-fixture-shaped.
- **No dependency changes are assumed up front** — `npm ls zod react-hook-form @hookform/resolvers` shows no duplicate top-level versions, so the resolver-type errors are not a simple dedupe fix; `@hookform/resolvers@5.4.0` internally supports both `zod/v3` and `zod/v4/core` compat shims.
- **Out of scope**: the ~50 `TS2739`/`TS2353` test-fixture errors (`User`/role shape mismatches), tracked in the separate `fix-tsc-test-fixture-errors` change.
- **CI**: `npx tsc -b --force` should report zero errors across all files listed above once this change lands; no test behavior is expected to change except where explicitly noted.
