## 1. Tipos (dashboard-types)

- [x] 1.1 Agregar `qeAbiertosPorTipo: Record<QEType, number>`, `qesEnVerificacionArea: QEResumen[]` y `accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]` a `SupervisorDashboardData` en `src/features/dashboard/types/dashboardData.types.ts`.

## 2. Handler MSW (dashboard-msw-handlers)

- [x] 2.1 En `buildSupervisorData` (`src/mocks/handlers/dashboard.handlers.ts`), calcular `qeAbiertosPorTipo` reduciendo `qes` (ya filtrado por área) por `qe.tipo`, excluyendo `estado === 'CERRADO'` o `'VERIFICADO'`, inicializando las 4 claves de `QEType` en `0`.
- [x] 2.2 Calcular `qesEnVerificacionArea` filtrando `qes` a `estado === 'EN_VERIFICACION' && fechaVerificacionProgramada` definido, proyectado con `toQEResumen`.
- [x] 2.3 Calcular `accionesCorrectivasPendientesArea` reusando `collectACsWithOrigin(qes, ncs, incidentes)` filtrado a `estado !== 'CERRADA'` (el mismo conjunto que hoy alimenta `pendientes`/`semaforoPlazos`), proyectado con `toACResumen`.
- [x] 2.4 Ajustar el filtro de `accionesCorrectivasVencidas` de `ac.estado !== 'CERRADA'` a `ac.estado === 'EN_EJECUCION'` (manteniendo la condición de `plazoFecha < hoy`).
- [x] 2.5 Actualizar/agregar casos en `dashboard.handlers.test.ts` cubriendo: `qeAbiertosPorTipo` con las 4 claves siempre presentes, `qesEnVerificacionArea` excluye QE sin `fechaVerificacionProgramada`, `accionesCorrectivasPendientesArea` incluye `PENDIENTE` y `EN_EJECUCION`, `accionesCorrectivasVencidas` ya no incluye ACs `PENDIENTE`, y el caso de Supervisor con más de un área en `areasAsignadas` combinando datos de ambas.

## 3. Router (routing)

- [x] 3.1 En `src/features/dashboard/pages/DashboardPage.tsx`, agregar la rama `if (dashboardType === 'SUPERVISOR') return <SupervisorDashboard />` antes del fallback `<ComingSoon>`.
- [x] 3.2 Actualizar `DashboardPage.test.tsx` y `src/router/dashboardAccess.test.tsx` para que un usuario `SUPERVISOR` en `/dashboard` espere `SupervisorDashboard`, no `<ComingSoon>`.

## 4. Widgets (dashboard-supervisor-view)

- [x] 4.1 Crear `src/features/dashboard/components/PanelPendientesAreaWidget.tsx`: recibe `qesEnVerificacionArea: QEResumen[]` y `accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]`; renderiza `SemaforoRow` para cada QE (usando `calcularEstadoSemaforoDesdeFecha(fechaVerificacionProgramada)`, navega a `/quality-events/:id`) y para cada AC (usando `plazoFecha`, navega según `origenTipo` con el mismo mapa de rutas que `MisACsWidget`). Un solo estado vacío cuando ambas listas están vacías. Mismo contenedor bordeado que M5-S03.
- [x] 4.2 Crear `src/features/dashboard/components/QEPorTipoWidget.tsx`: recibe `qeAbiertosPorTipo: Record<QEType, number>`; renderiza una fila fija por cada uno de los 4 `QEType` con su conteo (incluyendo `0`), sin navegación.
- [x] 4.3 Crear `src/features/dashboard/components/ACsVencidasWidget.tsx`: recibe `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`; renderiza una fila por elemento con navegación según `origenTipo`, y estado vacío.
- [x] 4.4 Crear `src/features/dashboard/components/IncidentesRecientesWidget.tsx`: recibe `incidentesRecientes: IncidenteResumen[]`; renderiza `numero`/`tipo`/`severidad` por fila, navega a `/incidents/:id`, estado vacío.
- [x] 4.5 Crear `src/features/dashboard/pages/SupervisorDashboard.tsx`: consume `useDashboardSummary()`, muestra skeleton mientras `isLoading`, renderiza los 4 widgets en orden (pendientes → por tipo → vencidas → incidentes recientes) cuando `data.rol === 'SUPERVISOR'`.

## 5. i18n

- [x] 5.1 Agregar claves en `src/i18n/es-PE.json` y `src/i18n/en-US.json` bajo el namespace `dashboard.supervisor.*` para: título del dashboard, títulos de los 4 widgets, mensajes de lista vacía, y las etiquetas de los 4 `QEType` en el widget de conteo.

## 6. Tests

- [x] 6.1 `PanelPendientesAreaWidget.test.tsx`: cubre fila de QE con semáforo, fila de AC con semáforo, navegación correcta para los 3 valores de `origenTipo`, y estado vacío combinado.
- [x] 6.2 `QEPorTipoWidget.test.tsx`: cubre que los 4 tipos se renderizan siempre, incluyendo conteo `0`.
- [x] 6.3 `ACsVencidasWidget.test.tsx`: cubre navegación por `origenTipo` y estado vacío.
- [x] 6.4 `IncidentesRecientesWidget.test.tsx`: cubre render de campos y navegación al detalle.
- [x] 6.5 `SupervisorDashboard.test.tsx`: cubre estado de carga y render de los 4 widgets con datos de `useDashboardSummary` mockeado.

## 7. Verificación manual

- [x] 7.1 Con `VITE_ENABLE_MSW=true`, loguear como un `SUPERVISOR` con `areasAsignadas` de más de un área (p.ej. `supervisor.almacen@shac.pe`), confirmar que los 4 widgets muestran datos combinados de ambas áreas, ninguno de un área fuera de asignación, y que las navegaciones (QE en verificación, AC pendiente/vencida por cada `origenTipo`, incidente reciente) llevan a la pantalla correcta en light y dark mode.
- [x] 7.2 Confirmar que un usuario `OPERARIO` sigue viendo `OperarioDashboard` sin regresión, y que los 4 roles restantes siguen viendo `<ComingSoon>`.
