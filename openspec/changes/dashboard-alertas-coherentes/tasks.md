## 1. Backend — predicado compartido de AC vencida

- [x] 1.1 `DashboardKpiCalculator.EsAcVencida(string estado, DateTime plazoFecha, DateTime ahora)`; `CalcularKpi08` lo usa (con sobrecarga que recibe `ahora`)
- [x] 1.2 `BuildSupervisor` usa `EsAcVencida` para `AccionesCorrectivasVencidas`
- [x] 1.3 `JefeCalidadDashboardData.AccionesCorrectivasVencidas` (lista completa, `PlazoFecha` asc., QE + NC + Incidentes); `BuildJefeCalidad` recibe `nombresUsuarios`; `ObtenerSummaryHandler` lo resuelve con `ResolveNombresParaIncidentesAsync`
- [x] 1.4 Tests: `EsAcVencida`; `AccionesCorrectivasVencidas.Count == KPI-08` con AC vencidas en QE/NC/Incidente, una CERRADA y una de otra empresa; Supervisor sigue igual

## 2. Frontend — tipos, utils y acciones requeridas

- [x] 2.1 `AccionRequeridaTipo`: quitar `QE_CERRAR`, agregar `QE_REGISTRAR_CIERRE` y `QE_FIRMAR_CIERRE_JCA`; `JefeCalidadDashboardData.accionesCorrectivasVencidas`
- [x] 2.2 `extraerAccionesQE`: reemplazar `puedeCerrar`/`QE_CERRAR` por los dos pendientes (D3); `filtrarAccionesPorTipo(items, tipos)` exportada
- [x] 2.3 `alertasDashboard.utils.ts`: `clasificarAcsVencidasYPorVencer` (devuelve arreglos), `filtrarSolicitudesGerenciaPendientes`, `filtrarAcsNoVencidas` (pestaña Por vencer)
- [x] 2.4 Grep: no queda ningún uso de `QE_CERRAR` (código, tests, i18n, exportes)
- [x] 2.5 Tests de utils: `QE_REGISTRAR_CIERRE`/`QE_FIRMAR_CIERRE_JCA` en los casos correctos; `filtrarAccionesPorTipo`; clasificación de AC; filtro de Gerencia

## 3. Frontend — componentes

- [x] 3.1 `useAlertaSeleccionada` (`alerta`, `seleccionar`, `limpiar`, `alternar`; `replace: true`, conserva otros params) + test
- [x] 3.2 `AlertaCard`: unión `to` | `onSelect`/`activa` → `<button aria-pressed>` con anillo del nivel + tests
- [x] 3.3 `AccionesRequeridasWidget`: `filtroTipos`/`etiquetaFiltro`/`onQuitarFiltro`; sin corte de 10 con filtro; chip ✕ + tests
- [x] 3.4 `MisACsWidget`: `etiquetaFiltro`/`onQuitarFiltro` con chip
- [x] 3.5 `ACsExtensionPlazoWidget` recibe el arreglo ya filtrado (sin filtrar internamente)
- [x] 3.6 `ACsVencidasPorVencerWidget` (tablist Vencidas/Por vencer, filas `SemaforoRow`) + test de contadores = filas

## 4. Frontend — páginas (tabla `ALERTAS` por página)

- [x] 4.1 `JefeCalidadDashboard`: aprobaciones (3 tipos), acVencidas (pestaña), incidentesSinQe (scroll), críticos (enlace); lateral con `ACsVencidasPorVencerWidget`
- [x] 4.2 `SupervisorDashboard`: firmaCierre (filtra), acVencidas (selecciona)
- [x] 4.3 `OperarioDashboard`: acVencidas / acPorVencer filtran `MisACsWidget`
- [x] 4.4 `AuditorDashboard`: verificaciones filtra
- [x] 4.5 `AltaDireccionDashboard`: extensiones con `filtrarSolicitudesGerenciaPendientes`
- [x] 4.6 Tests parametrizados por página: número de tarjeta = filas visibles tras clic; `?alerta=` al montar mantiene el filtro; ✕ limpia la URL; JCA con >10 aprobaciones muestra todas

## 5. Refresco

- [x] 5.1 `invalidarDashboard(queryClient)` en `features/dashboard/utils/invalidarDashboard.ts`
- [x] 5.2 `invalidarQueriesDeEntidad` lo llama siempre (hub + polling)
- [x] 5.3 Mutaciones de QE, NC, incidentes y documentos listadas en design.md D5 lo llaman en `onSuccess`
- [x] 5.4 Tests: evento simulado del hub invalida `['dashboard']`; `onSuccess` de `useAprobarCausaRaiz` y `useFirmarCierre` lo invalidan; la tarjeta cambia sin recargar

## 6. i18n y MSW

- [x] 6.1 i18n `dashboard` es-PE/en-US: claves nuevas de la instrucción §3.5; quitar `accionesRequeridas.tipo.QE_CERRAR` y `alertas.jefeCalidad.esperanFirma`
- [x] 6.2 MSW: `esAcVencida` compartida por `calcularKpi08`, Supervisor y el nuevo `accionesCorrectivasVencidas` del JCA + test (largo = KPI-08)
- [x] 6.3 Fixtures de QE: un PENDIENTE_CIERRE sin `resultadoCierre` y otro con `resultadoCierre` sin `cerradoPorId`

## 7. Verificación

- [ ] 7.1 Suite completa frontend (`npm test`) y backend (`dotnet test`) — dashboard/notificaciones/MSW: 338/338 OK; backend: todo OK salvo `DocumentosPdfConversionTests.ExportarPdfControlado_…` (conversión PDF, ajeno); frontend completo: fallos intermitentes por carga de la máquina (timeouts, varían entre corridas) y `documentReplaceOriginal.test.tsx` (permisos de botones de Documentos, archivo con cambios previos a este cambio)
- [ ] 7.2 `tsc --noEmit` y `npm run lint` con cero errores — los archivos de este cambio quedan sin errores; el repo arrastra errores previos ajenos (tsc en `documents.*` y `PanelPendientesAreaWidget.test`, 54 de lint)
- [ ] 7.3 Prueba manual con MSW apagado (pasos 1 a 6 de la instrucción), a cargo de Toño
