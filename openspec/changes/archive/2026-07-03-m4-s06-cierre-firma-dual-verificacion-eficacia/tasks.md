## 1. Types

- [x] 1.1 In `qualityEvent.types.ts`, add `fechaCierre?: string`, `cierreFirmaSupervisorRol?: 'SUPERVISOR' | 'ALTA_DIRECCION'`, and `evidenciaVerificacion?: string` to `QualityEvent`.
- [x] 1.2 In `utils/qualityEventTransitions.ts`, change the `REABIERTO` entry of the transition map from `['EN_EJECUCION']` to `['EN_INVESTIGACION']`.
- [x] 1.3 Update `utils/__tests__/qualityEventTransitions.test.ts`'s `REABIERTO` scenario to assert `['EN_INVESTIGACION']`.

## 2. Schemas

- [x] 2.1 Replace `qualityEventCierreSchema` in `schemas/qualityEventCierre.schema.ts` with `qualityEventCierreFormSchema` (`resultadoCierre` 100–500 chars, `plazoVerificacionDias` positive int default 60) and export `QualityEventCierreFormInput`.
- [x] 2.2 Rewrite `schemas/__tests__/qualityEventCierre.schema.test.ts` against the new `qualityEventCierreFormSchema` shape (drop `cerradoPorId`/`cierreFirmaSupervisorId` cases).
- [x] 2.3 Add `schemas/firmarCierre.schema.ts` exporting `firmarCierreSchema` (`rol` enum, `pin` length-4 string) and `FirmarCierreInput`, with a matching test file.
- [x] 2.4 Add `schemas/verificacionEficacia.schema.ts` exporting `verificacionEficaciaSchema` (`resultado` enum, `evidencia` non-empty trimmed string) and `VerificacionEficaciaInput`, with a matching test file.

## 3. Permissions & helpers

- [x] 3.1 In `utils/qualityEventPermissions.ts`, update the `ALTA_DIRECCION` branch to return `puedeFirmarCierre: estado === 'PENDIENTE_CIERRE' && esResponsable` and `soloLectura: !puedeFirmarCierre`.
- [x] 3.2 Update the `JEFE_CALIDAD_SYST` branch to add `puedeVerificar: estado === 'EN_VERIFICACION'`.
- [x] 3.3 Add `resolveRolSegundaFirma(primerFirmanteId: string, areaAfectada: string): 'SUPERVISOR' | 'ALTA_DIRECCION'` to `qualityEventPermissions.ts`, looking up the user via `userFixtures`.
- [x] 3.4 Extend `utils/__tests__/qualityEventPermissions.test.ts` with cases for the new `ALTA_DIRECCION`/`JEFE_CALIDAD_SYST` flags and `resolveRolSegundaFirma` (including a synthetic two-hatted user for the escalation case).

## 4. MSW handlers

- [x] 4.1 Add `PATCH /api/quality-events/:id/cerrar` to `quality-events.handlers.ts`: validates `estado === 'PENDIENTE_CIERRE'`, sets `resultadoCierre`/`plazoVerificacionDias`, appends `CIERRE_INICIADO` audit entry.
- [x] 4.2 Add `PATCH /api/quality-events/:id/firmar-cierre`: enforces signature order (QE-AC-006 on violation), sets `cerradoPorId` on first signature, sets `cierreFirmaSupervisorId`/`cierreFirmaSupervisorRol` + transitions to `CERRADO` + stamps `fechaCierre`/`fechaVerificacionProgramada` on second signature.
- [x] 4.3 Add `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`: branches on `estado` (`CERRADO` → `EN_VERIFICACION`; `EN_VERIFICACION` → reapertura with `ciclo++`, `estado: 'EN_INVESTIGACION'`, motive `VENCIMIENTO_PLAZO`; otherwise 422).
- [x] 4.4 Add `POST /api/quality-events/:id/verificacion-eficacia`: validates `estado === 'EN_VERIFICACION'` and non-empty `evidencia`; `EFECTIVO` → `VERIFICADO`; `NO_EFECTIVO` → reapertura with `ciclo++`, `estado: 'EN_INVESTIGACION'`, motive `NO_EFECTIVO`.
- [x] 4.5 Extend the existing `PATCH /:id/acciones-correctivas/:acId/status` handler: after closing an AC, if the QE is `EN_EJECUCION` and every AC is now `CERRADA` with evidence, also transition the QE to `PENDIENTE_CIERRE` and append a `TRANSICION_AUTOMATICA` audit entry in the same response.

## 5. API client & hooks

- [x] 5.1 Add `cerrarQE`, `firmarCierre`, `forzarVencimientoVerificacion`, `registrarVerificacionEficacia` functions to `api/quality-events.api.ts`.
- [x] 5.2 Add `useCerrarQE`, `useFirmarCierre`, `useForzarVencimientoVerificacion`, `useVerificacionEficacia` mutation hooks under `hooks/`, following the `useTransitionQEStatus.ts` pattern (invalidate `QE_QUERY_KEYS.detail(id)` and the list query on success; `toast.error` on failure).
- [x] 5.3 Export the new hooks and schemas from `features/quality-events/index.ts`.

## 6. QECierreSection component

- [x] 6.1 Create `components/QECierreSection.tsx`: renders `null` outside `PENDIENTE_CIERRE`/`CERRADO`/later states.
- [x] 6.2 Implement the closure form (react-hook-form + `qualityEventCierreFormSchema`) visible to `JEFE_CALIDAD_SYST` while `resultadoCierre` is unset; wire to `useCerrarQE`.
- [x] 6.3 Implement the first-signature button + PIN modal (reuse the `PinModal` pattern from `QEInvestigationSection`) wired to `useFirmarCierre({ rol: 'JEFE_CALIDAD_SYST' })`.
- [x] 6.4 Implement the second-signature button using `resolveRolSegundaFirma` to pick the label/role/visibility, wired to `useFirmarCierre({ rol: resolvedRole })`.
- [x] 6.5 Implement the `CERRADO` summary block (resultado, plazo, fecha de cierre).
- [x] 6.6 On successful `CERRADO` transition, show the closure toast plus the conditional Gerencia/reportante notification toasts.

## 7. QEVerificacionSection component

- [x] 7.1 Create `components/QEVerificacionSection.tsx`: renders `null` outside `CERRADO`/`EN_VERIFICACION`/`VERIFICADO`.
- [x] 7.2 Implement the dev-only "Forzar vencimiento" button (gated by `import.meta.env.DEV`) visible in both `CERRADO` and `EN_VERIFICACION`, wired to `useForzarVencimientoVerificacion`.
- [x] 7.3 Implement the REG-EFEC-001 form (react-hook-form + `verificacionEficaciaSchema`) visible to `JEFE_CALIDAD_SYST` or `AUDITOR_INTERNO` (when `esResponsable`), wired to `useVerificacionEficacia`.
- [x] 7.4 Implement the `VERIFICADO` summary block and the reapertura/escalation toasts (EFECTIVO vs NO_EFECTIVO vs forced vencimiento).

## 8. QEStatusTransitionPanel and QEHeaderSection updates

- [x] 8.1 In `QEStatusTransitionPanel.tsx`, remove the `CERRADO` disabled-stub branch and filter `validTargets` to exclude `CERRADO`, `EN_VERIFICACION`, `VERIFICADO`, `REABIERTO` entirely.
- [x] 8.2 Simplify `permissionKeyForTarget` accordingly (only `puedeAvanzarEstado` targets remain generically handled).
- [x] 8.3 Update `QEStatusTransitionPanel.test.tsx` to assert no button renders for the excluded targets, replacing the old disabled-stub assertions.
- [x] 8.4 In `QEHeaderSection.tsx`, add the closure/verification display block (fechaCierre, resultadoCierre, plazoVerificacionDias, countdown to fechaVerificacionProgramada with a "Vencido" fallback) rendered only when `qe.fechaCierre` is set.
- [x] 8.5 Add the informational 5-business-day plazo badge in `QEHeaderSection` for `estado === 'PENDIENTE_CIERRE'`.

## 9. QEACSection notification

- [x] 9.1 In `QEACSection.tsx`'s close-AC mutation `onSuccess`, compare the pre-mutation `qe.estado` against the response's `estado`; if it changed to `PENDIENTE_CIERRE` and the current role is `JEFE_CALIDAD_SYST`/`SUPERVISOR`, show a `toast.info`.
- [x] 9.2 Extend `QEACSection.test.tsx` with a case covering the auto-transition toast and a case confirming it's suppressed for other roles.

## 10. Page composition

- [x] 10.1 In `pages/QualityEventDetail.tsx`, insert `QECierreSection` and `QEVerificacionSection` between `QEACSection` and `QEAuditTrail`.
- [x] 10.2 Verify (manually or via a page-level test) that `ABIERTO`–`EN_EJECUCION` QEs render unchanged (both new sections render nothing).

## 11. i18n

- [x] 11.1 Add `qualityEvents` keys for `QECierreSection` (form labels, signature buttons, PIN modal copy, summary labels, QE-AC-006 error message) to `es-PE.json` and `en-US.json`.
- [x] 11.2 Add `qualityEvents` keys for `QEVerificacionSection` (REG-EFEC-001 form labels, dev-only button, summary, notification toasts) to both locale files.

## 12. Verification

- [x] 12.1 Run the full unit/component test suite and fix any regressions surfaced by the `REABIERTO` transition-map change or the `qualityEventCierreSchema` removal.
- [x] 12.2 Manually exercise the full flow in the running app with MSW: EN_EJECUCION → close all ACs → PENDIENTE_CIERRE → fill closure form → sign twice (including forcing the same-user escalation with a temporarily edited fixture) → CERRADO → force vencimiento → EN_VERIFICACION → submit REG-EFEC-001 with NO_EFECTIVO → confirm reapertura to EN_INVESTIGACION with `ciclo` incremented and prior history intact; repeat ending in EFECTIVO → VERIFICADO.
