# Spec: notifications-realtime-client

## Purpose

Frontend SignalR client (`useNotificationsHub()`) that connects to `NotificationsHub` while authenticated, keeps TanStack Query's notifications cache and the toast pipeline in sync with pushed `SEVERIDAD_CRITICA`/`CIERRE` notifications, and reconnects automatically after a transient disconnect.

---

## Requirements

### Requirement: Conexión única de SignalR atada a la sesión autenticada
El sistema SHALL exponer un hook `useNotificationsHub()`, montado una sola vez (en `NotificationBell.tsx`, junto a `useNotificationToast()`), que conecta una `HubConnection` de `@microsoft/signalr` a `/hubs/notifications` cuando `isAuthenticated` pasa a `true`, usando `accessTokenFactory: () => useAuthStore.getState().accessToken ?? ''` (mismo patrón de lectura de token que `lib/axios.ts`), y desconecta explícitamente en `logout`.

#### Scenario: Login establece la conexión
- **WHEN** un usuario completa el login y `isAuthenticated` pasa a `true`
- **THEN** se abre una `HubConnection` a `/hubs/notifications` con el `accessToken` actual

#### Scenario: Logout cierra la conexión
- **WHEN** el usuario hace logout
- **THEN** la `HubConnection` se detiene explícitamente, sin dejar una conexión huérfana

#### Scenario: Una sola conexión por sesión de pestaña
- **WHEN** `NotificationBell` se re-renderiza múltiples veces durante la misma sesión autenticada
- **THEN** no se abre más de una `HubConnection` activa simultánea para esa pestaña

### Requirement: Reconexión automática
El sistema SHALL configurar la `HubConnection` con `withAutomaticReconnect()`, de forma que una caída de red transitoria no requiera que el usuario recargue la página para volver a recibir push.

#### Scenario: La conexión se recupera tras una caída transitoria
- **WHEN** la conexión del hub se pierde momentáneamente y la red se restablece
- **THEN** el cliente reconecta automáticamente sin intervención del usuario, y sin perder la sesión autenticada

### Requirement: Evento recibido actualiza el cache y notifica antes que cualquier refetch
Al recibir `"notificacionNueva"`, el sistema SHALL (a) insertar la notificación en el cache de TanStack Query vía `queryClient.setQueryData` sobre `QUERY_KEYS.notifications.all`, y (b) disparar un Sonner `toast()` con su `mensaje`, ambos de forma inmediata — sin esperar el próximo refetch de `useNotifications()`.

#### Scenario: Recepción de push inserta en cache sin esperar refetch
- **WHEN** el hub emite `"notificacionNueva"` para el usuario actual
- **THEN** `QUERY_KEYS.notifications.all` refleja la nueva notificación en el cache inmediatamente, antes de que ocurra cualquier refetch programado

#### Scenario: Recepción de push dispara el toast inmediatamente
- **WHEN** el hub emite `"notificacionNueva"` para el usuario actual
- **THEN** se muestra un Sonner `toast()` con el `mensaje` de esa notificación, en el momento de la recepción
