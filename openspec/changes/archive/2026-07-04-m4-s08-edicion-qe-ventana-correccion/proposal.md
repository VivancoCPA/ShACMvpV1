## Why

The "Editar" icon in `QualityEventList`'s Acciones column (M4-S03) was never specified or implemented — it does not exist in the current UI, even though the PRD contemplates QE edition with different rules per field. Today a typo in `descripcion` or `areaAfectada` on a freshly reported QE, or a severity/mineral miscoding discovered later, has no correction path short of a manual bitácora note. SHAC-PRD-003-ADD-04 formalizes three distinct edit rules (initial-report correction window, severity edition, mineral edition) that this change consolidates into a single spec so the Acciones icon has a concrete, testable specification.

## What Changes

- New RN-QE-010: a 2-hour correction window for the initial report (`descripcion`, `areaAfectada`, `turno`, `fechaHoraEvento`, `mineralInvolucrado`, and origin-specific O1–O4 fields), open only while `estado === 'ABIERTO'` **and** `fechaHoraReporte` is ≤2h old — both conditions must hold simultaneously, so an early state transition closes the window even before the 2h elapse. Editable by the QE's creator (`reportadoPorId`) or a Supervisor whose `areasAsignadas` includes `areaAfectada`. `numero`, `origen`, `tipo`, `fechaHoraReporte`, and `reportadoPorId` are never editable through this path.
- New `User.areasAsignadas: string[]` field (relevant only for `rol === 'SUPERVISOR'`, subset of `AREAS_SHAC`): the set of areas a Supervisor is assigned to oversee for QE purposes. Distinct from the pre-existing `area` field, which is the user's own home department and is never used for RN-QE-010's Supervisor check. A Supervisor can have more than one assigned area.
- New RN-QE-011: severity edition, restricted to `JEFE_CALIDAD_SYST`, allowed in any state prior to `CERRADO`, with no time limit. Switching to/from `CRITICA` re-triggers the same Gerencia notification as at creation (RN-QE-005), dispatched within ≤2 hours of the edit.
- New RN-QE-012: `mineralInvolucrado` edition, restricted to `JEFE_CALIDAD_SYST`, allowed in any state prior to `CERRADO`, no time limit, and only applicable to QEs of `tipo` `CALIDAD` or `OPERACIONAL`.
- New `puedeEditarQE(qe, usuario)` helper combining RN-QE-010/011/012 into a single visibility decision for the Acciones icon.
- The Acciones column "Editar" icon is now specified: rendered only when `puedeEditarQE` returns `true`, fully absent (not disabled) otherwise. It opens `QualityEventForm` in edit mode for RN-QE-010, a reduced `QEEditSeveridadMineralModal` for RN-QE-011/012, or — for a user who satisfies both simultaneously (e.g., a `JEFE_CALIDAD_SYST` who is also the reporter within the 2h window) — a single combined full-form edit view with every eligible field unlocked at once.
- Every edit path appends an immutable, diffed `QEAuditTrailEntry` (`QE_REPORTE_INICIAL_EDITADO`, `QE_SEVERIDAD_EDITADA`, `QE_MINERAL_EDITADO`).
- Three new MSW endpoints enforce all of the above server-side (role, state, time-window, and protected-field checks), so a direct API/payload manipulation attempt is rejected the same as a UI attempt.

## Capabilities

### New Capabilities
- `quality-event-severidad-mineral-edit`: `QEEditSeveridadMineralModal` component covering the RN-QE-011/012 reduced edit flow (severidad and/or mineralInvolucrado) for `JEFE_CALIDAD_SYST`, including the CRITICA re-notification and its audit trail entries.

### Modified Capabilities
- `quality-event-permissions`: adds RN-QE-010/011/012 and the `puedeEditarQE(qe, usuario)` helper that combines them into the Acciones-icon visibility decision.
- `quality-event-list-view`: the Acciones column "Editar" icon changes from being gated by `puedeEditarCabecera` to being gated by `puedeEditarQE`, is omitted entirely (no disabled/tooltip state) when no rule applies, and resolves to a single icon/flow even for a user who qualifies under multiple rules at once.
- `quality-event-form`: `QualityEventForm` gains an edit mode restricted to the RN-QE-010 field subset (plus the origin-specific O1–O4 fields captured at creation), with `numero`, `origen`, `tipo`, `fechaHoraReporte`, and `reportadoPorId` always read-only, and appends `QE_REPORTE_INICIAL_EDITADO` audit entries with before/after diffs.
- `quality-event-schemas`: adds `qualityEventEditReporteInicialSchema`, `qualityEventEditSeveridadSchema`, and `qualityEventEditMineralSchema`.
- `quality-event-msw-handlers`: adds `PATCH /api/quality-events/:id/editar-reporte-inicial`, `PATCH /api/quality-events/:id/editar-severidad`, and `PATCH /api/quality-events/:id/editar-mineral`, each re-validating role/state/time-window/protected-field rules server-side and appending the matching audit entry.
- `quality-event-audit-trail`: documents the three new `accion` values and their icon/label mapping in the timeline.

## Impact

- `src/types/auth.types.ts`: new `User.areasAsignadas?: string[]` field. `src/mocks/fixtures/auth.fixtures.ts`: assigns `areasAsignadas` to `supervisor@shac.pe` and adds a second Supervisor mock user (`supervisor.almacen@shac.pe`) with a different area, so both the positive and negative RN-QE-010 Supervisor cases are testable via login.
- `src/features/quality-events/utils/qualityEventPermissions.ts` (+ tests): new `puedeEditarQE` helper and its RN-QE-010/011/012 building blocks.
- `src/features/quality-events/components/`: modified `QualityEventList` Acciones column (or its row-actions subcomponent); new `QEEditSeveridadMineralModal.tsx`.
- `src/features/quality-events/pages/QualityEventForm.tsx`: edit-mode support (routed at `/quality-events/:id/editar` or opened as the same component with a `qe` prop, per design.md).
- `src/features/quality-events/schemas/`: three new schema files (+ matching tests).
- `src/mocks/handlers/quality-events.handlers.ts`: three new endpoints.
- `src/features/quality-events/api/quality-events.api.ts` and new hooks (`useEditarReporteInicial`, `useEditarSeveridad`, `useEditarMineral`).
- `src/i18n/es-PE.json`, `src/i18n/en-US.json`: new `qualityEvents` keys for the edit icon, modal, and form-edit-mode copy.
- No backend impact (backend does not exist yet); no changes to other modules (M1–M3, M5, M6); does not alter `getValidQETransitions` or the QE state machine.
