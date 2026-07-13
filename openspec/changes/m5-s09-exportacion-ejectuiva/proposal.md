## Why

Alta Dirección y Jefe de Calidad/SyST necesitan compartir el estado del dashboard SHAC (KPIs, QEs, ACs, tendencias) fuera de la aplicación — para comités, auditorías externas o reportes periódicos — y hoy no existe forma de sacar esa información sin capturas de pantalla manuales. Se implementa ahora en vez de diferir a v1.1 por decisión explícita del negocio.

## What Changes

- Se agrega un botón de exportación visible solo para `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` en sus respectivos dashboards, que abre un selector de formato (Excel o PDF).
- Exportación Excel (`xlsx`/SheetJS): un libro con una hoja por widget de datos tabulares del dashboard del rol (KPIs, QEs por estado, ACs por vencer, QEs críticos, reaperturas, extensiones de plazo, etc., según el rol), más encabezado con rol, fecha/hora y usuario que exporta.
- Exportación PDF (`jspdf` + `jspdf-autotable`): documento estructurado (texto y tablas reales, no captura de pantalla) con portada, una sección por widget en el mismo orden en que aparece en pantalla, y tablas via `jspdf-autotable` para todo contenido tabular.
- La sección de tendencia mensual (`TendenciaMensualWidget`, gráfico Recharts) se incluye en el PDF como imagen embebida del gráfico (renderizado a imagen solo para esa sección puntual), no como tabla de valores — para preservar el impacto visual esperado en un informe ejecutivo.
- El export refleja el snapshot de datos actualmente cargado en el dashboard (`useDashboardSummary()`) sin filtrado adicional; los dos widgets con rango local (`TendenciaMensualWidget`, `HeatmapIncidentesWidget`, ambos 3/6/12 meses) exportan usando el rango seleccionado en cada uno al momento de exportar — no se introduce un filtro de período global nuevo.
- Un dashboard sin datos en un widget exporta ese widget comunicando explícitamente la ausencia de datos, no una hoja/sección vacía sin contexto.
- Se agregan `xlsx`, `jspdf`, `jspdf-autotable` y una librería de captura de nodo DOM a imagen (para la sección de tendencia del PDF) como nuevas dependencias — primera vez que M5 genera archivos binarios en cliente.
- Como parte de este cambio se documenta formalmente la capability `dashboard-altadireccion-view` en las specs principales del proyecto: existe en código (`AltaDireccionDashboard.tsx`) desde el change `m5-s06-dashboard-altadireccion`, pero ese change nunca fue archivado/sincronizado a `openspec/specs/`. Se backfillea aquí en vez de bloquear esta propuesta en el archivado de deuda de specs ajena a exportación.

## Capabilities

### New Capabilities
- `dashboard-export-ejecutivo`: botón de exportación condicionado por rol, selector de formato PDF/Excel, generación de Excel multi-hoja y PDF estructurado reflejando los widgets reales de cada dashboard, manejo de estado vacío por widget, convención de nombre de archivo.
- `dashboard-altadireccion-view`: backfill de la spec de la vista de dashboard de Alta Dirección (KPIs ejecutivos, comparativa mensual, QEs críticos, reaperturas, ACs con extensión de plazo pendiente, heatmap, acciones requeridas) tal como existe hoy en `AltaDireccionDashboard.tsx`, más el nuevo punto de entrada de exportación agregado por este change.

### Modified Capabilities
- `dashboard-jefecalidad-view`: agrega el punto de entrada de exportación (botón + selector de formato) visible solo para este rol, sin cambiar los widgets ni datos existentes del dashboard.

## Impact

- **Componentes nuevos**: botón/menú de exportación y modal de selección de formato en `features/dashboard/components/`; lógica de construcción de Excel y PDF en `features/dashboard/` (utils o hooks dedicados, no acoplados a un widget específico).
- **Componentes modificados**: `JefeCalidadDashboard.tsx`, `AltaDireccionDashboard.tsx` (montan el nuevo punto de entrada de exportación).
- **Dependencias nuevas**: `xlsx`, `jspdf`, `jspdf-autotable`, librería de DOM-a-imagen para la sección de tendencia del PDF (a confirmar en design.md).
- **Fuera de alcance**: exportación de evidencias de auditoría (Auditor Interno) — concepto distinto; envío automático por email del resumen; comparativa de KPIs entre locales (diferido a v2.0); introducir un filtro de período global compartido entre widgets; archivar/sincronizar la deuda de specs de `m5-s08-dashboard-mapacalor`, `m5-s10-panel-tuatencion` o `m8-normativa-vinculada` (solo se backfillea `dashboard-altadireccion-view` por ser la capability directamente tocada por este change).
- **No afecta**: `JefeControlDocumentarioDashboard` (solo renderiza `AccionesRequeridasWidget`, rol fuera de alcance de exportación) ni el dashboard de `AUDITOR_INTERNO`.
