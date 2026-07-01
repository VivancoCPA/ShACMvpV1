## Context

M4-S01 defined types and schemas (`qualityEventCreateSchema` as a discriminated union on `origen`). M4-S02 built the API layer, MSW handlers, and hooks including `useCreateQualityEvent`. M4-S03 delivered the list view, badges, and `/quality-events` route. The "Nuevo QE" button renders in the list but has no navigation target yet — there is no creation form and no `/quality-events/nuevo` route.

M2 and M3 MSW fixtures and handlers are already running — incidents (`GET /api/incidents`) and NCs (`GET /api/nonconformities`) are accessible from this form for the O1/O2 selects without any new mocking work.

## Goals / Non-Goals

**Goals:**
- Implement `QualityEventForm` page with adaptive origin sections (O1–O4) and shared header fields.
- Register `/quality-events/nuevo` route with `RoleGuard` restricting to `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`.
- Wire the "Nuevo QE" button in `QualityEventListPage` to navigate to the new route.
- Submit via `useCreateQualityEvent`, show toast with QE number, redirect to detail.

**Non-Goals:**
- Edit form, detail page, or AC management (future specs).
- New MSW handlers — `POST /api/quality-events` already exists in M4-S02.
- Any change to `qualityEventCreateSchema` — it is consumed as-is from M4-S01.
- `mineralInvolucrado` enforcement (hint only, no submit block).

## Decisions

### Origin-conditional fields via `watch` + `resetField`
React Hook Form's `watch('origen')` drives which conditional section renders. On origin change, the previous origin's fields are reset via `setValue` to clear them (e.g., clearing `incidenteId` when switching from O1 to O2). This avoids stale values reaching the submit payload.

**Alternative considered**: Separate sub-forms per origin — rejected because it requires complex state merging and breaks RHF's unified validation.

### O4 nested field structure
`qualityEventCreateSchema` expects O4 data as `reporteExternoRef: { nombreCliente, fechaRecepcion }`. The form uses RHF's dot-notation registration: `register('reporteExternoRef.nombreCliente')` and `register('reporteExternoRef.fechaRecepcion')`. No flattening or transform is needed at the component level.

**Alternative considered**: Collect flat fields and reshape in `onSubmit` — rejected because it requires a manual transformation that could drift from the schema.

### `fechaHoraEvento` as datetime-local converted to ISO
The `<input type="datetime-local">` returns a string like `'2026-07-01T14:30'`. Before calling `mutate`, the submit handler appends `':00Z'` (or uses `new Date(...).toISOString()`) to produce the ISO 8601 string expected by the schema's `z.string().datetime()`. Future-date validation is applied via a Zod `superRefine` on the schema or inline in the submit handler — if the schema already enforces it, the error surfaces via `formState.errors`; if not, a manual check displays the error before calling `mutate`.

### Incident/NC selects loaded via separate `useQuery` calls
Origin O1 fires `useQuery` for `GET /api/incidents` (using the M3 hook pattern); O2 fires `useQuery` for `GET /api/nonconformities` (using the M2 hook pattern). Both hooks run only when their respective origin is active (`enabled: origen === 'O1_INCIDENTE_CAMPO'` / `enabled: origen === 'O2_NC_DETECTADA'`).

**Alternative considered**: Pre-load both lists on mount — rejected to avoid unnecessary requests when the user hasn't selected those origins.

### Two-column desktop layout via CSS Grid
The form uses `grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4`. Short paired fields (`tipo`+`severidad`, `turno`+`fechaHoraEvento`) are placed side-by-side with `md:col-span-1`. Full-width fields (`descripcion`, origin sections) use `md:col-span-2`.

## Risks / Trade-offs

- **Schema min(10) vs. UX min(20) for `descripcion`**: The schema enforces `min(10)` but the UX requirement says min 20 chars. The form respects the schema (Zod drives validation); the spec for the form will document the effective min as 10 to match the schema.
- **O4 `fechaRecepcion` type**: The schema validates it as a regex `^\d{4}-\d{2}-\d{2}$` (date-only). The `<input type="date">` returns exactly this format — no conversion needed.
- **`useCreateQualityEvent` toasts on success internally**: The hook already calls `toast.success` on success (per M4-S02 spec). The form's `onSuccess` only needs to handle navigation, avoiding a double toast.

## Migration Plan

1. Create `QualityEventForm.tsx` page.
2. Add `/quality-events/nuevo` child route to router.
3. Wire "Nuevo QE" button in `QualityEventListPage` (check for existing `onClick` first).
4. No MSW changes, no fixture changes.
