## Why

`incident-detail`'s AC section documented `incidente.qeId` as "undefined until M4" — M4 (Quality Events) now exists, and `Incidente.qeId` is a real field set once an incident escalates into a QE. Today `IncidentACSection` ignores it entirely: users can still add, start, and close ACs directly on the incident even after its continuation moved to the QE, creating the same dual-source-of-truth problem already fixed for No Conformidades in `m4-s06-ac-qe-linkage`. This change applies that same pattern to Incidents.

## What Changes

- `IncidentACSection` becomes read-only when `incidente.qeId` is populated: the "+ Agregar AC" button and all per-AC transition/close actions (Iniciar, Cerrar) are hidden.
- Each existing AC row shows a "Ver en QE →" link navigating to `/quality-events/{incidente.qeId}`.
- A new "Solicitar AC en QE" button appears (below the AC list, or in the section header when the list is empty) for roles with `canAddAC`. Clicking it calls `PATCH /api/quality-events/{incidente.qeId}/solicitar-ac` (already implemented for M4/`m4-s06-ac-qe-linkage`), shows a Sonner success toast, and disables itself while pending.
- When `incidente.qeId` is not populated, `IncidentACSection` behaves exactly as before (no regression for standalone incidents).

## Capabilities

### New Capabilities
(none — this extends an existing capability)

### Modified Capabilities
- `incident-detail`: update the "Sección de Acciones Correctivas provisionales" requirement (now that M4 exists, `qeId` is no longer undefined) and add QE-linked read-only mode, "Ver en QE" link, and "Solicitar AC en QE" action.

## Impact

- `src/features/incidents/components/IncidentACSection.tsx` — add `qeId` prop, read-only branch, new button.
- `src/features/incidents/pages/IncidentDetailPage.tsx` — pass `incident.qeId` to `IncidentACSection`.
- Reuses `solicitarACEnQE(qeId)` / `useSolicitarACEnQE()` from `src/features/quality-events/api/quality-events.api.ts` and `hooks/useQualityEvents.ts` (added by `m4-s06-ac-qe-linkage`); if not yet implemented when this change is applied, add them there rather than duplicating in the incidents feature.
- `src/i18n/es-PE.json`, `src/i18n/en-US.json` — new keys under `incidents:acSection.*` for the "Solicitar AC en QE" button and success toast.
- No backend/MSW handler changes required — `PATCH /api/quality-events/:id/solicitar-ac` already exists.
