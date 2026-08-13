## 1. Unused imports

- [x] 1.1 `src/components/shared/NCStatusBadge.test.tsx` — confirmed `screen` has zero usages via grep, removed from the `@testing-library/react` import.
- [x] 1.2 `src/features/incidents/pages/IncidentListPage.test.tsx` — same; confirmed `render`, `cleanup`, `within` are still used, only `screen` removed.

## 2. it.each callback signature

- [x] 2.1 `src/features/dashboard/components/PanelPendientesAreaWidget.test.tsx` — read `renderWidget()`'s route setup first to confirm the second tuple element (`route`) isn't needed by the assertion (navigation is already verified via distinct `data-testid`s per pre-registered `<Route>`). Added `_route` as the callback's second parameter.

## 3. createIncident.schema.ts type precision

- [x] 3.1 Traced `IncidentQuickReportForm.test.tsx`'s `payload.evidencias?.[0].descripcion` (TS2571) back to `createIncidentSchema`'s `evidencias: z.array(z.unknown())`.
- [x] 3.2 Grepped every caller of `createIncident`/`createIncidentSchema` — confirmed only `IncidentQuickReportForm.tsx` calls it, and it always builds a fully-typed `IncidentEvidencia[]` before the call.
- [x] 3.3 Tightened the schema to `z.array(z.custom<IncidentEvidencia>())`.

## 4. Mock factory signature

- [x] 4.1 `src/features/quality-events/components/QEHeaderSection.test.tsx` — traced the `TS2556` spread error to `buildQualityEventPdfMock`'s `vi.fn(() => (...))` factory having an inferred zero-parameter signature. Fixed by giving the factory function an explicit `(..._args: unknown[])` signature — same runtime behavior, honest type.

## 5. Verification

- [x] 5.1 Ran `npx tsc -b --force`: all 6 errors across the 5 files gone (58 → 52 project-wide, matching the expected count exactly).
- [x] 5.2 Ran `npx vitest run` on all 5 affected test files: 40/40 pass, no regressions.
