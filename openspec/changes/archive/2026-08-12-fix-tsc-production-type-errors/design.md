## Context

`npx tsc -b --force` on the current tree reports 82 errors; this change covers the ~32 that live in production code, schemas, and non-fixture test files (the remaining ~50 `User`/role-fixture errors are tracked separately in `fix-tsc-test-fixture-errors`). Each item below was traced to a confirmed root cause by reading the actual `tsc` output and the referenced source — none of this is inferred from the original diagnosis alone.

## Goals / Non-Goals

**Goals:**
- Zero `tsc -b` errors in the files listed in the proposal's Impact section.
- Every fix traces to a confirmed root cause (file + line), not a guess.
- No behavior change, except where explicitly called out for review.

**Non-Goals:**
- Fixing the `User`/role test-fixture errors (separate change).
- Upgrading `zod`, `react-hook-form`, `@hookform/resolvers`, `vite`, or `vitest` — all fixes work within currently installed versions.
- Auditing every other zod schema in the codebase for v3-only APIs beyond `required_error`/`invalid_type_error` (out of scope unless `tsc` flags it).

## Decisions

**D1 — zod v3 → v4 `required_error`/`invalid_type_error` migration (5 of 6 `TS2769`).**
Confirmed by grep: only 3 files use the removed params — `nuevaVersion.schema.ts` (1), `incidentForm.schema.ts` (2), `mobileIncidentReport.schema.ts` (2). Zod v4 replaces both with a single `error` param (string or a function receiving the issue). Fix: `{ required_error: 'X' }` → `{ error: 'X' }` on each `z.enum(...)` call. This is message-preserving — the string itself doesn't change, only which key carries it — so no behavior change is expected, but each site should be spot-checked (e.g. via the existing schema test if one exists) since v4's `error` also collapses the old `invalid_type_error` case into the same key, which could theoretically change which message wins for a non-string/wrong-type input vs. a missing one. None of the 3 affected schemas use `invalid_type_error`, so that collapse doesn't apply here in practice.

**D2 — `IncidentForm.tsx`'s "two unrelated `Resolver` types" is very likely a downstream effect of D1, not independent.**
`incidentForm.schema.ts` has the exact `required_error` bug on the same `tipo`/`turno` enum fields that appear in `IncidentForm.tsx`'s broken `Resolver<...>` type dump. A schema call that fails its own overload resolution can produce a corrupted/widened inferred type for that field, which is consistent with `useForm<T>()`'s hand-declared `T` diverging from `zodResolver(schema)`'s inferred type just enough for TS to treat the two `Resolver` instantiations as unrelated (TS's message for this is specifically about two instantiations of the *same* generic, not two different modules — confirmed by the import paths in the error being identical). Decision: fix D1 first, then re-run `tsc -b` before touching `IncidentForm.tsx` directly — do not assume a separate fix is needed until proven necessary.

**D3 — `NCForm.tsx` and `QEACSection.tsx`'s Resolver errors are a separate, independent issue.**
Their schemas (`createNC.schema.ts`, `createQEAccion.schema.ts`, `cerrarQEAccion.schema.ts`, `solicitarAjustePlazoAC.schema.ts`, `rechazarAjustePlazoAC.schema.ts`) do **not** use `required_error`/`invalid_type_error` (confirmed by grep across the whole `src/` tree — only the 3 files in D1 match). So D1's fix will not resolve these. Each occurrence needs its own diff between the `useForm<T>()` generic and the corresponding schema's `z.infer` output to find where they've drifted — this is investigation work done during implementation (tasks.md), not resolved here.

**D4 — `useDocumentForm.ts`'s `UserRole[]` mismatch is a real type-narrowing gap, not a bug in the schema.**
`Documento.rolesAutorizados` (`documents.types.ts:67`) is typed as the full `UserRole[]`, but `documentFormSchema`'s `rolesAutorizados` field uses a local `userRoleEnum` restricted to 6 operational roles — deliberately excluding `ADMINISTRADOR_SISTEMA`, and (per CLAUDE.md's rule that `ADMINISTRADOR_SISTEMA` never has access to any operational module) also correctly excluding the newer `ADMINISTRADOR_EMPRESA`/`SUPERADMIN` multi-tenant roles added by the MultiEmpresa work, since none of those three are legitimate "authorized reader" roles for a confidential *document*. **The schema is right; `Documento.rolesAutorizados`'s type is too wide.** Decision: narrow `Documento.rolesAutorizados` to a shared literal-union type (e.g. export the 6-role list from `documents.types.ts` as `DocumentAuthorizedRole`, or from a shared constants file) and have `documentForm.schema.ts`, `createDocument.schema.ts`, and `updateDocument.schema.ts` reference it instead of each redeclaring their own local `userRoleEnum` — the three schemas already have three independent copies of the same 6-role list, which is exactly the kind of drift that let this list silently miss review when the MultiEmpresa roles were added. Consolidating removes that repeat-drift risk going forward, at the cost of touching 4 files instead of 1.

**D5 — `vite.config.ts`'s `test` block: switch `defineConfig` import from `"vite"` to `"vitest/config"`.**
Confirmed `node_modules/vitest/config.d.ts` exists (Vitest 4.1.9 is installed) and re-exports a `defineConfig` that augments Vite's `UserConfigExport` with the `test` property, while remaining a drop-in replacement for every other config field already in use (plugins, css, optimizeDeps). One-line import change, no dependency change, no behavior change.

**D6 — `nonconformities.handlers.ts:245`: match the existing double-cast convention.**
`quality-events.handlers.ts` (same audit-diffing pattern, dynamic field lookup by string key for `AuditTrailEntry` generation) already does `(qe as unknown as Record<string, unknown>)[campo]` — the safe two-step cast TS itself suggests in the error message. `nonconformities.handlers.ts` should use the identical pattern for consistency rather than inventing a different workaround.

**D7 — `DocumentDetailPage.tsx:17`: import the `JSX` type instead of relying on a global namespace.**
With React 19's `jsx: "react-jsx"` transform, the ambient global `JSX` namespace is no longer automatically available; the codebase's own convention (verify during implementation against how other files in `features/documents` type JSX-returning helper functions) should be followed — most likely `import type { JSX } from 'react'` and keep the `JSX.Element` return type as-is, which is the smallest possible change.

**D8 — Everything else is a true one-off:** `DocumentForm.tsx`'s unused `existingFileUrl` (`TS6133`) gets removed if truly dead, or wired up if it was meant to be used (check git history / surrounding logic first — an unused variable named `existingFileUrl` in a document-replace form is exactly the shape of bug where a real check was silently dropped, not just leftover cruft); `documents.types.test.ts:68` (`TS2344`) is a type-level equality assertion that has the wrong expected literal (`"Documento"` vs `"NoConformidad"`) and needs reading in context to know which side is actually wrong; `locales.handlers.test.ts:85` and the `AxiosResponse`-vs-`Record<string,string>` headers mismatches in `auth.handlers.test.ts`/`documents.handlers.test.ts` are test-helper typing gaps, fixed by matching the helper's expected shape to Axios's real `AxiosResponseHeaders` type rather than a hand-rolled `Record<string, string>`.

## Risks / Trade-offs

- **[Risk]** D1's `required_error` → `error` swap could, in a version neither of us has fully audited, change *which* message wins for edge cases (empty string vs. wrong type vs. missing value) → **Mitigation**: none of the 3 affected schemas use `invalid_type_error`, so there's no dual-key collapse to worry about here; still, run each affected form's existing tests (or add one if none covers the validation message) before closing this out.
- **[Risk]** D2's "fix D1 and re-check" approach could turn out wrong if `IncidentForm.tsx`'s divergence has an independent cause → **Mitigation**: this is exactly why it's a re-check step in tasks.md, not an assumption baked into the plan; if errors persist after D1, treat it as D3's case (independent per-file diff).
- **[Risk]** D4 touches 4 files (types + 3 schemas) instead of 1 → **Mitigation**: accepted trade-off; the alternative (patch only `useDocumentForm.ts` with a local cast) would hide the same drift risk that caused this exact error, and CLAUDE.md's role-scoping rule makes the "correct" set of authorized roles a business decision worth centralizing, not a per-call-site cast.

## Open Questions

- D8's `existingFileUrl` in `DocumentForm.tsx`: needs a read of the surrounding replace-file logic (and possibly `git log -p` on that line) before knowing whether the fix is "delete the dead variable" or "wire it into a check that was silently dropped." Flag to a human if the latter looks true — a silently-broken validation is a correctness bug, not a lint fix, and shouldn't be resolved unilaterally inside this change per the project's "diagnóstico antes de fix" convention.
