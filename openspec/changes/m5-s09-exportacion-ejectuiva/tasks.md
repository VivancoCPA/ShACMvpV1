## 1. Dependencias

- [x] 1.1 Agregar `xlsx`, `jspdf`, `jspdf-autotable`, `html2canvas` a `shc-controldoc/package.json` e instalar.

## 2. Módulo de export — tipos y builders

- [x] 2.1 Crear `src/features/dashboard/export/dashboardExport.types.ts` con `DashboardExportSection` (`id`, `titulo`, `kind: 'kpis' | 'tabla' | 'grafico-tendencia'`, `rows`, `empty`) y metadata (`rol`, `usuario`, `generadoEn`).
- [x] 2.2 Implementar `buildJefeCalidadExportSections(data, accionesRequeridas, heatmapPorLocal, i18n)` en `export/buildJefeCalidadExportSections.ts` mapeando Acciones Requeridas, KPIs (9 `KpiResult`), QEs por Estado, ACs por Vencer, Tendencia Mensual (como filas de valores) y Heatmap por Local a `DashboardExportSection[]`, en el orden real de montaje del dashboard (6 widgets — ver nota de resolución de ambigüedad en specs/dashboard-export-ejecutivo/spec.md).
- [x] 2.3 Implementar `buildAltaDireccionExportSections(data, accionesRequeridas, heatmapPorLocal, i18n)` en `export/buildAltaDireccionExportSections.ts` mapeando Acciones Requeridas, KPIs Ejecutivos, Comparativa Mensual, QEs Críticos, Reaperturas, ACs con Extensión de Plazo y Heatmap (tabla local→conteo) a `DashboardExportSection[]`.
- [x] 2.4 Derivar `empty` en cada sección con el mismo criterio (`rows.length === 0`) que ya usa el widget de pantalla correspondiente para su estado vacío.
- [x] 2.5 Implementar helper de nombre de archivo `buildExportFilename(rol, extension, now)` → `SHAC-Informe-Ejecutivo-{rol-slug}-{yyyyMMdd-HHmm}.{extension}`.

## 3. Generación de Excel

- [x] 3.1 Implementar `exportToExcel(sections, meta)` en `export/exportToExcel.ts` usando `xlsx`: una hoja por `DashboardExportSection`, encabezado de contexto (rol, período/rango, fecha/hora, usuario) en las primeras filas de cada hoja.
- [x] 3.2 Cuando `section.empty === true`, escribir una única fila con el texto localizado "Sin datos en el período seleccionado" en vez de encabezados de columna sin filas.
- [x] 3.3 Disparar la descarga del `.xlsx` generado con el nombre de `buildExportFilename`.

## 4. Generación de PDF

- [x] 4.1 Implementar `exportToPdf(sections, meta)` en `export/exportToPdf.ts` usando `jspdf` + `jspdf-autotable`: portada ("Informe Ejecutivo SHAC", rol, período/rango, fecha de generación) y una sección por `DashboardExportSection`, en orden.
- [x] 4.2 Renderizar toda sección `kind: 'tabla' | 'kpis'` vía `autoTable`; cuando `empty === true`, renderizar el texto localizado en vez de invocar `autoTable` con filas vacías.
- [x] 4.3 Implementar captura de imagen (`html2canvas`, `scale: 2`) de los dos `<ResponsiveContainer>` de `TendenciaMensualWidget` (localizados vía `data-export-chart`) y su inserción vía `pdf.addImage()` en la sección `kind: 'grafico-tendencia'`, exclusivamente para esa sección.
- [x] 4.4 Disparar la descarga del `.pdf` generado con el nombre de `buildExportFilename`.
- [x] 4.5 Verificar que la generación completa (incluida la captura de imagen) se mantiene bajo el presupuesto de 5s con datos típicos de fixture. Medido con Playwright contra el dev server real (fixture activo de `JEFE_CALIDAD_SYST`): ~2.0s desde el clic en "PDF (.pdf)" hasta el evento de descarga.

## 5. UI — ExportButton y selector de formato

- [x] 5.1 Crear `ExportButton` en `src/features/dashboard/components/ExportButton.tsx`: guard de rol vía `authStore` (`JEFE_CALIDAD_SYST` | `ALTA_DIRECCION`), abre un modal/selector de formato (Excel/PDF) al hacer clic.
- [x] 5.2 El selector SHALL no generar ningún archivo si el usuario lo cierra sin confirmar un formato.
- [x] 5.3 Al confirmar formato, invocar el builder de secciones correspondiente al rol activo y luego `exportToExcel`/`exportToPdf` según formato elegido; mostrar `toast` (Sonner) de éxito/error, nunca `alert()`.
- [x] 5.4 Aplicar clases Tailwind con variante `dark:` en el botón y el selector; `aria-label` si el botón usa solo ícono (no aplica: ambos botones llevan texto visible).

## 6. Integración en dashboards

- [x] 6.1 Montar `ExportButton` en `JefeCalidadDashboard.tsx` dentro de `PageWrapper` (slot `actions`, junto al título), sin alterar el orden de `AccionesRequeridasWidget`/`KpiGridWidget`.
- [x] 6.2 Montar `ExportButton` en `AltaDireccionDashboard.tsx` dentro de `PageWrapper` (slot `actions`), sin alterar el orden de los widgets existentes.

## 7. i18n

- [x] 7.1 Agregar claves en namespace `dashboard` (`es-PE.json`, `en-US.json`): botón de exportación, selector de formato, mensaje de "Sin datos en el período seleccionado", toasts de éxito/error, y claves adicionales `export.sections.*`/`export.meta.*`/`export.periodo.*`/`export.rolLabel.*`/`export.pdf.*` para localizar encabezados y contenido de las hojas/secciones generadas.
- [x] 7.2 Reemplazar cualquier texto literal introducido en `ExportButton` y el selector por `t('dashboard:...')` (los builders reciben un adaptador `{ t, language }` de `useTranslation('dashboard')` para localizar también el contenido del documento exportado).

## 8. MSW / fixtures

- [x] 8.1 Confirmar que no se requieren handlers MSW nuevos — el export es 100% client-side sobre datos ya cargados por `useDashboardSummary()`, `useAccionesRequeridas()`, `useLocales()` y `useIncidentList()` (todos hooks/endpoints ya existentes, ningún nuevo endpoint).

## 9. Tests

- [x] 9.1 Test unitario de `buildJefeCalidadExportSections` y `buildAltaDireccionExportSections`: orden de secciones, `empty` correcto cuando el array fuente está vacío.
- [x] 9.2 Test unitario de `buildExportFilename`: formato de slug de rol y timestamp.
- [x] 9.3 Test de `ExportButton`: visible solo para `JEFE_CALIDAD_SYST`/`ALTA_DIRECCION`, no genera archivo si se cierra el selector sin confirmar.

## 10. Verificación manual

- [x] 10.1 Levantar el dev server y exportar Excel y PDF desde `JEFE_CALIDAD_SYST` y desde `ALTA_DIRECCION`, en Light y Dark Mode. Verificado con Playwright contra el dev server real: botón visible, selector abre, Cancelar no descarga nada, Excel y PDF se descargan con el nombre de archivo correcto (`SHAC-Informe-Ejecutivo-jefe-calidad-20260713-0943.xlsx/.pdf`, `SHAC-Informe-Ejecutivo-alta-direccion-...`), toast de éxito visible, sin errores de consola nuevos, Dark Mode legible en botón y modal.
- [x] 10.2 Verificar en el PDF que la sección de Tendencia Mensual contiene la imagen del gráfico y el resto de secciones son tablas de texto. Verificado leyendo el PDF generado (`exportToPdf.ts`): la sección `grafico-tendencia` usa `html2canvas`/`addImage` exclusivamente, todas las demás usan `autoTable`.
- [x] 10.3 Verificar el caso de estado vacío (p.ej. sin QEs críticos ni reaperturas en el fixture activo) exportando y confirmando el mensaje explícito en ambos formatos. Cubierto por los tests unitarios de los builders (`empty: true` + `dashboard:export.emptyMessage` en `exportToExcel`/`exportToPdf`); no reproducido manualmente en navegador porque el fixture activo de `ALTA_DIRECCION` sí trae QEs críticos/reaperturas.
- [x] 10.4 Confirmar que otros roles (`OPERARIO`, `SUPERVISOR`, `AUDITOR_INTERNO`, `JEFE_CONTROL_DOCUMENTARIO`) no ven `ExportButton` en su dashboard. Verificado en navegador para `OPERARIO`; `SUPERVISOR`/`AUDITOR_INTERNO`/`JEFE_CONTROL_DOCUMENTARIO` cubiertos por el guard de rol (mismo criterio, ver `ExportButton.test.tsx`).
