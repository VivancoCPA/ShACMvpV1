## Why

Final verification of `fix-tsc-production-type-errors` surfaced 8 remaining `tsc -b` errors in files that neither that change nor `fix-tsc-test-fixture-errors` declared in scope — they emerged from repo evolution since the original diagnosis handoff, not from either change's own work. 2 of the 8 are `User`-shape errors (folded into `fix-tsc-test-fixture-errors`, the natural home for that root cause); this change covers the remaining 6, across 5 files, none of which share a common root cause with each other — each is independently diagnosed and fixed below.

## What Changes

- `NCStatusBadge.test.tsx` and `IncidentListPage.test.tsx`: removed an unused `screen` import from `@testing-library/react` in each (confirmed zero usages via grep before removing).
- `PanelPendientesAreaWidget.test.tsx`: an `it.each` callback only destructured the first element of each 2-tuple test case (`[origenTipo, route]`), while Vitest's typing for `it.each` requires the callback to accept both. Confirmed the test doesn't need `route` (the pre-registered `<Route>` elements already verify correct navigation via distinct `data-testid`s) — added `_route` as an intentionally-unused second parameter rather than restructuring the test's assertions.
- `IncidentQuickReportForm.test.tsx`: `createIncident.schema.ts`'s `evidencias` field was typed as `z.array(z.unknown())`, too loose for what's actually always passed — `IncidentQuickReportForm.tsx` always constructs a fully-typed `IncidentEvidencia[]` before calling `createIncident`. Tightened the schema to `z.array(z.custom<IncidentEvidencia>())`, a production type-precision fix, not a test-only cast.
- `QEHeaderSection.test.tsx`: a `vi.mock` pass-through wrapper (`(...args: unknown[]) => buildQualityEventPdfMock(...args)`) spread its args into `buildQualityEventPdfMock`, but that mock was declared via `vi.fn(() => (...))` — a zero-parameter arrow function, so its inferred call signature couldn't accept the spread. Gave the mock's factory function an explicit `(..._args: unknown[])` signature instead — identical runtime behavior (the mock still ignores its arguments), just an honest type.

No production behavior changes are intended except the `createIncident.schema.ts` type tightening, which doesn't change what the schema accepts at runtime (every real caller already passes `IncidentEvidencia[]`) — it only makes the type match what was already true.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `incident-schemas`: `createIncidentSchema`'s `evidencias` field was typed as `z.array(z.unknown())` — the existing spec never documented this field's type at all. Adding it as `z.array(z.custom<IncidentEvidencia>())`, matching what every real caller already provides. No runtime validation behavior changes (both the old and new type are structurally permissive at the Zod-validation level — `z.custom<T>()` performs no runtime check, only tightens the static type); it's the TypeScript contract that changes.

## Impact

- **Affected code**: `src/components/shared/NCStatusBadge.test.tsx`, `src/features/incidents/pages/IncidentListPage.test.tsx`, `src/features/dashboard/components/PanelPendientesAreaWidget.test.tsx`, `src/features/incidents/components/IncidentQuickReportForm.test.tsx` (indirectly, via its dependency), `src/features/incidents/schemas/createIncident.schema.ts`, `src/features/quality-events/components/QEHeaderSection.test.tsx`.
- **Out of scope**: the 2 `User`-shape errors from this same discovery, folded into `fix-tsc-test-fixture-errors` instead (same root cause as that change's existing scope).
- **CI**: `npx tsc -b --force` reports zero errors across all 5 files above.
