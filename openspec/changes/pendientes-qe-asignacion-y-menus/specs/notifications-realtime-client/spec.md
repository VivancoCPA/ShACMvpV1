## MODIFIED Requirements

### Requirement: Evento recibido actualiza el cache y notifica antes que cualquier refetch
Al recibir `"notificacionNueva"`, el sistema SHALL (a) insertar la notificación en el cache de TanStack Query vía `queryClient.setQueryData` sobre `QUERY_KEYS.notifications.all`, y (b) disparar un Sonner `toast()` con su `mensaje`, ambos de forma inmediata — sin esperar el próximo refetch de `useNotifications()`.

**fix-log-refresco-inmediato:** cuando `notificacion.entidadTipo === 'DOCUMENTO'`, el sistema SHALL además invalidar `documents.detail(notificacion.entidadId)` y `documents.all` — para que una acción de otro usuario sobre ese documento (p.ej. el revisor aprueba mientras el autor tiene el detalle abierto) se refleje sin recargar la página.

**pendientes-qe-asignacion-y-menus:** cuando `notificacion.entidadTipo === 'QE'`, el sistema SHALL invalidar `['quality-events', 'list']` y `QE_QUERY_KEYS.detail(notificacion.entidadId)`, para que los pendientes de "Acciones requeridas" se actualicen a la vez que la notificación. Ambas invalidaciones viven en un helper compartido (`invalidarQueriesDeEntidad`) que también usa la ruta de polling (`notification-toast`). Otros valores de `entidadTipo` (`NC`, `INCIDENTE`, `AC`) quedan fuera de alcance.

#### Scenario: Recepción de push inserta en cache sin esperar refetch
- **WHEN** el hub emite `"notificacionNueva"` para el usuario actual
- **THEN** `QUERY_KEYS.notifications.all` refleja la nueva notificación en el cache inmediatamente, antes de que ocurra cualquier refetch programado

#### Scenario: Recepción de push dispara el toast inmediatamente
- **WHEN** el hub emite `"notificacionNueva"` para el usuario actual
- **THEN** se muestra un Sonner `toast()` con el `mensaje` de esa notificación, en el momento de la recepción

#### Scenario: Notificación sobre un documento invalida su detalle
- **WHEN** el hub emite `"notificacionNueva"` con `entidadTipo: 'DOCUMENTO'` y `entidadId: <id>`
- **THEN** `documents.detail(<id>)` y `documents.all` se invalidan

#### Scenario: Notificación sobre un QE invalida la lista y el detalle de QE
- **WHEN** el hub emite `"notificacionNueva"` con `entidadTipo: 'QE'` y `entidadId: <id>`
- **THEN** `['quality-events', 'list']` y `QE_QUERY_KEYS.detail(<id>)` se invalidan, y ninguna query de `documents`

#### Scenario: Notificación sobre otra entidad no invalida documents
- **WHEN** el hub emite `"notificacionNueva"` con `entidadTipo` distinto de `'DOCUMENTO'`
- **THEN** ninguna query de `documents` se invalida como consecuencia de ese evento
