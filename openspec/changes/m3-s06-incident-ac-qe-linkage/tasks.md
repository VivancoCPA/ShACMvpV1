## 1. API client and hook (shared with m4-s06)

- [x] 1.1 Verify `solicitarACEnQE(qeId: string): Promise<QualityEvent>` exists in `src/features/quality-events/api/quality-events.api.ts` (calls `PATCH /api/quality-events/{qeId}/solicitar-ac`); if `m4-s06-ac-qe-linkage` has not been implemented yet, add it there
- [x] 1.2 Verify `useSolicitarACEnQE()` mutation hook exists in `src/features/quality-events/hooks/useQualityEvents.ts`; add if missing (same location as 1.1)
- [x] 1.3 Verify it is re-exported from `src/features/quality-events/index.ts`

## 2. IncidentACSection read-only mode

- [x] 2.1 Add `qeId?: string` to `IncidentACSectionProps` in `src/features/incidents/components/IncidentACSection.tsx`
- [x] 2.2 Derive `isQELinked = !!qeId` and hide the "+ Agregar AC" button when `isQELinked` is true
- [x] 2.3 Hide per-AC "Iniciar" and "Cerrar con evidencia" buttons when `isQELinked` is true (keep read-only fields: descripcion, responsableNombre, plazoFecha, estado badge, evidencia)
- [x] 2.4 Render a "Ver en QE →" link per AC row navigating to `/quality-events/{qeId}` when `isQELinked` is true

## 3. Solicitar AC en QE button

- [x] 3.1 Render "Solicitar AC en QE" button when `isQELinked && canAsignarAC` (prop passed as `canAddAC` from the permissions object) — placed below the AC list when non-empty, or in the section header when `accionesCorrectivas` is empty
- [x] 3.2 Wire the button to `useSolicitarACEnQE().mutate(qeId)`; disable the button while `isPending`
- [x] 3.3 On success, show a Sonner toast using `t('incidents:acSection.toasts.solicitudEnviada')`

## 4. Wire up IncidentDetailPage

- [x] 4.1 Pass `qeId={incident.qeId}` to `<IncidentACSection />` in `src/features/incidents/pages/IncidentDetailPage.tsx`

## 5. Internacionalización

- [x] 5.1 Add `incidents:acSection.actions.solicitarQE` ("Solicitar AC en QE") and `incidents:acSection.toasts.solicitudEnviada` ("Solicitud enviada — el Jefe de Calidad creará la AC en el QE") to `src/i18n/es-PE.json`
- [x] 5.2 Add the same keys (English copy) to `src/i18n/en-US.json`

## 6. Tests

- [x] 6.1 Update/add tests for `IncidentACSection` covering: no "+ Agregar AC" / no transition buttons when `qeId` is set, "Ver en QE" link renders, "Solicitar AC en QE" visibility by permission and empty-list placement, and button disables while pending
