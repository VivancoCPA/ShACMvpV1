## Why

M4 (Quality Event) currently only has a list view and a creation form — there is no way to open a single QE, review or drive its root-cause investigation, manage its corrective actions, or see its audit history. Without a detail view, `JEFE_CALIDAD_SYST` cannot progress a QE past `ABIERTO` in practice, and the `qeId` linkage on `AccionCorrectiva` that M2/M3 already stub out (`TODO(M4-S05)` in `quality-events.fixtures.ts` and `qualityEvent.types.ts`) remains unresolved. This change delivers the QE detail page and formally adopts **Modelo B**: corrective actions belong to the Quality Event (`qeId` is the primary reference), with `AccionCorrectiva` records in NC/Incidents optionally pointing back to the QE that superseded them via an optional `qeId`.

## What Changes

- Add `QualityEventDetail` page at `/quality-events/:id` composed of four stacked sections: header (with status-transition panel), investigation, corrective actions, and audit trail.
- Add `QEHeaderSection`: read-only header with number, status/type/origin/severity badges, metadata grid, ciclo/reincidencia badge, origin-conditional block (link to Incident/NC, hallazgo ref, or cliente externo), and a CRITICA severity banner.
- Add `QEStatusTransitionPanel`: renders one button per valid transition (from `getValidQETransitions`) filtered by role permission, with RN-QE-002 (causa raíz firmada) and RN-QE-003 (ACs sin cerrar) guards, disabling the button with a tooltip when blocked; cierre transitions render disabled with a "Disponible en cierre" label (implemented in M4-S06).
- Add `QEInvestigationSection`: editable only for `JEFE_CALIDAD_SYST` while `estado` is `EN_INVESTIGACION`/`ANALISIS_COMPLETADO`; supports switching between the existing `5_PORQUES` / `ISHIKAWA` tools (`metodoAnalisis`) with a confirm-before-clear toast (no `window.confirm`), a `causaRaizDefinitiva` textarea (100–500 chars), and a PIN-gated (`1234`) "Aprobar causa raíz" action that stamps `causaRaizFirmadaEn`. Includes a disabled "Asistir con IA" placeholder button.
- Add `QEACSection` **(Modelo B)**: corrective actions owned by the QE, backed by new sub-resource endpoints `GET/POST /api/quality-events/:id/acciones-correctivas` and `PATCH .../:acId`, `.../:acId/status`. Reuses the `ACSection` (M2) visual/flow pattern: create modal, PENDIENTE→EN_EJECUCION→CERRADA transitions, close-with-evidence modal, "N de M ACs cerradas" progress indicator, and role/estado-gated "Nueva AC" button.
- Add `QEAuditTrail`: reverse-chronological timeline sourced from a new `GET /api/quality-events/:id/audit-trail` endpoint (returns the QE's existing embedded `auditTrail`), with per-action icons and an IA-generated badge.
- Add route `{ path: ':id', element: <QualityEventDetail /> }` under the `quality-events` segment, open to all authenticated roles.
- **Model B adoption**: replace the QE's stub `AccionCorrectivaQE` type with the shared `AccionCorrectiva`-shaped record (titulo, descripcion, responsableId, prioridad, plazoFecha, estado, descripcionEvidencia, evidenciaUrl) keyed by `qeId`; populate `qeAccionesCorrectivas` MSW fixtures for at least 5 of the 20 existing QEs; remove the `TODO(M4-S05)` markers.
- Add optional `qeId?: string` to `AccionCorrectiva` (nonconformities) and to `AccionCorrectivaIncidente` (incidents) so preexisting ACs can point at the QE that now owns their continuation. NC's `ACSection` gains a "Ver QE → QE-2026-00N" link when `ac.qeId` is set.

## Capabilities

### New Capabilities
- `quality-event-detail-page`: `QualityEventDetail` page composition, `QEHeaderSection`, and `QEStatusTransitionPanel` — read-only header, origin-conditional links, RN-QE-002/003-guarded transition buttons, loading skeleton and 404 state.
- `quality-event-investigation`: `QEInvestigationSection` — 5 Porqués / Ishikawa tool toggle, causa raíz definitiva field, PIN-gated approval flow, IA placeholder.
- `quality-event-ac-section`: `QEACSection` and its sub-resource endpoints — Modelo B corrective actions owned by the QE (create, transition, evidence-gated close, progress indicator).
- `quality-event-audit-trail`: `QEAuditTrail` component and `GET /api/quality-events/:id/audit-trail` endpoint.

### Modified Capabilities
- `quality-event-msw-handlers`: add AC sub-resource CRUD/status endpoints and the audit-trail endpoint for `/api/quality-events/:id`.
- `quality-event-msw-fixtures`: add `qeAccionesCorrectivas` fixture map (2–3 ACs for ≥5 of the 20 QEs); remove `TODO(M4-S05)` comments.
- `nonconformity-types`: add optional `qeId?: string` to `AccionCorrectiva`.
- `nc-msw-fixtures`: attach `qeId` to NC ACs already referenced by M4 fixtures.
- `ac-section`: render a "Ver QE" link on AC rows where `ac.qeId` is set.
- `incident-types`: add optional `qeId?: string` to `AccionCorrectivaIncidente`.
- `incident-msw-fixtures`: attach `qeId` to Incident ACs already referenced by M4 fixtures.
- `routing`: add the `:id` detail route under the `quality-events` segment.

## Impact

- **New files**: `src/features/quality-events/pages/QualityEventDetail.tsx`; `src/features/quality-events/components/{QEHeaderSection,QEStatusTransitionPanel,QEInvestigationSection,QEACSection,QEAuditTrail}.tsx`; corresponding Zod schemas under `src/features/quality-events/schemas/`; new hooks (`useQEAcciones`, `useCreateQEAccion`, `useUpdateQEAccion`, `useCerrarQEAccion`, `useQEAuditTrail`) under `src/features/quality-events/hooks/`; new API functions in `src/features/quality-events/api/quality-events.api.ts`.
- **Modified files**: `src/features/quality-events/types/qualityEvent.types.ts` (AC type replaced by Modelo B shape), `src/features/quality-events/index.ts` (new exports), `src/mocks/handlers/quality-events.handlers.ts`, `src/mocks/fixtures/quality-events.fixtures.ts`, `src/features/nonconformities/{types/nonconformity.types.ts,components/ACSection.tsx}`, `src/mocks/fixtures/nonconformities.fixtures.ts`, `src/features/incidents/types/incident.types.ts`, `src/mocks/fixtures/incidents.fixtures.ts`, `src/router/index.tsx`, `src/i18n/{es-PE.json,en-US.json}` (new `qualityEvents` detail/investigation/acSection/auditTrail keys).
- **No backend impact**: MSW remains the only data source; no changes to `.env` or the axios base URL.
- **Depends on**: M4-S01 (types, transitions, permissions), M4-S02 (API/query hooks), M4-S03 (badges), M4-S04 (form) — all already implemented.
