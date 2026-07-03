## Why

When a No Conformidad (NC) escalates into a Quality Event (`nc.qeGeneradoId` populated), the continuation of corrective-action management moves to the QE (`QEACSection`, already implemented in M4). Today `ACSection` in the NC module has no awareness of this handoff: users can still open "Agregar AC" and edit/close ACs directly on the NC, creating two competing sources of truth for the same corrective action. `ACSection` needs to switch to a read-only, QE-aware mode once the NC has generated a QE, and let JEFE_CALIDAD_SYST-adjacent roles request that a new AC be created in the QE instead.

## What Changes

- `ACSection` becomes read-only when `nc.qeGeneradoId` is populated: the "Agregar AC" button and all per-AC transition/close actions (Iniciar, Cerrar) are hidden.
- Each existing AC row keeps its info display but adds/keeps a "Ver en QE →" link navigating to `/quality-events/{nc.qeGeneradoId}` (existing per-AC `ac.qeId` link is preserved as-is; the new section-level link uses the NC's `qeGeneradoId`).
- A new "Solicitar AC en QE" button appears (below the AC list, or in the section header when the list is empty) for roles authorized to manage ACs (`canAsignarAC`). Clicking it calls the existing `PATCH /api/quality-events/{qeId}/solicitar-ac` endpoint, shows a Sonner success toast, and disables itself while the mutation is pending.
- When `nc.qeGeneradoId` is not populated, `ACSection` behaves exactly as before (no regression for standalone NCs).

## Capabilities

### New Capabilities
(none — this extends existing NC/QE capabilities)

### Modified Capabilities
- `ac-section`: add QE-linked read-only mode, "Ver en QE" section behavior, and "Solicitar AC en QE" action to `ACSection`.

## Impact

- `src/features/nonconformities/components/ACSection.tsx` — add `qeGeneradoId` prop, read-only branch, new button.
- `src/features/nonconformities/pages/NonconformityDetailPage.tsx` — pass `nc.qeGeneradoId` to `ACSection`.
- `src/features/quality-events/api/quality-events.api.ts` — add `solicitarACEnQE(qeId)` client function (endpoint already exists in MSW handlers).
- `src/features/quality-events/hooks/useQualityEvents.ts` (or nonconformities hooks) — add `useSolicitarACEnQE` mutation hook.
- `src/i18n/es-PE.json`, `src/i18n/en-US.json` — new keys under `nonconformities:acSection.*` for the read-only banner, "Solicitar AC en QE" button, and toast message.
- No backend/MSW handler changes required — `PATCH /api/quality-events/:id/solicitar-ac` already exists.
