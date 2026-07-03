## 1. API client and hook

- [x] 1.1 Add `solicitarACEnQE(qeId: string): Promise<QualityEvent>` to `src/features/quality-events/api/quality-events.api.ts`, calling `PATCH /api/quality-events/{qeId}/solicitar-ac` (endpoint already exists in `quality-events.handlers.ts`)
- [x] 1.2 Add `useSolicitarACEnQE()` mutation hook in `src/features/quality-events/hooks/useQualityEvents.ts`, invalidating the QE detail query on success
- [x] 1.3 Re-export `useSolicitarACEnQE` from `src/features/quality-events/index.ts`

## 2. ACSection read-only mode

- [x] 2.1 Add `qeGeneradoId?: string` to `ACSectionProps` in `src/features/nonconformities/components/ACSection.tsx`
- [x] 2.2 Derive `isQELinked = !!qeGeneradoId` and hide the "Agregar AC" button when `isQELinked` is true
- [x] 2.3 Hide per-AC "Iniciar", "Completar"/transition, and "Cerrar con evidencia" buttons when `isQELinked` is true (keep read-only fields: descripcion, responsable, plazoFecha, estado badge, evidencia)
- [x] 2.4 Render a "Ver en QE →" link per AC row navigating to `/quality-events/{qeGeneradoId}` when `isQELinked` is true, alongside (not replacing) the existing per-AC `ac.qeId` link

## 3. Solicitar AC en QE button

- [x] 3.1 Render "Solicitar AC en QE" button when `isQELinked && canAsignarAC` — placed below the AC list when non-empty, or in the section header when `accionesCorrectivas` is empty
- [x] 3.2 Wire the button to `useSolicitarACEnQE().mutate(qeGeneradoId)`; disable the button while `isPending`
- [x] 3.3 On success, show a Sonner toast using `t('nonconformities:acSection.toasts.solicitudEnviada')`

## 4. Wire up NonconformityDetailPage

- [x] 4.1 Pass `qeGeneradoId={nc.qeGeneradoId}` to `<ACSection />` in `src/features/nonconformities/pages/NonconformityDetailPage.tsx`

## 5. Internacionalización

- [x] 5.1 Add `nonconformities:acSection.actions.solicitarQE` ("Solicitar AC en QE") and `nonconformities:acSection.toasts.solicitudEnviada` ("Solicitud enviada — el Jefe de Calidad creará la AC en el QE") to `src/i18n/es-PE.json`
- [x] 5.2 Add the same keys (English copy) to `src/i18n/en-US.json`

## 6. Tests

- [x] 6.1 Update/add tests for `ACSection` covering: no "Agregar AC" / no transition buttons when `qeGeneradoId` is set, "Ver en QE" link renders, "Solicitar AC en QE" visibility by permission and empty-list placement, and button disables while pending
