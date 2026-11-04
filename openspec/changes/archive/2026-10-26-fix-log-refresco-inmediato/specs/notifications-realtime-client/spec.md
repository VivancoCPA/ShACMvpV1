## MODIFIED Requirements

### Requirement: Evento recibido actualiza el cache y notifica antes que cualquier refetch
Al recibir `"notificacionNueva"`, el sistema SHALL (a) insertar la notificación en el cache de TanStack Query vía `queryClient.setQueryData` sobre `QUERY_KEYS.notifications.all`, y (b) disparar un Sonner `toast()` con su `mensaje`, ambos de forma inmediata — sin esperar el próximo refetch de `useNotifications()`.

**fix-log-refresco-inmediato:** cuando `notificacion.entidadTipo === 'DOCUMENTO'`, el sistema SHALL además invalidar `documents.detail(notificacion.entidadId)` y `documents.all` — para que una acción de otro usuario sobre ese documento (p.ej. el revisor aprueba mientras el autor tiene el detalle abierto) se refleje sin recargar la página. Otros valores de `entidadTipo` (`QE`, `NC`, `INCIDENTE`, `AC`) quedan fuera de alcance de este requirement.

#### Scenario: Recepción de push inserta en cache sin esperar refetch
- **WHEN** el hub emite `"notificacionNueva"` para el usuario actual
- **THEN** `QUERY_KEYS.notifications.all` refleja la nueva notificación en el cache inmediatamente, antes de que ocurra cualquier refetch programado

#### Scenario: Recepción de push dispara el toast inmediatamente
- **WHEN** el hub emite `"notificacionNueva"` para el usuario actual
- **THEN** se muestra un Sonner `toast()` con el `mensaje` de esa notificación, en el momento de la recepción

#### Scenario: Notificación sobre un documento invalida su detalle
- **WHEN** el hub emite `"notificacionNueva"` con `entidadTipo: 'DOCUMENTO'` y `entidadId: <id>`
- **THEN** `documents.detail(<id>)` y `documents.all` se invalidan

#### Scenario: Notificación sobre otra entidad no invalida documents
- **WHEN** el hub emite `"notificacionNueva"` con `entidadTipo` distinto de `'DOCUMENTO'`
- **THEN** ninguna query de `documents` se invalida como consecuencia de ese evento
