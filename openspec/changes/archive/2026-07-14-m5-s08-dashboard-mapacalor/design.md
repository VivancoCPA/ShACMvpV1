## Context

`IncidentMapCanvas` (`src/features/incidents/components/IncidentMapCanvas.tsx`,
M3-S05) already implements everything the heatmap needs visually: it accepts
`incidentes`, `localId`, `planoPngUrl`, `onGroupClick`, and internally runs
`computeClusters` (exported, radius 5% via `CLUSTER_RADIUS = 5`) and
`getMarkerStyle` (module-private, not exported — irrelevant here since the
widget never calls it directly) to render markers, tooltip, legend, and the
`map.planUnavailable` / `map.noIncidents` empty states with dark-mode classes
already resolved. `useLocales()` filters `activo: true` locales via TanStack
Query. `IncidentMapView.tsx` (M3-S05) is the reference pattern for the local
`<select>`; `TendenciaMensualWidget.tsx` (M5) is the reference pattern for a
self-contained period selector (`RANGOS = [3, 6, 12] as const`, `role="group"`
buttons, `aria-pressed`, default 6).

M5-S08 does not add any new data model, hook, or backend endpoint. It is a
composition layer: a new dashboard widget that filters `useIncidentList()`
by `fechaEvento` and hands the result to `<IncidentMapCanvas>` unmodified.

## Goals / Non-Goals

**Goals:**
- Give Alta Dirección and Jefe de Calidad/SyST a read-only heatmap of
  Incidentes per local, scoped to a widget-local period filter.
- Reuse `IncidentMapCanvas`, `useLocales`, `useIncidentList` exactly as they
  exist today — zero changes to M3-S05 files.
- Surface incidentes excluded from the heatmap (no `ubicacion`) via an
  explicit count badge instead of silent loss.

**Non-Goals:**
- No filtering of KPI-01–KPI-09 or `useDashboardSummary` by the widget's
  local selector (CA-ADD03-10) — the two are fully isolated.
- No cross-local KPI comparison (OBS-ADD03-003, deferred to v2.0).
- No drill-down to an individual incidente or side panel — `onGroupClick`
  is a no-op; that interaction belongs to M3-S05's `IncidentMapView`.
- No additional filters (estado, tipo) beyond local + period.

## Decisions

**Widget owns period filtering, not `IncidentMapCanvas`.** The canvas
component has no concept of a date range — it just clusters whatever
`incidentes` array it receives. The widget filters `useIncidentList()`
results by `fechaEvento` within the last N months (N from its own
`RANGOS` state) before passing the array down. This keeps
`IncidentMapCanvas` untouched, per the proposal's explicit "no reimplementar"
constraint.

**Two independent selector states, no URL/query sync.** Unlike
`IncidentMapView.tsx` (which reads `mapLocalParam` from the route), this
widget has no route of its own — `selectedLocalId` and `selectedRango` are
local `useState` inside `HeatmapIncidentesWidget`, defaulting to
`activeLocales[0]?.id` and `6` respectively. Alternative considered:
lifting state to the dashboard page — rejected because no other dashboard
widget needs it, and it would couple the widget's internal UI state to the
page.

**Exclusion badge computed in the widget, not in `IncidentMapCanvas`.**
`computeClusters` already filters out incidentes without `ubicacion`
(`inc.ubicacion !== undefined`) as part of its clustering pass, but it
doesn't report what it dropped. Rather than modify `computeClusters` to
return excluded counts (which would touch a M3-S05 file), the widget
independently counts `incidentesEnPeriodo.filter(i => !i.ubicacion).length`
on the same period-filtered array before it reaches the canvas. Both counts
are derived from the same filtered array, so they stay consistent by
construction.

**Role gate uses the literal string values already in the codebase.**
`JefeCalidadDashboard.tsx` checks `data.rol === 'JEFE_CALIDAD'` (not
`'JEFE_CALIDAD_SYST'`) and `AltaDireccionDashboard.tsx` checks
`data.rol === 'ALTA_DIRECCION'`. The widget is mounted unconditionally
inside the existing role-gated branch of each page — no new role check is
introduced, it inherits the page's existing gate.

## Risks / Trade-offs

- [Widget-local period filter diverges visually from the dashboard's own
  period, potentially confusing users who expect one global period] →
  Mitigate with a clear label on the widget ("Período del mapa" / distinct
  from any global period control) and CA-ADD03-10-style test coverage
  proving KPI widgets are unaffected.
- [`computeClusters`'s exclusion logic and the widget's badge count could
  drift apart if `computeClusters` internals change later] → Both derive
  from the exact same period-filtered array passed into the same render;
  a unit test asserts badge count + clustered count accounts for all
  incidentes in the filtered set.
- [Large incident volumes across 12 months could make client-side filtering
  noticeably slow] → Out of scope for this spec (same pattern already used
  by `TendenciaMensualWidget` and `IncidentMapView` today); no new
  performance concern introduced.

## Open Questions

None — all decisions from the proposal's §7 were confirmed against the
current codebase (`computeClusters`/`getMarkerStyle` location, `useLocales`
shape, `TendenciaMensualWidget` period pattern, and the exact role string
literals used by each dashboard page).
