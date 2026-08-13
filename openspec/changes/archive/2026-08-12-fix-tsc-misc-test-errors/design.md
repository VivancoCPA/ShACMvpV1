## Context

5 unrelated files, 6 errors, no shared root cause — this design doc exists mainly to record why each fix was made the way it was, since none of them are mechanical enough to skip justification.

## Goals / Non-Goals

**Goals:**
- Zero `tsc -b` errors in the 5 files listed in the proposal.
- No behavior change anywhere except the one deliberate type-precision fix in `createIncident.schema.ts`, which is itself behavior-neutral at runtime.

**Non-Goals:**
- Auditing other `vi.fn()`/`it.each` call sites elsewhere in the codebase for the same patterns — fixed only where `tsc` currently flags it.

## Decisions

**`PanelPendientesAreaWidget.test.tsx`: add the missing parameter, don't restructure the test.**
Read the test's `renderWidget()` setup first — it pre-registers all 3 possible destination routes (`/quality-events/:id`, `/nonconformities/:id`, `/incidents/:id`), each rendering a distinct `data-testid`. The assertion (`screen.getByTestId(...)`) already fully verifies correct navigation happened, since only the matching `<Route>` renders. The tuple's second element (`route`, e.g. `/quality-events`) was never actually needed by the assertion — confirmed before deciding this wasn't a dropped check.

**`IncidentQuickReportForm.test.tsx` → `createIncident.schema.ts`: fix the schema, not the test.**
The test reads `payload.evidencias?.[0].descripcion` on the argument captured from a mocked `createIncident` call. `createIncident`'s real parameter type comes from `CreateIncidentInput = z.infer<typeof createIncidentSchema>`, whose `evidencias` field was `z.array(z.unknown())` — deliberately loose, but incorrectly so: read `IncidentQuickReportForm.tsx`'s submit handler and confirmed it always builds a fully-typed `const evidencias: IncidentEvidencia[] = photos.map(...)` before calling `createIncident`. There is no code path where `evidencias` is anything other than `IncidentEvidencia[]`. Tightening the schema (`z.array(z.custom<IncidentEvidencia>())`) fixes the actual production type gap rather than papering over it with a cast in the test — the schema was simply underspecified, not intentionally permissive.

**`QEHeaderSection.test.tsx`: fix the mock's inferred signature, don't touch the pass-through wrapper.**
The wrapper (`(...args: unknown[]) => buildQualityEventPdfMock(...args)`) exists so assertions can inspect calls via `buildQualityEventPdfMock` while `vi.mock`'s factory forwards real call args through. The break was `vi.fn(() => (...))`'s zero-arg factory function narrowing the mock's inferred signature to accept no parameters, making the spread invalid. Fixed at the actual source of the narrowing (the factory function passed to `vi.fn`), not the wrapper.

**The two unused `screen` imports: removed outright, no further investigation needed.**
Confirmed zero usages via grep in each file before removing — same treatment as the original `TS6133` case in `fix-tsc-production-type-errors` (task 6.3), just without the "is this a dropped check" ambiguity that one had (no logic reads `screen` at all here).

## Risks / Trade-offs

- **[Risk]** Tightening `createIncident.schema.ts`'s `evidencias` type could reject a caller that was relying on the old `z.unknown()` looseness → **Mitigation**: grepped every call site of `createIncident`/`createIncidentSchema`; only one production caller exists (`IncidentQuickReportForm.tsx`), and it already always passes `IncidentEvidencia[]`.

## Open Questions

None.
