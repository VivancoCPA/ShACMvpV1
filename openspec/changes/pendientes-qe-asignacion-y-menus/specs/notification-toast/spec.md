## ADDED Requirements

### Requirement: Notificaciones nuevas detectadas por polling invalidan las queries de su entidad
Cuando el heurístico same-session de `useNotificationToast()` detecta notificaciones nuevas para el usuario actual en un refetch de `useNotifications()`, el sistema SHALL, además del toast, invalidar las queries de la entidad referida mediante el mismo helper que usa el hub (`invalidarQueriesDeEntidad`): para `entidadTipo === 'QE'`, `['quality-events', 'list']` y `QE_QUERY_KEYS.detail(entidadId)`; para `'DOCUMENTO'`, `documents.detail(entidadId)` y `documents.all`. Esto cubre las notificaciones no urgentes (p.ej. `ASIGNACION` de responsable de investigación) que nunca llegan por SignalR, para que el pendiente del dashboard aparezca a la vez que la notificación. La carga inicial (baseline) NO SHALL disparar invalidaciones.

#### Scenario: Asignación recibida por polling refresca la lista de QE
- **WHEN** un refetch de `useNotifications()` trae una notificación nueva con `entidadTipo: 'QE'` para el usuario actual
- **THEN** se invalidan `['quality-events', 'list']` y el detalle de ese QE

#### Scenario: La carga inicial no invalida
- **WHEN** `useNotifications()` resuelve por primera vez en la sesión
- **THEN** no se invalida ninguna query de entidad
