## REMOVED Requirements

### Requirement: Indicador de estado de la cola offline en la UI mobile
**Reason**: Este requirement (introducido por `m7-f2-offline-sync`, aún no sincronizado a `openspec/specs/`) describía un banner inline dentro del formulario de reporte de incidentes, visible solo mientras el usuario está en esa vista. Se reemplaza por un indicador global en el header de `MobileShell` (badge + panel de detalle con reintento individual), que cubre el mismo caso y además es visible desde cualquier vista mobile. Mantener ambos indicadores simultáneamente mostraría el mismo contador dos veces en la única vista mobile existente hoy.
**Migration**: El comportamiento equivalente (y ampliado) queda cubierto por la capability `offline-queue-indicator` ("Badge de estado de cola en el header de `MobileShell`" y "Panel de detalle de la cola offline"). El componente `OfflineQueueIndicator.tsx` y su uso en `IncidentQuickReportForm.tsx` se eliminan.

El layout mobile SHALL mostrar un indicador (badge) con la cantidad de reportes pendientes de sincronizar (`pendingCount` de `useOfflineIncidentSync()`) cuando ese valor sea mayor a cero, y SHALL mostrar un botón "Reintentar" cuando exista al menos un reporte en `status: 'error'`.

#### Scenario: Hay reportes pendientes de sincronizar
- **WHEN** hay al menos un reporte con `status: 'pending'` o `'syncing'` en la cola offline
- **THEN** la UI mobile muestra un badge con el conteo de pendientes

#### Scenario: No hay reportes pendientes
- **WHEN** no hay ningún reporte en la cola offline
- **THEN** la UI mobile no muestra el badge de pendientes

#### Scenario: Hay un reporte en error
- **WHEN** al menos un reporte encolado está en `status: 'error'`
- **THEN** la UI mobile muestra un botón "Reintentar" que, al presionarse, invoca `retry()` sobre ese reporte
