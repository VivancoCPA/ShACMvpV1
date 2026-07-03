## Context

M4-S05 (archived) shipped `QualityEventDetail` with `QEHeaderSection`, `QEInvestigationSection`, `QEACSection`, `QEAuditTrail`, and a `QEStatusTransitionPanel` whose `CERRADO` button is an explicit, disabled stub labeled "Disponible en cierre" pending this spec. The permission helpers (`getQualityEventPermissions`, `validateTransitionToCerrado`, `validateTransitionToPendienteCierre`) and several `QualityEvent` fields (`resultadoCierre`, `cerradoPorId`, `cierreFirmaSupervisorId`, `plazoVerificacionDias`, `fechaVerificacionProgramada`, `fechaVerificacionRealizada`, `verificadoPorId`, `resultadoVerificacion`) were already scaffolded in anticipation of this work but have no UI or MSW wiring. There is no real backend (.NET 10 API does not exist yet); all persistence is an in-memory `qeStore` array inside MSW v2 handlers, and there is no cron — any time-based transition must be simulated with a dev-only control.

The mock `User` model (`src/types/auth.types.ts`) assigns exactly one `rol` and one `area` per user; none of the 6 fixture users currently hold two roles. The "same person is both first signer and area supervisor" edge case in RN-QE-004 is therefore unreachable with current fixtures, but the rule must still be implemented generically and verified with a synthetic user in unit tests.

## Goals / Non-Goals

**Goals:**
- Make `PENDIENTE_CIERRE → CERRADO → EN_VERIFICACION → VERIFICADO | REABIERTO` fully reachable and testable end-to-end in the mocked frontend.
- Reuse established M4-S05 patterns: the PIN-modal component shape from `QEInvestigationSection`, the `QEAuditTrailEntry` append pattern, the `useXQualityEvent`-style mutation hooks, and the `getQualityEventPermissions`/`esResponsable` overload convention.
- Keep the change additive to already-shipped, tested code wherever possible; where a conflict exists (the `REABIERTO` transition target, the shape of `qualityEventCierreSchema`), resolve it explicitly rather than silently.

**Non-Goals:**
- Real email/push notifications — "notify Gerencia/Supervisor" means an in-app Sonner toast, matching the existing `requiereNotificacionUrgente` (RN-QE-005) predicate-only pattern; no notification center exists in this codebase.
- PDF export of the closed QE (deferred to M4-S07 per the proposal).
- A real cron/scheduler for plazo vencido — simulated with a dev-only ("Forzar vencimiento") button gated by `import.meta.env.DEV`.
- Multi-role users — the "same user" signature-escalation rule is implemented generically but cannot be exercised with the current 6-user fixture set; a synthetic user is used only in unit tests.

## Decisions

### 1. `REABIERTO` is never a persisted `qe.estado`; reapertura writes `estado: 'EN_INVESTIGACION'` directly
`getValidQETransitions('REABIERTO')` currently returns `['EN_EJECUCION']`, implying a QE rests in `REABIERTO` and is manually advanced straight into execution — skipping root-cause re-analysis. That contradicts RN-QE-007's intent (redo the investigation) and the fact that `causaRaizDefinitiva` is only editable while `estado` is `EN_INVESTIGACION`/`ANALISIS_COMPLETADO`. We change the map entry to `REABIERTO → ['EN_INVESTIGACION']` and make both reapertura triggers (NO_EFECTIVO result, plazo-vencido) set `qe.estado = 'EN_INVESTIGACION'` in the same MSW mutation that increments `ciclo` — `REABIERTO` is never written to `qe.estado`; it only appears as the audit-trail `accion` (`'REABIERTO'`) with a `campoModificado`/message noting the motive (`NO_EFECTIVO` or `VENCIMIENTO_PLAZO`). `QEStatus` keeps the `REABIERTO` literal (existing badge/label/fixture-coverage requirements from M4-S01–S05 already depend on it), it is simply unreachable as a live `estado` going forward.
- **Alternative considered**: keep `estado: 'REABIERTO'` as a resting state and widen its map to `['EN_INVESTIGACION', 'EN_EJECUCION']`. Rejected — adds a manual "which path do I take" decision point with no product requirement asking for it, and complicates `QEStatusTransitionPanel` for a state that's supposed to auto-resolve.

### 2. Split `qualityEventCierreSchema` into three schemas matching the three distinct payloads
The existing `qualityEventCierreSchema` bundles `resultadoCierre`, `plazoVerificacionDias`, `cerradoPorId`, and `cierreFirmaSupervisorId` into one object — but the UI never collects signer IDs as form input; they're derived from the authenticated user at signature time. We replace it with:
- `qualityEventCierreFormSchema` (`resultadoCierre` 100–500 chars, `plazoVerificacionDias` positive int, default 60) — submitted once via `PATCH /:id/cerrar`.
- `firmarCierreSchema` (`rol: z.enum(['JEFE_CALIDAD_SYST','SUPERVISOR','ALTA_DIRECCION'])`, `pin: z.string().length(4)`) — submitted twice via `PATCH /:id/firmar-cierre`.
- `verificacionEficaciaSchema` (`resultado: z.enum(['EFECTIVO','NO_EFECTIVO'])`, `evidencia: z.string().trim().min(1)`, mirroring the non-empty-text rule already used for AC `descripcionEvidencia`) — submitted via `POST /:id/verificacion-eficacia`.
The existing `qualityEventCierre.schema.test.ts` is rewritten against the new shape rather than kept alongside it, since the old schema is deleted, not deprecated.

### 3. Two new sections, not one; both self-gate by `qe.estado` and render `null` otherwise
`QECierreSection` owns `PENDIENTE_CIERRE` (form + dual signature) and the `CERRADO` summary; `QEVerificacionSection` owns `EN_VERIFICACION` (REG-EFEC-001 + dev-only forcing) and the `VERIFICADO` summary. Splitting mirrors the existing one-concern-per-file convention (`QEInvestigationSection`, `QEACSection`) and keeps each file's state matrix small. Both are inserted into `QualityEventDetail` between `QEACSection` and `QEAuditTrail`, and both return `null` for states outside their concern (e.g. `QECierreSection` renders nothing in `ABIERTO`), so earlier states are visually unaffected.

### 4. Dual signature is two calls to one endpoint, not two endpoints
`PATCH /:id/firmar-cierre` is called twice with `{ rol, pin }`. The MSW handler determines which slot is being filled:
- First call must have `rol: 'JEFE_CALIDAD_SYST'` and `qe.resultadoCierre` must already be set (i.e. `/cerrar` ran first) → sets `cerradoPorId`.
- Second call must have `rol` equal to whatever `resolveRolSegundaFirma(cerradoPorId, qe.areaAfectada)` resolves to (`'SUPERVISOR'` normally, `'ALTA_DIRECCION'` if the first signer's own fixture record has `rol: 'SUPERVISOR'` and `area === qe.areaAfectada`) → sets `cierreFirmaSupervisorId` + `cierreFirmaSupervisorRol`, then flips `estado → CERRADO`, stamps `fechaCierre`, and computes `fechaVerificacionProgramada`.
- Any other combination (second slot attempted before the first, wrong role, already-signed slot) returns 422 with the QE-AC-006 message. This single-endpoint design keeps `useFirmarCierre` a single hook the UI calls from either signature button, with the button's `rol` prop supplied by the resolved requirement rather than duplicating logic client-side and server-side.
- **Alternative considered**: two endpoints (`/firmar-cierre-jefe`, `/firmar-cierre-supervisor`). Rejected — the proposal explicitly lists a single `firmar-cierre` endpoint, and a single endpoint keeps the same-user escalation logic in one place (the MSW handler) instead of duplicated across two.

### 5. Auto-transition to `PENDIENTE_CIERRE` lives inside the existing AC-status MSW handler
`PATCH /:id/acciones-correctivas/:acId/status` already recomputes the QE's `accionesCorrectivas` array on every call. We add one check after that recomputation: if `qe.estado === 'EN_EJECUCION'` and every AC is now `CERRADA` with non-empty `descripcionEvidencia`, flip `estado → PENDIENTE_CIERRE` and append a second audit entry in the same response. The client (`QEACSection`'s close-AC mutation) compares the pre-mutation `qe.estado` prop against the response's `estado`; if it changed to `PENDIENTE_CIERRE`, it fires a `toast.info` visible only when the current user's role is `JEFE_CALIDAD_SYST` or `SUPERVISOR`. No polling, no `useEffect`.
- **Alternative considered**: a dedicated `POST /:id/check-cierre` endpoint polled after each AC close. Rejected — adds a network round trip and a place to forget to call it; folding the check into the existing status handler is atomic and can't be skipped.

### 6. `esResponsable` is reused (not renamed) as the second-signature gate for `ALTA_DIRECCION`
`getQualityEventPermissions(estado, rol, esResponsable)` already overloads `esResponsable` to mean "is this specific user the one authorized for this specific contextual action" (SUPERVISOR-cabecera-in-ABIERTO, AUDITOR_INTERNO-verificar). We extend this: for `ALTA_DIRECCION`, `puedeFirmarCierre = estado === 'PENDIENTE_CIERRE' && esResponsable`, where the caller computes `esResponsable` as `resolveRolSegundaFirma(qe.cerradoPorId, qe.areaAfectada) === 'ALTA_DIRECCION'`. This avoids adding a ninth parameter to an already-small pure function and keeps `QEPermissions`'s eight-flag shape unchanged (no delta needed to the `QEPermissions` interface itself).
For `JEFE_CALIDAD_SYST`, we add `puedeVerificar: estado === 'EN_VERIFICACION'` (currently always `false` for this role) so REG-EFEC-001 is reachable by the role the proposal names first.

### 7. One dev-only endpoint, contextual on `estado`, covers both simulated deadlines
The proposal lists a single `PATCH /:id/forzar-vencimiento-verificacion` endpoint and explicitly says requirement 7(b) reuses "the same mechanism" as requirement 5 — so this one endpoint (no body) branches on the QE's current `estado`:
- `CERRADO` → simulates the closure-to-verification deadline passing: sets `fechaVerificacionProgramada` to now (or earlier), flips `estado → EN_VERIFICACION`, and appends an audit entry creating the verification task (notifying `JEFE_CALIDAD_SYST`).
- `EN_VERIFICACION` → simulates the RN-QE-008 10-business-day deadline passing: recomputes as if `estaVencidaVerificacion(qe, new Date())` is `true`, then applies the same vencimiento-reapertura path as a `NO_EFECTIVO` result would (increment `ciclo`, `estado → EN_INVESTIGACION`, audit entry with motive `VENCIMIENTO_PLAZO`).
- Any other `estado` → 422 (nothing to force).
`QECierreSection` renders the button while `estado === 'CERRADO'`; `QEVerificacionSection` renders it while `estado === 'EN_VERIFICACION'`. Both render sites are gated by `import.meta.env.DEV`, so the control never appears in a production build. This keeps all "simulate time passing" logic entirely server-side (MSW), consistent with how the rest of the mock backend has no client-side date mocking.

## Risks / Trade-offs

- **[Risk]** The same-user → `ALTA_DIRECCION` escalation can never be exercised through the seeded 6-user fixture set (each user has exactly one role/area) → **Mitigation**: cover `resolveRolSegundaFirma` with a unit test using a synthetic two-hatted user object; do not block this spec on adding multi-role support to the global `User` type, which is out of scope for the QE module.
- **[Risk]** Deleting/reshaping `qualityEventCierreSchema` breaks the existing `qualityEventCierre.schema.test.ts` → **Mitigation**: rewrite that test file in the same task as the schema change (task list enforces this ordering), not as a follow-up.
- **[Risk]** Changing `getValidQETransitions('REABIERTO')` touches an already-archived, tested capability (`quality-event-types`) → **Mitigation**: the change is additive to the exhaustive `Record<QEStatus, QEStatus[]>` map (one value swapped), covered by updating `utils/__tests__/qualityEventTransitions.test.ts`'s REABIERTO scenario in the same task.
- **[Trade-off]** Folding the `PENDIENTE_CIERRE` auto-transition into the AC-status handler means that handler now has two responsibilities (AC transition + QE transition) → accepted, since MSW handlers in this codebase already do this (e.g. `/:id/acciones-correctivas` POST both creates the AC and appends a QE audit entry).

## Migration Plan

Not applicable — no backend, no data migration. Rollback is a plain revert of the feature branch; the in-memory `qeStore` resets on every page reload regardless.

## Open Questions

None outstanding — the `REABIERTO` transition-target conflict was resolved with the user (see proposal) before this design was written.
