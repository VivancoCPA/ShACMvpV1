## Context

`JefeCalidadDashboard.tsx` y `AltaDireccionDashboard.tsx` (`src/features/dashboard/pages/`) consumen un único `useDashboardSummary()` sin parámetros — el backend mock (`dashboard.handlers.ts`) devuelve un snapshot fijo, sin filtrado de período por query param. No existe ningún store ni URL param de período compartido entre widgets.

Dos widgets, y solo dos, mantienen su propio rango temporal local independiente vía `useState` (3/6/12 meses), sin sincronizarse entre sí ni con nada más:
- `TendenciaMensualWidget` (dos gráficos Recharts `LineChart`: volumen QE abiertos/cerrados, y tendencia KPI-01/04/05) — montado solo en `JefeCalidadDashboard`.
- `HeatmapIncidentesWidget` (`IncidentMapCanvas`, mapa de calor por local) — montado en ambos dashboards, con su propio `localId` seleccionable además del rango.

Todos los demás widgets (KPIs, listas de QE/AC) son puramente tabulares y no tienen filtro propio — reflejan el snapshot completo tal cual llega de `useDashboardSummary()`.

Ninguna librería de generación de archivos binarios existe hoy en el stack (`package.json` de `shc-controldoc/` no tiene `xlsx`, `jspdf`, ni ninguna librería de canvas-to-image). `recharts` (`^3.9.2`) ya está presente — es lo que renderiza los gráficos que hay que capturar para el PDF.

## Goals / Non-Goals

**Goals:**
- Un punto de entrada de exportación (botón + selector Excel/PDF) reutilizable, montado condicionalmente por rol en `JefeCalidadDashboard` y `AltaDireccionDashboard`.
- Generación de Excel (`xlsx`) y PDF (`jspdf` + `jspdf-autotable`) reflejando exactamente los widgets tabulares que cada dashboard tiene montados hoy, sin curar un subconjunto fijo distinto al que ve el usuario en pantalla.
- La sección de tendencia mensual del PDF (`TendenciaMensualWidget`, dos gráficos Recharts) se embebe como imagen; todo el resto del PDF permanece texto/tablas estructuradas (jspdf-autotable), sin captura de pantalla del documento completo.
- Manejo explícito de estado vacío por widget (ninguna hoja/sección vacía sin contexto).

**Non-Goals:**
- No se introduce un filtro de período global ni se sincronizan los `rango` locales de `TendenciaMensualWidget`/`HeatmapIncidentesWidget` — el export usa el rango seleccionado en cada uno al momento de exportar, tal cual está hoy la arquitectura (decisión confirmada con el usuario).
- No se backfillea la capability `dashboard-heatmap-incidentes` (deuda de `m5-s08-dashboard-mapacalor`, sin archivar) — el export solo necesita los datos tabulares que ese widget ya expone (local → conteo), no su comportamiento visual completo.
- No se archivan `m5-s08-dashboard-mapacalor`, `m5-s10-panel-tuatencion` ni `m8-normativa-vinculada` — fuera de alcance de este change.
- No se implementa envío por email ni comparativa entre locales (diferidos, ver proposal.md).

## Decisions

### 1. Librerías: `xlsx`, `jspdf` + `jspdf-autotable`, `html2canvas`

- **Excel**: `xlsx` (SheetJS), como especificado — una hoja por widget tabular relevante, no una hoja plana única.
- **PDF**: `jspdf` + `jspdf-autotable` para todo el contenido estructurado (portada, secciones, tablas). Consistente con el estándar ya usado en RNF-P03 (PDF de QE) — nunca captura de pantalla del documento.
- **Captura de gráfico puntual**: `html2canvas` (única opción madura y sin dependencias nativas para capturar un nodo DOM arbitrario a imagen en cliente) se agrega como dependencia nueva, usada **exclusivamente** para capturar los dos `<ResponsiveContainer>` de `TendenciaMensualWidget` a PNG antes de insertarlos en el PDF vía `pdf.addImage()`. No se usa en ningún otro punto del export — el resto del documento se construye con `jspdf-autotable`, preservando la decisión "no screenshot" a nivel de documento completo.
- Alternativa descartada: renderizar los gráficos a SVG y convertir a PDF vectorial directamente (ej. `recharts` a SVG + `svg2pdf.js`) — más fiel visualmente pero agrega una segunda dependencia de conversión solo para dos gráficos; `html2canvas` ya es el estándar de facto y es suficiente para el caso de uso (imagen rasterizada en una portada de informe, no un documento CAD).

### 2. El heatmap se exporta como tabla, no como imagen

`HeatmapIncidentesWidget` (`IncidentMapCanvas`) es un mapa, no un gráfico de tendencia — la decisión de imagen embebida tomada para "la sección de tendencia" (pregunta abierta del proposal) no se extiende a él. Tanto en Excel como en PDF, el heatmap se representa como tabla `local → conteo de incidentes` (mismos datos que ya usa `useIncidentList()` para pintar el mapa), consistente con el enfoque estructurado original. Evita una segunda dependencia/capture de canvas y un mapa rasterizado que no aporta valor de lectura en un documento impreso.

### 3. Módulo de export desacoplado de los widgets

Nuevo directorio `src/features/dashboard/export/`:
- `dashboardExport.types.ts` — contrato `DashboardExportSection` (`{ id: string; titulo: string; kind: 'kpis' | 'tabla' | 'grafico-tendencia'; rows: ...; empty: boolean }`) que cada dashboard arma a partir de los props/datos que ya tienen montados (no un nuevo fetch — el export lee el mismo `data` que ya renderiza cada widget).
- `buildJefeCalidadExportSections(data)` / `buildAltaDireccionExportSections(data)` — funciones puras, una por dashboard, que mapean el `DashboardSummaryData` ya cargado a `DashboardExportSection[]`, respetando el orden real de montaje de cada dashboard (incluye `AccionesRequeridasWidget`, que trae su propio hook `useAccionesRequeridas()` independiente del summary — el export lo consume vía el mismo hook, no vía `data`).
- `exportToExcel(sections, meta)` y `exportToPdf(sections, meta)` — funciones agnósticas de rol, consumen `DashboardExportSection[]` + metadata (rol, usuario, fecha/hora, nombre de archivo).
- `ExportButton` (`components/`) — UI: botón + modal de selección de formato, guardado de rol vía `authStore`, invoca `build*ExportSections` + `exportToExcel`/`exportToPdf` según elección. Mismo patrón de guard a nivel de componente (no router) que otros widgets condicionados por rol (p.ej. `ACsPorVencerWidget`).

Esta separación evita acoplar la lógica de generación de archivos a los componentes de widget existentes (que siguen renderizando solo UI de pantalla) y hace que `buildJefeCalidadExportSections`/`buildAltaDireccionExportSections` sean testeables sin renderizar React.

### 4. Estado vacío por sección

Cada `DashboardExportSection` lleva su propio flag `empty: boolean` (ya derivable: `rows.length === 0`, mismo criterio que ya usa cada widget en pantalla para su empty-state). `exportToExcel` escribe una fila única "Sin datos en el período seleccionado" (i18n) en vez de una hoja con solo encabezados; `exportToPdf` escribe el mismo texto como párrafo en vez de invocar `autoTable` con filas vacías.

### 5. Convención de nombre de archivo y metadata de encabezado

`SHAC-Informe-Ejecutivo-{rol}-{periodo}-{fecha}.xlsx|.pdf`, donde:
- `{rol}` = slug del rol (`jefe-calidad`, `alta-direccion`).
- `{periodo}` = dado que no hay período global, se usa la fecha/hora de generación en formato `yyyyMMdd-HHmm` (no hay un "período" único que nombrar coherentemente cuando cada gráfico puede tener su propio rango) — el rango real de cada gráfico se documenta dentro del archivo (encabezado de hoja Excel / portada PDF), no en el nombre de archivo.
- `{fecha}` se omite del nombre por ser redundante con `{periodo}` bajo esta definición; el nombre final queda `SHAC-Informe-Ejecutivo-{rol}-{yyyyMMdd-HHmm}.xlsx|.pdf`.

## Risks / Trade-offs

- **[Riesgo]** `html2canvas` capturando dos `<ResponsiveContainer>` de Recharts puede exceder el presupuesto de 5s (CA-M5S09-05) si el DOM aún no terminó de pintar → **Mitigación**: capturar solo cuando los datos de `TendenciaMensualWidget` ya están montados y renderizados (no en paralelo con el fetch), a `scale: 2` (no mayor), y ejecutar la construcción de Excel de forma completamente independiente (no bloqueada por la captura de imagen del PDF).
- **[Riesgo]** El nombre de archivo sin un "período" único legible puede confundir a Alta Dirección si esperaba algo como "Q1-2026" → **Mitigación**: documentado explícitamente en Decisión 5; si se requiere un período nombrado más adelante, es una decisión de UX separada de introducir un filtro global (fuera de alcance aquí).
- **[Riesgo]** `dashboard-heatmap-incidentes` sigue sin sincronizar en `openspec/specs/` — el export depende de datos de un widget cuya spec no existe en specs principales → **Mitigación**: el export solo consume el shape de datos ya existente en código (`local → conteo`), sin depender de que la capability esté formalmente documentada; se deja constancia de la deuda en Impact del proposal.

## Migration Plan

1. Agregar dependencias: `xlsx`, `jspdf`, `jspdf-autotable`, `html2canvas` (`shc-controldoc/package.json`).
2. Crear `src/features/dashboard/export/` (types, `build*ExportSections`, `exportToExcel`, `exportToPdf`).
3. Crear `ExportButton` + modal de selección de formato en `src/features/dashboard/components/`.
4. Cablear `ExportButton` en `JefeCalidadDashboard.tsx` y `AltaDireccionDashboard.tsx`.
5. Agregar claves i18n (`es-PE`/`en-US`) en namespace `dashboard`.
6. Verificación manual en navegador: exportar Excel y PDF desde ambos roles, con y sin datos en las secciones opcionales (QEs críticos, reaperturas, ACs con extensión de plazo vacíos).

Rollback: revertir el commit — no hay estado persistente ni migración de datos (mock-only, generación 100% client-side).

## Open Questions

Ninguna pendiente — la pregunta sobre tabla de valores vs. imagen embebida para la tendencia mensual fue resuelta con el usuario (imagen embebida) antes de este documento.
