## 1. Types — Modelo B adoption

- [x] 1.1 In `src/features/quality-events/types/qualityEvent.types.ts`, replace `AccionCorrectivaQE` with the M2-shaped record (`id, qeId, titulo?, descripcion, responsableId, responsableNombre, plazoFecha, prioridad?, estado: 'PENDIENTE'|'EN_EJECUCION'|'CERRADA', creadoEn, actualizadoEn, descripcionEvidencia?, evidenciaUrl?, fechaCierre?`) and remove the `TODO(M4-S0X)` comment above it.
- [x] 1.2 Add `CreateQEACInput` (`titulo?`, `descripcion`, `responsableId`, `prioridad?`, `plazoFecha`) and `CerrarQEACInput` (`descripcionEvidencia` required, `evidenciaUrl?`) types/Zod schemas under `src/features/quality-events/schemas/` (`createQEAccion.schema.ts`, `cerrarQEAccion.schema.ts`), mirroring `createAC.schema.ts`/`cerrarAC.schema.ts` from M2.
- [x] 1.3 Add optional `qeId?: string` to `AccionCorrectiva` in `src/features/nonconformities/types/nonconformity.types.ts`.
- [x] 1.4 Add optional `qeId?: string` to `AccionCorrectivaIncidente` in `src/features/incidents/types/incident.types.ts`.

## 2. MSW handlers — AC sub-resource and audit-trail endpoints

- [x] 2.1 In `src/mocks/handlers/quality-events.handlers.ts`, add `GET /api/quality-events/:id/acciones-correctivas` returning the matching QE's `accionesCorrectivas` (404 if QE not found).
- [x] 2.2 Add `POST /api/quality-events/:id/acciones-correctivas` that appends a new AC with generated `id`, `estado: 'PENDIENTE'`, `qeId: :id`, `creadoEn`/`actualizadoEn` timestamps (404 if QE not found).
- [x] 2.3 Add `PATCH /api/quality-events/:id/acciones-correctivas/:acId` that merges field edits into the matching AC (404 if QE or AC not found).
- [x] 2.4 Add `PATCH /api/quality-events/:id/acciones-correctivas/:acId/status` that transitions `estado`, returning 422 with `success: false` when the target is `CERRADA` and `descripcionEvidencia` is missing/empty (404 if QE or AC not found).
- [x] 2.5 Add `GET /api/quality-events/:id/audit-trail` returning the matching QE's `auditTrail` sorted by `timestamp` descending (404 if QE not found).
- [x] 2.6 Verify `qualityEventHandlers` (already registered in `src/mocks/handlers/index.ts`) picks up the new handlers with no separate registration step needed.

## 3. Fixtures — QE-owned ACs, audit trail depth, cross-module qeId links

- [x] 3.1 In `src/mocks/fixtures/quality-events.fixtures.ts`, add a `qeAccionesCorrectivas: Record<string, AccionCorrectivaQE[]>` map with 2–3 ACs for at least 5 of the 20 QE fixtures (varying `estado`, `prioridad`, and at least one `CERRADA` with `descripcionEvidencia` set), then seed each matching QE's `accionesCorrectivas` from the map.
- [x] 3.2 Remove the `TODO(M4-S05)` comments from `quality-events.fixtures.ts`.
- [x] 3.3 Extend `auditTrail` on all 20 QE fixtures to at least 4 entries each (creation, state change, a field edit, and — for QEs with `causaRaizFirmadaEn` set — a causa-raíz-approval entry), keeping `id`/`timestamp` internally consistent.
- [x] 3.4 In `src/mocks/fixtures/nonconformities.fixtures.ts`, set `qeId: 'qe-2026-002'` on at least one AC of `nc-002` and `qeId: 'qe-2026-006'` on at least one AC of `nc-003` (the NCs already cross-referenced from the QE fixtures).
- [x] 3.5 In `src/mocks/fixtures/incidents.fixtures.ts`, add at least one `AccionCorrectivaIncidente` to `inc-001` with `qeId: 'qe-2026-005'`, and at least one to `inc-002` with `qeId: 'qe-2026-001'` (both currently have `accionesCorrectivas: []`).

## 4. API client and hooks

- [x] 4.1 In `src/features/quality-events/api/quality-events.api.ts`, add `getQEAcciones(qeId)`, `createQEAccion(qeId, data)`, `updateQEAccion(qeId, acId, data)`, `cerrarQEAccion(qeId, acId, data)`, and `getQEAuditTrail(qeId)`, matching the `GET/POST/PATCH` calls to the endpoints from Section 2.
- [x] 4.2 Add hooks `useQEAcciones(qeId)`, `useCreateQEAccion(qeId)`, `useUpdateQEAccion(qeId)`, `useCerrarQEAccion(qeId)` under `src/features/quality-events/hooks/`, invalidating the QE detail query key on mutation success (mirroring `useNonconformities.ts`'s AC hooks).
- [x] 4.3 Add hook `useQEAuditTrail(qeId)` under `src/features/quality-events/hooks/`.
- [x] 4.4 Export all new types, schemas, api functions, and hooks from `src/features/quality-events/index.ts`.

## 5. QEHeaderSection and QEStatusTransitionPanel

- [x] 5.1 Create `src/features/quality-events/components/QEHeaderSection.tsx`: top row (numero, `QEStatusBadge`, `QETypeBadge`, `QEOriginBadge`, `SeverityBadge`), metadata grid (areaAfectada, mineralInvolucrado if present, turno, fechaHoraEvento/fechaHoraReporte via `Intl.DateTimeFormat`, reporter name, ciclo/"Reincidencia ×N" badge), origin-conditional block (O1 → link to `/incidents/:incidenteId`; O2 → link to `/nonconformities/:ncId`; O3 → `hallazgoAuditoriaRef` label; O4 → `reporteExternoRef.nombreCliente`/`fechaRecepcion`), and a CRITICA severity banner.
- [x] 5.2 Create `src/features/quality-events/components/QEStatusTransitionPanel.tsx`: derive valid transitions from `getValidQETransitions(qe.estado)`, filter by `getQualityEventPermissions(qe.estado, rol, esResponsable)`, render one button per allowed transition; disable the `EN_EJECUCION` button with an RN-QE-002 tooltip when `causaRaizFirmadaEn` is empty; disable the `CERRADO` button with an RN-QE-003 tooltip when any AC has `estado !== 'CERRADA'`, and always render it as `disabled`/"Disponible en cierre" pending M4-S06; call `useTransitionQEStatus()` on click and show a Sonner success toast with the new state.
- [x] 5.3 Add i18n keys under `qualityEvents.detail.header.*` and `qualityEvents.detail.transitions.*` in `src/i18n/es-PE.json` and `src/i18n/en-US.json`.

## 6. QEInvestigationSection

- [x] 6.1 Create `src/features/quality-events/components/QEInvestigationSection.tsx` with the 5 Porqués/Ishikawa radio toggle bound to `metodoAnalisis`, gated editable only for `JEFE_CALIDAD_SYST` while `estado` is `EN_INVESTIGACION`/`ANALISIS_COMPLETADO`.
- [x] 6.2 Implement the tool-switch confirm flow as a Sonner toast with a "Confirmar cambio" action (no `window.confirm`); only clear the previous tool's fields on confirm.
- [x] 6.3 Implement the 5-row 5 Porqués table (fixed labels, editable `respuesta` textareas, all optional) and the 6-category Ishikawa block (Método, Máquina, Material, Mano de obra, Medición, Medio ambiente).
- [x] 6.4 Add the `causaRaizDefinitiva` textarea with a Zod schema enforcing 100–500 characters, and the "Guardar investigación" button calling `useUpdateQualityEvent().mutate({ id, data })` with `metodoAnalisis`, `cincoPorques`/`ishikawa`, `causaRaizDefinitiva`.
- [x] 6.5 Implement the "Aprobar causa raíz" button (visible only when `causaRaizDefinitiva` is set and `causaRaizFirmadaEn` is empty) with a PIN modal accepting only `1234`; on confirm, PATCH `causaRaizFirmadaEn` to the current ISO timestamp.
- [x] 6.6 Render the read-only approval seal ("Aprobado por [nombre] el [fecha]") once `causaRaizFirmadaEn` is set.
- [x] 6.7 Add the disabled "Asistir con IA" button with a "Próximamente disponible" tooltip (no logic behind it).
- [x] 6.8 Add i18n keys under `qualityEvents.detail.investigation.*` in both locale files.

## 7. QEACSection

- [x] 7.1 Create `src/features/quality-events/components/QEACSection.tsx` adapting `ACSection.tsx` (M2): header with "N de M ACs cerradas" progress text, AC list rows (titulo, descripcion, status badge, prioridad badge, responsableNombre, `DeadlineBadge`).
- [x] 7.2 Implement "Nueva AC" modal (titulo, descripcion, responsableId select via `useUsers()`, prioridad, plazoFecha) visible to `JEFE_CALIDAD_SYST` when `estado` is `EN_INVESTIGACION`/`ANALISIS_COMPLETADO`/`EN_EJECUCION`, hidden when `CERRADO`/`VERIFICADO`; submit calls `useCreateQEAccion(qeId)`.
- [x] 7.3 Implement per-row transition buttons: `PENDIENTE` → "Iniciar" (`useUpdateQEAccion`/status to `EN_EJECUCION`); `EN_EJECUCION` → "Cerrar con evidencia" (opens close modal); `CERRADA` → no button.
- [x] 7.4 Implement the close-with-evidence modal (`descripcionEvidencia` required textarea, `evidenciaUrl` optional URL input) calling `useCerrarQEAccion(qeId)`, with a Zod validation error blocking submit when `descripcionEvidencia` is empty.
- [x] 7.5 Add i18n keys under `qualityEvents.detail.acSection.*` in both locale files.

## 8. QEAuditTrail

- [x] 8.1 Create `src/features/quality-events/components/QEAuditTrail.tsx`: fetch via `useQEAuditTrail(qeId)`, render entries most-recent-first with a `lucide-react` icon per `accion` type, `realizadoPorNombre`, a human-readable action description, `dd/mm/yyyy HH:mm` timestamp (`Intl.DateTimeFormat`), and a "Generado por IA" badge when `generadoPorIA` is true.
- [x] 8.2 Add i18n keys under `qualityEvents.detail.auditTrail.*` in both locale files.

## 9. QualityEventDetail page and routing

- [x] 9.1 Create `src/features/quality-events/pages/QualityEventDetail.tsx`: read `id` via `useParams`, load with `useQualityEvent(id)`, render the four sections stacked vertically in order (`QEHeaderSection`, `QEInvestigationSection`, `QEACSection`, `QEAuditTrail`), with a per-section skeleton while loading and a 404 illustrated state with a "Volver al listado" button on error.
- [x] 9.2 Export `QualityEventDetail` from `src/features/quality-events/index.ts`.
- [x] 9.3 In `src/router/index.tsx`, add `{ path: ':id', element: <QualityEventDetail /> }` under the `quality-events` segment, positioned after the `nuevo` route, wrapped in the existing all-roles `RoleGuard` used for `/quality-events`.
- [x] 9.4 Add i18n keys under `qualityEvents.detail.notFound.*` in both locale files.

## 10. ACSection cross-link (M2)

- [x] 10.1 In `src/features/nonconformities/components/ACSection.tsx`, render a "Ver QE → {numero}" link on AC rows where `ac.qeId` is set, navigating to `/quality-events/{ac.qeId}` (resolve `numero` via the QE fixtures/list data already available to the page, or display the raw `qeId` if a `numero` lookup isn't wired yet).
- [x] 10.2 Add the corresponding i18n key (`nonconformities.acSection.verQE` or similar) in both locale files.

## 11. Verification

- [x] 11.1 Run the project's typecheck/build and fix any type errors introduced by the `AccionCorrectivaQE` shape change or new `qeId` fields.
- [x] 11.2 Run existing test suites (`qualityEventPermissions.test.ts`, `qualityEventTransitions.test.ts`, `qualityEventHelpers.test.ts`, `useTransitionQEStatus.test.ts`) to confirm no regressions from the type change.
- [x] 11.3 Add at least one unit test for `QEACSection`'s evidence-required close validation and one for `QEStatusTransitionPanel`'s RN-QE-002/RN-QE-003 disabled-button guards.
- [x] 11.4 Manually exercise the golden path in the browser (MSW dev server): open a QE from the list, switch investigation tools, approve causa raíz with PIN 1234, create and close an AC, confirm the transition button re-enables, and confirm the audit trail updates — in both light and dark mode.
- [x] 11.5 Manually verify `/quality-events/id-inexistente` renders the 404 state with a working "Volver al listado" button.
