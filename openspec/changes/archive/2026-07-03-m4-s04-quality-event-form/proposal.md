## Why

M4 has a list view and MSW layer but no creation entry point — users cannot yet report a Quality Event from the UI. This form is the operational core of M4: without it, no QE lifecycle (investigation, corrective actions, closure) can begin.

## What Changes

- New page `QualityEventForm` at `/quality-events/nuevo` with adaptive fields based on QE origin (4 variants).
- The "Nuevo QE" button in `QualityEventListPage` becomes a functional link to the new form route.
- The route `/quality-events/nuevo` is registered in the router with `RoleGuard` restricting access to `OPERARIO`, `SUPERVISOR`, and `JEFE_CALIDAD_SYST`.
- On successful submission, a Sonner toast displays the generated QE number and the user is redirected to the detail page.
- Loads related entities (incidents from M3, NCs from M2) into origin-specific selects via TanStack Query.

## Capabilities

### New Capabilities
- `quality-event-form`: Adaptive creation form for Quality Events with 4 conditional origin sections (O1–O4), shared header fields, Zod validation via `qualityEventCreateSchema`, and `useCreateQualityEvent` mutation.

### Modified Capabilities
- `routing`: Add `/quality-events/nuevo` route under the M4 route group with `RoleGuard` for `['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST']`.
- `quality-event-list-view`: Wire the "Nuevo QE" button to navigate to `/quality-events/nuevo` via `useNavigate`.

## Impact

- **New file**: `src/features/quality-events/pages/QualityEventForm.tsx`
- **Modified**: `src/router/index.tsx` — new child route under the `quality-events` segment
- **Modified**: `src/features/quality-events/pages/QualityEventListPage.tsx` — button onClick wired
- **Depends on** (must exist): `qualityEventCreateSchema` (M4-S01), `useCreateQualityEvent` (M4-S02), `QEStatusBadge`/`QEOriginBadge`/`QETypeBadge` (M4-S03), `AREAS_SHAC` in `shared.constants.ts`, incident MSW fixtures (M3), NC MSW fixtures (M2)
- No new MSW handlers required — form submits to existing `POST /api/quality-events` handler from M4-S02
