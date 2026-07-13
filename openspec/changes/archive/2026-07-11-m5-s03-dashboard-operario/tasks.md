## 1. Tipos y datos (dashboard-types, dashboard-msw-handlers)

- [x] 1.1 Agregar `fechaVerificacionProgramada?: string` a `QEResumen` en `src/features/dashboard/types/dashboardSummary.types.ts`.
- [x] 1.2 Actualizar `toQEResumen` en `src/mocks/handlers/dashboard.handlers.ts` para proyectar `fechaVerificacionProgramada` desde el `QualityEvent` completo cuando esté presente.
- [x] 1.3 Verificar (test existente o nuevo) que `GET /api/dashboard/summary` para un `OPERARIO` con un QE `EN_VERIFICACION` incluye `fechaVerificacionProgramada` en el `QEResumen` correspondiente.

## 2. Router (routing)

- [x] 2.1 Crear `src/features/dashboard/pages/DashboardPage.tsx`: lee `user` de `authStore`, resuelve `getDashboardDataTypeForRole(user.rol)`, renderiza `OperarioDashboard` si el resultado es `'OPERARIO'`, en cualquier otro caso `<ComingSoon label="Dashboard" />`.
- [x] 2.2 Reemplazar en `src/router/index.tsx` el elemento de la ruta `/dashboard` de `<ComingSoon label="Dashboard" />` a `<DashboardPage />` (sin tocar el `RoleGuard` existente de los 6 roles).

## 3. Widgets de Operario (dashboard-operario-view)

- [x] 3.1 Crear `src/features/dashboard/components/MisQEsWidget.tsx`: recibe `misQEReportados: QEResumen[]`, renderiza `SemaforoRow` (usando `calcularEstadoSemaforoDesdeFecha` sobre `fechaVerificacionProgramada`) solo para QEs con `estado === 'EN_VERIFICACION'` y `fechaVerificacionProgramada` presente; para el resto, fila simple con `QEStatusBadge`. Click navega a `/quality-events/:id`. Maneja lista vacía con mensaje.
- [x] 3.2 Crear `src/features/dashboard/components/MisACsWidget.tsx`: recibe `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, renderiza `SemaforoRow` por cada AC usando `plazoFecha`. Click navega según `origenTipo` (`QE`→`/quality-events/:origenId`, `NC`→`/nonconformities/:origenId`, `INCIDENTE`→`/incidents/:origenId`). Maneja lista vacía con mensaje.
- [x] 3.3 Crear `src/features/dashboard/pages/OperarioDashboard.tsx`: consume `useDashboardSummary()`, muestra skeleton mientras `isLoading`, renderiza botón "Crear nuevo reporte" (→ `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO`), `MisQEsWidget` y `MisACsWidget`.

## 4. i18n

- [x] 4.1 Agregar claves en `src/i18n/es-PE.json` y `src/i18n/en-US.json` bajo el namespace `dashboard` para: título del dashboard de Operario, títulos de ambos widgets, mensajes de lista vacía, y el botón "Crear nuevo reporte".

## 5. Tests

- [x] 5.1 `MisQEsWidget.test.tsx`: cubre fila con semáforo (QE `EN_VERIFICACION` con plazo), fila simple (otros estados), navegación al click, y estado vacío.
- [x] 5.2 `MisACsWidget.test.tsx`: cubre navegación correcta para los 3 valores de `origenTipo` y estado vacío.
- [x] 5.3 `OperarioDashboard.test.tsx`: cubre estado de carga, render de ambos widgets con datos de `useDashboardSummary` mockeado, y el link de "Crear nuevo reporte" con el query param correcto.
- [x] 5.4 `DashboardPage.test.tsx`: cubre que `OPERARIO` renderiza `OperarioDashboard` y que otro rol (p.ej. `SUPERVISOR`) renderiza `<ComingSoon>`.

## 6. Verificación manual

- [x] 6.1 Con `VITE_ENABLE_MSW=true`, loguear como un usuario `OPERARIO` con QEs y ACs asignadas en los fixtures, confirmar ambos widgets, el semáforo condicionado, y las 3 navegaciones (crear reporte, detalle de QE, detalle de origen de AC) en light y dark mode.
- [x] 6.2 Loguear como `SUPERVISOR` y confirmar que `/dashboard` sigue mostrando el placeholder "Próximamente" sin errores.
