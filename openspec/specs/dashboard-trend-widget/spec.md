# Spec: dashboard-trend-widget

## Purpose

Define the monthly trend widget (`TendenciaMensualWidget`) rendered on `JefeCalidadDashboard` for `JEFE_CALIDAD_SYST`, showing QE volume (opened vs. closed) and KPI-01/KPI-04/KPI-05 evolution over a user-selectable range of months, computed client-side from the 12-month data already returned by `GET /api/dashboard/summary`. `JEFE_CONTROL_DOCUMENTARIO` now renders a separate `JefeControlDocumentarioDashboard` (only `AccionesRequeridasWidget`, backed by `JefeControlDocDashboardData` — see `dashboard-types`) and does NOT render this widget.

---

## Requirements

### Requirement: Widget de tendencia mensual con selector de rango
El sistema SHALL renderizar un widget "Tendencia mensual" dentro de `JefeCalidadDashboard`, visible para `JEFE_CALIDAD_SYST`, junto a los widgets existentes (`KpiGridWidget`, `QEPorEstadoWidget`, `ACsPorVencerWidget`). `JEFE_CONTROL_DOCUMENTARIO` usa `JefeControlDocumentarioDashboard`, un componente distinto que NO incluye este widget (recibe `JefeControlDocDashboardData`, sin `tendenciaMensualVolumen`/`tendenciaMensualKpis` — ver `dashboard-msw-handlers`). El widget SHALL incluir un selector de rango con las opciones `3`, `6` y `12` meses, con `6` seleccionado por defecto al montar. Cambiar el rango SHALL recortar los datos ya recibidos (`data.tendenciaMensualVolumen`, `data.tendenciaMensualKpis`) a los últimos N meses de forma síncrona, sin disparar una nueva petición HTTP.

#### Scenario: Rango por defecto es 6 meses
- **WHEN** `JefeCalidadDashboard` termina de cargar
- **THEN** el widget de tendencia mensual muestra datos de los últimos 6 meses y el selector de rango indica `6` como seleccionado

#### Scenario: Cambiar de rango no dispara una petición nueva
- **WHEN** el usuario cambia el selector de rango de `6` a `12`
- **THEN** ambos gráficos se actualizan a 12 meses de datos sin que se dispare una nueva llamada a `GET /api/dashboard/summary`

#### Scenario: Cambiar a 3 meses recorta a los 3 más recientes
- **WHEN** el usuario selecciona el rango de `3` meses
- **THEN** ambos gráficos muestran únicamente las 3 entradas más recientes (mayor `periodo`) de los arrays de tendencia

---

### Requirement: Gráfico de volumen de QEs por mes (abiertos vs. cerrados)
El widget SHALL renderizar un `LineChart` (recharts) con dos series por mes: QEs abiertos (conteo de `fechaHoraReporte` en el mes) y QEs cerrados (conteo de `fechaCierre` en el mes), usando `data.tendenciaMensualVolumen` filtrado al rango seleccionado. Cada punto del eje X SHALL mostrar el periodo en formato legible localizado (no `'YYYY-MM'` crudo).

#### Scenario: Dos series distintas en el gráfico de volumen
- **WHEN** el gráfico de volumen se renderiza con datos de `tendenciaMensualVolumen`
- **THEN** existen exactamente 2 `Line` — una para `abiertos` y otra para `cerrados` — cada una con su propio color

#### Scenario: Eje X usa el periodo formateado, no el string YYYY-MM crudo
- **WHEN** se inspecciona la etiqueta del eje X para el periodo `'2026-03'`
- **THEN** el texto mostrado es el mes/año localizado (ej. "mar 2026" en `es-PE`), no el literal `'2026-03'`

---

### Requirement: Gráfico de evolución mensual de KPI-01, KPI-04 y KPI-05
El widget SHALL renderizar un segundo `LineChart` con 3 series — una por cada uno de KPI-01, KPI-04 y KPI-05 — usando `data.tendenciaMensualKpis` filtrado al rango seleccionado. Ningún KPI adicional a estos 3 SHALL aparecer en este gráfico. Los puntos de esta serie NO SHALL llevar codificación de semáforo (color fijo por serie, no por valor del punto).

#### Scenario: Exactamente 3 series de KPI
- **WHEN** el gráfico de KPIs se renderiza
- **THEN** existen exactamente 3 `Line`, correspondientes a KPI-01, KPI-04 y KPI-05, y ninguna a KPI-02/03/06/07/08/09

#### Scenario: El color de una serie no cambia por el valor del punto
- **WHEN** dentro de la misma serie de KPI-01 hay un punto con valor por debajo de la meta y otro por encima
- **THEN** ambos puntos usan el mismo color de serie (no se aplica lógica de semáforo VERDE/AMARILLO/ROJO por punto)

---

### Requirement: Widget funciona en Light y Dark mode
Los colores de las líneas de ambos gráficos SHALL ser legibles tanto sobre el fondo `canvas` (Light) como sobre `surface-dark` (Dark), usando los tokens de acento ya definidos en el design system (no un set de colores exclusivo para este widget).

#### Scenario: Colores de línea consistentes entre temas
- **WHEN** se activa Dark mode
- **THEN** las líneas de ambos gráficos siguen siendo visibles y distinguibles entre sí, sin requerir un color distinto al de Light mode
