## Why

Alta Dirección y Jefe de Calidad/SyST necesitan ver dónde se concentran los
Incidentes dentro de cada local (patios, almacenes) para priorizar
inspecciones y acciones preventivas, pero hoy esa distribución espacial solo
es visible incidente por incidente en la vista Mapa de `IncidentList` (M3-S05)
— no existe una vista agregada a nivel dashboard. `IncidentMapCanvas` (M3-S05)
ya resuelve clustering, marcadores y tooltip; falta únicamente exponerlo como
widget de solo lectura en los dashboards ejecutivos, con su propio filtro de
local y período.

## What Changes

- Nuevo widget `HeatmapIncidentesWidget` en `features/dashboard/components/`
  que reutiliza `<IncidentMapCanvas>` (M3-S05) sin modificarlo: selector de
  local (patrón de `IncidentMapView.tsx`), selector de período propio
  (`RANGOS = [3, 6, 12]`, patrón de `TendenciaMensualWidget.tsx`, default 6
  meses), y badge de conteo de incidentes sin `ubicacion` en el período.
- Filtra `useIncidentList()` por `fechaEvento` dentro del rango de meses
  seleccionado antes de pasar el array a `<IncidentMapCanvas>`. Sin hook de
  agregación nuevo.
- `onGroupClick={() => {}}` — sin drill-down a incidente individual (ese
  comportamiento pertenece a M3-S05, no a este widget).
- Montaje del widget:
  - `JefeCalidadDashboard.tsx`: después de `<TendenciaMensualWidget>`, visible
    solo cuando `data.rol === 'JEFE_CALIDAD'`.
  - `AltaDireccionDashboard.tsx`: después de `<ACsExtensionPlazoWidget>`,
    visible solo cuando `data.rol === 'ALTA_DIRECCION'`.
- El selector de local del widget es aislado: no filtra ni recalcula
  KPI-01 a KPI-09 ni `useDashboardSummary`.

## Capabilities

### New Capabilities
- `dashboard-heatmap-incidentes`: widget de mapa de calor de Incidentes por
  local en los dashboards de Alta Dirección y Jefe de Calidad/SyST —
  selector de local, selector de período propio, badge de incidentes sin
  ubicación, y reutilización de `IncidentMapCanvas` en modo solo lectura.

### Modified Capabilities
(ninguna — `dashboard-jefecalidad-view` y el dashboard de Alta Dirección solo
ganan un widget adicional montado condicionalmente por rol; no cambian
requisitos existentes de esas specs. `incident-map-view` no se modifica: se
reutiliza tal cual.)

## Impact

- Nuevo: `shc-controldoc/src/features/dashboard/components/HeatmapIncidentesWidget.tsx`
  (+ test).
- Modificado: `JefeCalidadDashboard.tsx`, `AltaDireccionDashboard.tsx`
  (montaje del widget nuevo, gate por rol).
- Sin cambios en: `IncidentMapCanvas.tsx`, `useLocales.ts`,
  `useIncidentList()`, `useDashboardSummary`, KPI-01 a KPI-09.
- Sin cambios de backend/MSW: reutiliza handlers existentes de `incidents` y
  `locations`.
