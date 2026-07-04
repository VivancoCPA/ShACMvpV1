## 1. Permissions layer (RN-QE-010/011/012)

- [x] 1.1 Add `ventanaReporteInicialAbierta(qe, ahora)` to `src/features/quality-events/utils/qualityEventPermissions.ts`
- [x] 1.2 Add non-exported `resolveQEEditAccess(qe, usuario, ahora = new Date())` combining RN-QE-010/011/012 into `{ reporteInicial, severidad, mineral }`, and export it (list/form/modal all need the breakdown, not just the boolean)
- [x] 1.3 Add `puedeEditarQE(qe, usuario, ahora = new Date())` as a thin wrapper returning the OR of the three flags
- [x] 1.4 Unit tests: `ventanaReporteInicialAbierta`, `resolveQEEditAccess` (creator, area Supervisor, non-matching Supervisor, JEFE_CALIDAD_SYST per state, tipo gating for mineral, double-role case), and `puedeEditarQE`

## 2. Schemas

- [x] 2.1 Create `qualityEventEditReporteInicial.schema.ts` (`.strict()`, RN-QE-010 field set + origin-specific fields, export `QualityEventEditReporteInicialInput`)
- [x] 2.2 Create `qualityEventEditSeveridad.schema.ts` (`.strict()`, `severidad` only)
- [x] 2.3 Create `qualityEventEditMineral.schema.ts` (`.strict()`, `mineralInvolucrado` only)
- [x] 2.4 Unit tests for all three schemas, including rejection of protected/extra fields

## 3. MSW handlers

- [x] 3.1 Add `PATCH /api/quality-events/:id/editar-reporte-inicial`: 404 on unknown id, re-derive `resolveQEEditAccess(...).reporteInicial` server-side (reuse `ventanaReporteInicialAbierta` — do not reimplement the window check), 422 on failed access or on any protected-field key present in the body, update only changed fields, append one `QE_REPORTE_INICIAL_EDITADO` audit entry per changed field
- [x] 3.2 Add `PATCH /api/quality-events/:id/editar-severidad`: 404 on unknown id, 422 for non-`JEFE_CALIDAD_SYST` or `estado` in `{CERRADO, EN_VERIFICACION, VERIFICADO}`, update `severidad`, append `QE_SEVERIDAD_EDITADA` audit entry, surface the CRITICA-transition notification flag
- [x] 3.3 Add `PATCH /api/quality-events/:id/editar-mineral`: 404 on unknown id, 422 for non-`JEFE_CALIDAD_SYST`, disallowed `estado`, or `tipo` outside `{CALIDAD, OPERACIONAL}`, update `mineralInvolucrado`, append `QE_MINERAL_EDITADO` audit entry
- [x] 3.4 Register all three handlers in `quality-events.handlers.ts` and confirm `handlers/index.ts` still spreads the full array
- [x] 3.5 Handler tests covering every scenario in `quality-event-msw-handlers`'s delta spec

## 4. API client and hooks

- [x] 4.1 Add `editarReporteInicial`, `editarSeveridad`, `editarMineral` methods to `quality-events.api.ts`
- [x] 4.2 Add `useEditarReporteInicial`, `useEditarSeveridad`, `useEditarMineral` mutation hooks, each invalidating the QE detail and list query keys on success

## 5. QualityEventForm edit mode

- [x] 5.1 Add route `/quality-events/:id/editar`, loading the QE via `useQualityEvent(id)` and gating on `resolveQEEditAccess(qe, usuario).reporteInicial` (redirect to `/quality-events/:id` otherwise)
- [x] 5.2 Extend `QualityEventForm` with an edit-mode path: `defaultValues` from the loaded QE, protected fields (`numero`, `origen`, `tipo`, `fechaHoraReporte`, reporter name) rendered as read-only text (not disabled inputs)
- [x] 5.3 Keep RN-QE-010 field set editable (`descripcion`, `areaAfectada`, `turno`, `fechaHoraEvento`, `mineralInvolucrado`, origin-specific field for the QE's existing `origen`); conditionally render `severidad` only when `resolveQEEditAccess(...).severidad` is also true
- [x] 5.4 Wire submit to `useEditarReporteInicial`, diff-computing which fields changed before building the request payload; navigate to `/quality-events/:id` on success
- [x] 5.5 Component tests: pre-fill, read-only protected fields, double-role severidad unlock, diffed submit payload, navigation on success

## 6. QEEditSeveridadMineralModal

- [x] 6.1 Create `QEEditSeveridadMineralModal.tsx`: render `severidad` select when `access.severidad`, `mineralInvolucrado` select when `access.mineral`, both defaulting to current QE values
- [x] 6.2 CRITICA re-notification banner when the selected `severidad` is `'CRITICA'` and differs from the QE's current value
- [x] 6.3 Submit logic: call `useEditarSeveridad` then `useEditarMineral` sequentially, only for fields that actually changed; disable submit when nothing changed
- [x] 6.4 Cancel discards changes without mutating; success closes the modal, shows one toast, and invalidates detail/list queries
- [x] 6.5 Component tests covering all `access` combinations and the sequential-mutation ordering

## 7. QualityEventList Acciones column

- [x] 7.1 Replace the `puedeEditarCabecera`-based Editar-icon gate with `puedeEditarQE(qe, usuario)`
- [x] 7.2 Route the icon's click handler using `resolveQEEditAccess(qe, usuario)`: navigate to `/quality-events/:id/editar` when `reporteInicial` is true, otherwise open `QEEditSeveridadMineralModal`
- [x] 7.3 Confirm exactly one icon renders per row regardless of how many access flags are true (no duplicate icons for the double-role case)
- [x] 7.4 Update/extend existing list tests: OPERARIO never sees the icon, no-access row omits it entirely (no disabled/tooltip state), each routing scenario from the delta spec

## 8. Audit trail rendering

- [x] 8.1 Extend `QEAuditTrail`'s accion→icon mapping with `QE_REPORTE_INICIAL_EDITADO`, `QE_SEVERIDAD_EDITADA`, `QE_MINERAL_EDITADO`, each with a distinct icon
- [x] 8.2 Build the diff description (`campoModificado`/`valorAnterior`/`valorNuevo`) for each of the three accion types
- [x] 8.3 Component tests for the three new entry renderings

## 9. i18n

- [x] 9.1 Add `qualityEvents` keys (es-PE and en-US) for: the Editar icon's `aria-label`/`title`, the edit-mode form title/breadcrumb, `QEEditSeveridadMineralModal` labels and the CRITICA banner text, and the audit-trail diff descriptions

## 10. Cross-cutting verification

- [x] 10.1 Confirm no changes to `getValidQETransitions`, `puedeEditarCabecera`, or any other existing `QEPermissions` flag
- [x] 10.2 Confirm dark-mode styling on the new modal and the read-only edit-mode fields
- [x] 10.3 Manually verify all 9 acceptance criteria from the proposal end-to-end against MSW fixtures (creator window, expired window, Supervisor path, JEFE_CALIDAD_SYST severidad/mineral edit + CRITICA notification, audit trail immutability, OPERARIO has no icon, direct-payload manipulation of protected fields is rejected, double-role single-icon/single-form case)

## 11. Bug fixes — Supervisor `areasAsignadas` model (post-implementation)

- [x] 11.1 Add `areasAsignadas?: string[]` to `User` (`src/types/auth.types.ts`) — relevant only for `rol === 'SUPERVISOR'`, subset of `AREAS_SHAC`
- [x] 11.2 Add `areasAsignadas` to `MockUser` (`src/mocks/fixtures/auth.fixtures.ts`); assign `supervisor@shac.pe` two areas and add a second Supervisor mock user with a different area for negative-case testing
- [x] 11.3 Fix `resolveQEEditAccess`'s RN-QE-010 Supervisor check to use `(usuario.areasAsignadas ?? []).includes(qe.areaAfectada)` instead of `usuario.area === qe.areaAfectada`; narrow the `usuario` Pick type accordingly (`'id' | 'rol' | 'areasAsignadas'`, dropping `'area'`)
- [x] 11.4 Update `getCurrentUserForEditAccess` in `quality-events.handlers.ts` to forward `areasAsignadas` instead of `area`
- [x] 11.5 Unit/component tests: Supervisor with the QE's area in `areasAsignadas` (true), Supervisor with a non-matching `areasAsignadas` even when `area` coincidentally matches (false), Supervisor with no `areasAsignadas` at all (false)
- [x] 11.6 Confirm the double-role union behavior (creator/Supervisor AND JEFE_CALIDAD_SYST) still yields the single combined full-form edit view — no regression from the Pick-type narrowing
