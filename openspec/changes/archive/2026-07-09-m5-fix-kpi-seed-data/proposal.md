## Why

Browser verification of `JefeCalidadDashboard` (jefe.calidad@shac.pe) shows KPI-01, KPI-02, KPI-03, KPI-05, and KPI-07 stuck at `0`, blocking the archival of `m5-s05a-dashboard-jefecalidad`. The root cause is not missing fields in general — it is that `calcularKpis` in `dashboard.handlers.ts` always evaluates against `currentPeriodo()` (the real current calendar month/quarter), and none of the `quality-events.fixtures.ts` records that carry the data these five formulas read (`fechaCierre` on CERRADO/VERIFICADO QEs, an `ANALISIS_COMPLETADO` audit-trail timestamp, and a verified Acción Correctiva with a populated `resultadoVerificacion`) fall inside the current period window. The other four KPIs (04, 06, 08, 09) don't depend on a closure/verification event landing in the current period, so they already compute real values.

## What Changes

- Re-date a small, representative subset of existing `quality-events.fixtures.ts` records (no new fixtures added, no fixture removed) so their closure/reincidence/verification data lands inside the current KPI period, producing a realistic mix of good and bad outcomes instead of `0` or `100%`:
  - `qe-2026-004`: shift its full lifecycle timeline so `fechaCierre` falls in the current month, business days from `fechaHoraReporte` to `fechaCierre` stay within the BAJA plazo (22 días hábiles) → contributes an "en plazo" case to KPI-01/02.
  - `qe-2026-009`: shift its timeline so `fechaCierre` falls in the current month well past the BAJA plazo → contributes a "fuera de plazo" case to KPI-01/02, and gains a new `ANALISIS_COMPLETADO` audit-trail entry timestamped in the current month → gives KPI-07 a data point.
  - `qe-2026-015`: promote from `PENDIENTE_CIERRE` to `CERRADO` with `fechaCierre` in the current month (its `ciclo: 2` is already set) → gives KPI-03 a non-zero reincidence numerator, and adds a second "fuera de plazo" case (ALTA plazo, 10 días hábiles) to KPI-01/02.
  - `qe-2026-004` and `qe-2026-017`: add entries to the `qeAccionesCorrectivas` seed map (`estado: 'CERRADA'`) and populate `fechaVerificacionRealizada` in the current month, giving KPI-05 one `EFECTIVO` and one `NO_EFECTIVO` verified AC (qe-2026-017 already carries `resultadoVerificacion: 'NO_EFECTIVO'` from its ciclo-1 failure narrative; qe-2026-004 already carries `EFECTIVO`).
- No changes to KPI calculation code, types, or MSW handlers — this is a seed-data-only fix.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `quality-event-msw-fixtures`: add a requirement that a representative subset of CERRADO/VERIFICADO fixtures carries period-anchored closure, reincidence, and verification data (relative to a reference "current period" date) so that period-scoped KPI formulas (KPI-01, KPI-02, KPI-03, KPI-05, KPI-07) are computable and non-trivial from the static fixture set.

## Impact

- `shc-controldoc/src/mocks/fixtures/quality-events.fixtures.ts` — the only file touched.
- No API, type, or handler changes. `dashboard.handlers.ts` formulas are read-only inputs to this change; they are not modified.
- Verification: browser check as `jefe.calidad@shac.pe` on `/dashboard`, confirming all 9 KPI tiles render non-trivial values.
- Maintenance note (documented in design.md, not a task of this change): because `calcularKpis` always uses the real current month, this fix will need another date bump once the real calendar month advances past the anchor used here — the same maintenance burden that already exists for `kpi04AnioAnteriorFixtures`/`horasTrabajadasFixtures`.
