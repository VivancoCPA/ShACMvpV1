## Why

Browser verification of the Jefe de Calidad dashboard (M5-S05a, still open/unarchived) found that the 9 KPIs implemented in M5-S01 (`kpi.constants.ts`, `dashboard.handlers.ts`) do not match the real PRD (SHAC-PRD-003 §5.2), which is now available. M5-S01's own `design.md` explicitly flagged its 9 KPIs as an unverified business assumption and named this exact follow-up (`m5-s01-fix-kpis-prd`) to reconcile against the PRD once available. Names, formulas, units, and metas must be replaced. This must land before M5-S05a is archived, since `JefeCalidadDashboard`/`KpiGridWidget` (built in M5-S05a) are the only real UI consumer of `KPI_DEFINITIONS` today and must display the corrected KPIs, not the invented ones.

## What Changes

- Replace all 9 `KPI_DEFINITIONS` entries (`kpi.constants.ts`) with the PRD's real names, formulas, units, metas, and frequencies.
- Add a `metaTipo: 'ABSOLUTO' | 'REDUCCION_INTERANUAL'` discriminant to `KpiDefinition`/`KpiResult` — **BREAKING** shape change to `kpi.types.ts` — because KPI-04's meta is a relative year-over-year reduction target (≥10%), not an absolute threshold; `KpiResult` gains an optional prior-year-comparison value used only for `REDUCCION_INTERANUAL` KPIs.
- Add an optional `distribucion?: { area: string; valor: number }[]` field to `KpiResult` and a 4th semaforo value `'INFORMATIVO'` — because KPI-09 ("NCs por área") is a ranked breakdown by area, not a single value judged against a pass/fail meta like the other 8.
- Rewrite all 9 `calcularKpiXX` formula functions in `dashboard.handlers.ts` to match the PRD formulas, switching KPI-02/KPI-07 from calendar-day to business-day math (`contarDiasHabiles`), and add a non-generic semaforo rule for KPI-08 (band: 0/≤3/>3) since its meta isn't a single value ± deviation.
- Add a new standalone fixture for KPI-04's year-over-year comparison (mock data only spans Jan–Jul 2026, no prior year).
- Fix `KpiGridWidget.tsx`'s dark-mode left-border rendering bug (same Tailwind specificity issue already fixed in `SemaforoRow`), and add KPI-04 (meta-as-text) and KPI-09 (distribution list) rendering branches.
- Re-evaluate `SUPERVISOR_KPI_IDS` (which KPI subset `SupervisorDashboardData.kpisArea` shows) against the corrected KPI meanings.
- KPI-01's "en plazo" cutoff is now a per-severity sum (`PLAZO_MAXIMO_QE_DIAS_HABILES`: BAJA=22, MEDIA=17, ALTA=14, CRITICA=10 días hábiles) derived from SHAC-PRD-003 §1.3's per-state SLA table, replacing the earlier flat 15-business-day placeholder — documented as an interpretation (summing per-state budgets), not literal PRD text, in `design.md` decisión 6.
- KPI-07's "fecha de análisis completado" is now the `timestamp` of the QE's `auditTrail` entry for the transition into `ANALISIS_COMPLETADO` (`accion === 'ESTADO_CAMBIADO'`, `estadoNuevo === 'ANALISIS_COMPLETADO'`), not the `causaRaizFirmadaEn` proxy used earlier — `ANALISIS_COMPLETADO` is its own state per SHAC-PRD-003 §1.3 and every transition is timestamped in `auditTrail` per `RN-QE-001`, so no proxy is needed (`design.md` decisión 5).
- Document, as an explicit assumption open to future correction: KPI-05's use of the parent QE/NC's `resultadoVerificacion` as a proxy for AC-level verification result (no AC entity has its own verification field; Incidente-origin ACs are excluded from KPI-05 entirely since `Incidente` has no verification concept at all).

## Capabilities

### Modified Capabilities
- `dashboard-types`: `KpiDefinition`/`KpiResult` gain `metaTipo` and optional `distribucion`/prior-year-comparison fields; `KPI_DEFINITIONS` content (names/formulas/units/metas) is fully replaced to match SHAC-PRD-003 §5.2 instead of the M5-S01 placeholder assumptions.
- `dashboard-msw-handlers`: all 9 `calcularKpiXX` formulas are rewritten; semaforo calculation gains special-case rules for KPI-04 (interannual reduction) and KPI-08 (band, not ±20% deviation); `SUPERVISOR_KPI_IDS` is re-evaluated.
- `dashboard-jefecalidad-view`: `KpiGridWidget`'s KPI card rendering is corrected (dark-mode border fix, KPI-04 meta-as-text, KPI-09 distribution list) — note this capability was introduced by the still-unarchived `m5-s05a-dashboard-jefecalidad` change, not yet present under `openspec/specs/`; this delta should be reconciled into that change's spec (or applied after it, before either is archived) rather than synced independently.

## Impact

- `src/features/dashboard/types/kpi.types.ts`, `src/features/dashboard/constants/kpi.constants.ts`
- `src/mocks/handlers/dashboard.handlers.ts`, `src/mocks/handlers/dashboard.handlers.test.ts`
- `src/mocks/fixtures/` — new fixture for KPI-04 year-over-year comparison values
- `src/features/dashboard/components/KpiGridWidget.tsx`, `KpiGridWidget.test.tsx`
- `src/i18n/es-PE.json`, `src/i18n/en-US.json` (`dashboard.jefeCalidad.kpis` namespace)
- No changes to M1-M4/M6 modules. No changes to `routing`/`RoleGuard` (RBAC unaffected).
- Sequencing: should be applied and merged into `m5-s05a-dashboard-jefecalidad`'s scope (or applied immediately after it, before archival) since both touch `KpiGridWidget`/`dashboard-jefecalidad-view` concurrently.
