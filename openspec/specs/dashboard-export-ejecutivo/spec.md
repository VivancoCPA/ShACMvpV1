# Spec: dashboard-export-ejecutivo

## Purpose

Define the executive export feature available from `JefeCalidadDashboard` and `AltaDireccionDashboard`: the role-gated `ExportButton`, the format-selection modal (Excel/PDF), the sheet-per-widget Excel generation, the structured (text/table) PDF generation via `jspdf` + `jspdf-autotable`, the chart-image exception for `TendenciaMensualWidget`, the table-based export of `HeatmapIncidentesWidget`, explicit empty-section messaging, the `SHAC-Informe-Ejecutivo` filename convention, and the 5-second PDF generation performance budget.

---

## Requirements

### Requirement: Botón de exportación visible solo para JEFE_CALIDAD_SYST y ALTA_DIRECCION
El sistema SHALL renderizar un componente `ExportButton` en `JefeCalidadDashboard` y `AltaDireccionDashboard`, condicionado por rol vía `authStore` (guard a nivel de componente, mismo patrón que otros widgets condicionados por rol como `ACsPorVencerWidget`). Ningún otro rol (`OPERARIO`, `SUPERVISOR`, `AUDITOR_INTERNO`, `JEFE_CONTROL_DOCUMENTARIO`, `ADMINISTRADOR_SISTEMA`) SHALL ver este botón, incluyendo roles que comparten `/dashboard` en el router.

#### Scenario: JEFE_CALIDAD_SYST ve el botón de exportación
- **WHEN** un usuario con `rol: 'JEFE_CALIDAD_SYST'` visualiza `JefeCalidadDashboard`
- **THEN** `ExportButton` es visible

#### Scenario: ALTA_DIRECCION ve el botón de exportación
- **WHEN** un usuario con `rol: 'ALTA_DIRECCION'` visualiza `AltaDireccionDashboard`
- **THEN** `ExportButton` es visible

#### Scenario: Otros roles no ven el botón de exportación
- **WHEN** un usuario con `rol` distinto de `JEFE_CALIDAD_SYST` o `ALTA_DIRECCION` visualiza su propio dashboard (`OPERARIO`, `SUPERVISOR`, `AUDITOR_INTERNO` o `JEFE_CONTROL_DOCUMENTARIO`)
- **THEN** `ExportButton` no se renderiza en ningún punto de la página

### Requirement: El usuario elige formato PDF o Excel antes de generar el archivo
Al hacer clic en `ExportButton`, el sistema SHALL mostrar un selector de formato (Excel o PDF) antes de iniciar la generación. La generación SHALL iniciar solo después de que el usuario confirme un formato — no existe un formato por defecto que se genere sin selección explícita.

#### Scenario: Selección de Excel genera un archivo .xlsx
- **WHEN** el usuario selecciona "Excel" en el selector de formato y confirma
- **THEN** se genera y descarga un archivo `.xlsx`

#### Scenario: Selección de PDF genera un archivo .pdf
- **WHEN** el usuario selecciona "PDF" en el selector de formato y confirma
- **THEN** se genera y descarga un archivo `.pdf`

#### Scenario: Cerrar el selector sin elegir no genera ningún archivo
- **WHEN** el usuario abre el selector de formato y lo cierra sin confirmar una opción
- **THEN** no se genera ni descarga ningún archivo

### Requirement: El Excel exportado refleja los widgets tabulares reales del dashboard del rol, una hoja por widget
El sistema SHALL generar, para cada rol, un libro `xlsx` con una hoja por widget tabular actualmente montado en el dashboard de ese rol (no una lista fija hardcodeada aparte de los componentes reales), en el orden en que aparecen en pantalla. Cada hoja SHALL incluir un encabezado con: nombre del rol, período/rango exportado (según Decisión 5 de design.md), fecha/hora de exportación y usuario que exporta.

Para `JEFE_CALIDAD_SYST`, las hojas SHALL cubrir: Acciones Requeridas, KPIs (los 9 `KpiResult`), QEs por Estado, ACs por Vencer, la serie de datos de Tendencia Mensual (volumen y KPI-01/04/05) como tabla de valores, y Heatmap por Local (tabla `local → conteo de incidentes`) — `JefeCalidadDashboard` monta `HeatmapIncidentesWidget` igual que `AltaDireccionDashboard`, por lo que la regla general de esta sección ("una hoja por widget tabular actualmente montado... no una lista fija hardcodeada aparte de los componentes reales") aplica también a él, consistente con el conteo de 6 widgets del escenario siguiente.

Para `ALTA_DIRECCION`, las hojas SHALL cubrir: Acciones Requeridas, KPIs Ejecutivos, Comparativa Mensual, QEs Críticos, Reaperturas, ACs con Extensión de Plazo, y Heatmap por Local (tabla `local → conteo de incidentes`).

#### Scenario: Excel de JEFE_CALIDAD_SYST tiene una hoja por cada widget montado
- **WHEN** `JefeCalidadDashboard` tiene montados sus 6 widgets con datos cargados
- **THEN** el libro Excel generado contiene una hoja por cada uno de esos 6 widgets, ninguna hoja adicional ni faltante

#### Scenario: Excel de ALTA_DIRECCION tiene una hoja por cada widget montado
- **WHEN** `AltaDireccionDashboard` tiene montados sus 7 widgets con datos cargados
- **THEN** el libro Excel generado contiene una hoja por cada uno de esos 7 widgets, ninguna hoja adicional ni faltante

#### Scenario: Cada hoja lleva encabezado de contexto
- **WHEN** se genera cualquier hoja del Excel
- **THEN** las primeras filas incluyen rol, período/rango exportado, fecha/hora de exportación y usuario que exporta, antes de las filas de datos

### Requirement: El PDF exportado es estructurado (texto y tablas reales), no una captura de pantalla
El sistema SHALL generar, para cada rol, un PDF vía `jspdf` + `jspdf-autotable` con: una portada (título "Informe Ejecutivo SHAC", rol, período/rango, fecha de generación), y una sección por widget en el mismo orden en que aparece en el dashboard. Todo contenido tabular SHALL renderizarse vía `jspdf-autotable`. El PDF SHALL NOT construirse capturando el DOM completo de la página a imagen (p.ej. `html2canvas` sobre todo el documento).

#### Scenario: Portada incluye rol, período y fecha
- **WHEN** se genera el PDF para cualquiera de los dos roles
- **THEN** la primera página incluye el título "Informe Ejecutivo SHAC", el rol, el período/rango exportado y la fecha de generación

#### Scenario: Cada widget tabular se renderiza como tabla real, no como imagen
- **WHEN** se genera la sección de "QEs por Estado" (o cualquier otro widget tabular) en el PDF
- **THEN** el contenido se renderiza vía `jspdf-autotable` como tabla de texto seleccionable, no como imagen rasterizada de la tabla en pantalla

#### Scenario: El orden de secciones del PDF coincide con el orden de widgets en pantalla
- **WHEN** se genera el PDF de `AltaDireccionDashboard`
- **THEN** las secciones aparecen en el mismo orden en que los widgets están montados en el dashboard

### Requirement: La sección de tendencia mensual del PDF se embebe como imagen del gráfico
El sistema SHALL capturar los dos gráficos Recharts de `TendenciaMensualWidget` (volumen QE abiertos/cerrados; tendencia KPI-01/04/05) a imagen (vía captura de nodo DOM, `scale: 2`) e incrustarlos como imagen dentro de la sección correspondiente del PDF, en vez de representarlos como tabla de valores. Esta excepción SHALL aplicar únicamente a esta sección — ninguna otra sección del PDF usa captura de imagen.

#### Scenario: La sección de Tendencia Mensual contiene una imagen, no una tabla
- **WHEN** se genera el PDF de `JefeCalidadDashboard` y se llega a la sección de Tendencia Mensual
- **THEN** esa sección contiene los gráficos capturados como imagen, no una tabla de valores mes a mes

#### Scenario: Las demás secciones no usan imagen
- **WHEN** se genera cualquier sección del PDF distinta a Tendencia Mensual
- **THEN** esa sección no contiene ninguna imagen capturada de un gráfico o del DOM

### Requirement: El Heatmap por Local se exporta como tabla, no como imagen del mapa
El sistema SHALL representar `HeatmapIncidentesWidget` en ambos formatos de export (Excel y PDF) como una tabla `local → conteo de incidentes` derivada de los mismos datos que pinta el mapa (`useIncidentList()`), usando el rango (3/6/12 meses) y local seleccionados en el widget al momento de exportar. El mapa visual (`IncidentMapCanvas`) SHALL NOT capturarse como imagen.

#### Scenario: Heatmap aparece como tabla en el Excel
- **WHEN** se genera el Excel de cualquiera de los dos roles y `HeatmapIncidentesWidget` está montado
- **THEN** la hoja correspondiente contiene filas `local, conteo de incidentes`, no una imagen del mapa

#### Scenario: Heatmap usa el rango local activo al momento de exportar
- **WHEN** el usuario cambió el rango de `HeatmapIncidentesWidget` a "12 meses" antes de exportar
- **THEN** la tabla de heatmap exportada refleja el conteo calculado sobre esos 12 meses, no el rango por defecto

### Requirement: Un widget sin datos en su sección exporta un mensaje explícito, no una sección vacía
El sistema SHALL marcar cada sección de export con `empty: boolean` derivado del mismo criterio que ya usa cada widget para su estado vacío en pantalla. Cuando `empty === true`, la hoja Excel o sección PDF correspondiente SHALL mostrar el texto "Sin datos en el período seleccionado" (localizado) en vez de una tabla sin filas o una hoja/sección en blanco.

#### Scenario: QEs Críticos vacío exporta mensaje explícito
- **WHEN** `alertasCriticas` es un arreglo vacío al momento de exportar
- **THEN** la hoja/sección de "QEs Críticos" contiene el texto "Sin datos en el período seleccionado", no una tabla vacía ni una hoja/sección en blanco

#### Scenario: Reaperturas vacío exporta mensaje explícito
- **WHEN** `reaperturas` es un arreglo vacío al momento de exportar
- **THEN** la hoja/sección de "Reaperturas" contiene el mismo texto explícito de ausencia de datos

### Requirement: El nombre del archivo exportado sigue la convención SHAC-Informe-Ejecutivo
El sistema SHALL nombrar el archivo generado como `SHAC-Informe-Ejecutivo-{rol}-{yyyyMMdd-HHmm}.xlsx` o `.pdf`, donde `{rol}` es un slug (`jefe-calidad` | `alta-direccion`) y `{yyyyMMdd-HHmm}` es la fecha/hora de generación.

#### Scenario: Nombre de archivo Excel de Jefe de Calidad
- **WHEN** `JEFE_CALIDAD_SYST` exporta a Excel el 2026-07-12 a las 14:30
- **THEN** el archivo descargado se llama `SHAC-Informe-Ejecutivo-jefe-calidad-20260712-1430.xlsx`

#### Scenario: Nombre de archivo PDF de Alta Dirección
- **WHEN** `ALTA_DIRECCION` exporta a PDF el 2026-07-12 a las 09:05
- **THEN** el archivo descargado se llama `SHAC-Informe-Ejecutivo-alta-direccion-20260712-0905.pdf`

### Requirement: La generación del PDF respeta el presupuesto de rendimiento de 5 segundos
El sistema SHALL completar la generación del PDF (incluyendo la captura de imagen de Tendencia Mensual) en menos de 5 segundos, consistente con el estándar ya establecido para el PDF de QE (RNF-P03).

#### Scenario: Generación de PDF dentro del presupuesto
- **WHEN** el usuario confirma exportación a PDF desde cualquiera de los dos roles con datos típicos de un período
- **THEN** el archivo se genera y la descarga inicia en menos de 5 segundos
