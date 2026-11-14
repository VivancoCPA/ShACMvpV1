## MODIFIED Requirements

### Requirement: AuditorDashboard compone los 4 widgets de auditoría
El componente `AuditorDashboard` (`src/features/dashboard/pages/AuditorDashboard.tsx`) SHALL consumir `useDashboardSummary()` y componer `DashboardLayout` así (sin zona de indicadores ni de mapa):
- **alertas:** "Verificaciones asignadas pendientes" (warning; ítems `QE_VERIFICAR` de `useAccionesRequeridas`, ya filtrados por `auditorAsignadoId`; `#acciones-requeridas`) y "Hallazgos abiertos" (info; suma de `hallazgosPorEstado` sin `CERRADO` ni `VERIFICADO`; `/quality-events?origen=O3_HALLAZGO_AUDITORIA`);
- **trabajoPrincipal:** `AccionesRequeridasWidget` (`id="acciones-requeridas"`) y `HallazgosPorEstadoWidget`;
- **trabajoLateral:** `HallazgosPorNormaWidget`, `EvidenciasHallazgosWidget` y `TasaCierrePorAreaWidget` (es una lista por área, no un indicador con meta; ver `design.md` D7).

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
