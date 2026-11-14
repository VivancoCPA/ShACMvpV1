## MODIFIED Requirements

### Requirement: AuditorDashboard compone los 4 widgets de auditoría
El componente `AuditorDashboard` (`src/features/dashboard/pages/AuditorDashboard.tsx`) SHALL consumir `useDashboardSummary()` y componer `DashboardLayout` así, sin zona de indicadores ni de mapa:
- **alertas**:
  - "Verificaciones asignadas pendientes" (`verificaciones`; warning; selectora): `valor` = `filtrarAccionesPorTipo(items, ['QE_VERIFICAR']).length`, con los `items` de `useAccionesRequeridas()`, que ya vienen filtrados por `auditorAsignadoId`. Al hacer clic, filtra `AccionesRequeridasWidget` con ese tipo y muestra el chip.
  - "Hallazgos abiertos" (info; enlace): `valor` = la suma de `hallazgosPorEstado` sin `CERRADO` ni `VERIFICADO`; lleva a `/quality-events?origen=O3_HALLAZGO_AUDITORIA`.
- **trabajoPrincipal:** `AccionesRequeridasWidget` (`id="acciones-requeridas"`) y `HallazgosPorEstadoWidget`.
- **trabajoLateral:** `HallazgosPorNormaWidget`, `EvidenciasHallazgosWidget` y `TasaCierrePorAreaWidget`. Este último es una lista por área, no un indicador con meta (ver `design.md` D7 de `dashboard-layout-4-zonas`).

Mientras `isLoading` es verdadero o `data.rol !== 'AUDITOR'`, las zonas que dependen del summary SHALL mostrar `WidgetSkeleton`, sin bloquear `AccionesRequeridasWidget`.

#### Scenario: Carga muestra skeletons
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `AuditorDashboard` renderiza `WidgetSkeleton` en lugar de los 4 widgets de datos

#### Scenario: Datos cargados renderizan los 4 widgets en sus zonas
- **WHEN** `useDashboardSummary()` resuelve con `{ rol: 'AUDITOR', data }`
- **THEN** `HallazgosPorEstadoWidget` está en la columna principal, y `HallazgosPorNormaWidget`, `EvidenciasHallazgosWidget` y `TasaCierrePorAreaWidget` en la lateral, en ese orden

#### Scenario: Hallazgos abiertos excluye cerrados y verificados
- **WHEN** `hallazgosPorEstado` es `{ ABIERTO: 2, EN_EJECUCION: 1, CERRADO: 4, VERIFICADO: 3 }` (y el resto en 0)
- **THEN** la alerta "Hallazgos abiertos" muestra `3`

#### Scenario: Verificaciones filtra la lista con el mismo número
- **WHEN** `useAccionesRequeridas` devuelve 2 ítems `QE_VERIFICAR` y 1 `AC_EJECUTAR`, y el usuario hace clic en "Verificaciones asignadas pendientes"
- **THEN** la tarjeta muestra `2`, y `AccionesRequeridasWidget` muestra exactamente 2 filas con el chip
