## Why

`cutover-notificaciones` (archivado 2026-09-22) dejó documentado como Open Question que una notificación generada para otro usuario solo se ve en su próximo fetch manual — `useNotifications()` no tiene `refetchInterval` y el backend real no tiene ningún mecanismo de push. Toño ya decidió la resolución: push real (SignalR) para los dos tipos urgentes (`SEVERIDAD_CRITICA`, `CIERRE`) y polling liviano para el resto, en vez de construir un hub de propósito general para casos que, por definición, no son urgentes.

## What Changes

- Backend: agregar `Microsoft.AspNetCore.SignalR` (ya incluido en el shared framework, sin paquete NuGet nuevo), un `NotificationsHub` autenticado por JWT (token en query string, único mecanismo viable para un `HubConnection` de navegador) que agrupa conexiones por `usuario-{usuarioId}`, y disparar `Clients.Group(...).SendAsync("notificacionNueva", ...)` únicamente desde `QualityEventNotificationSender.NotificarSeveridadCriticaAsync` y `.NotificarCierreAsync`, después de `SaveChangesAsync` — los únicos dos disparadores reales de esos tipos hoy (confirmado, no existe ningún otro call site de `NotificacionTipo.CIERRE`/`.SEVERIDAD_CRITICA` en el backend).
- Backend: configurar el protocolo JSON del hub (`AddJsonProtocol`) con la misma `PropertyNamingPolicy`/`JsonStringEnumConverter` que ya usa `ConfigureHttpJsonOptions` para los endpoints REST, para que el payload del hub no diverja en forma del tipo `Notificacion` del frontend.
- Frontend: agregar la dependencia `@microsoft/signalr`, un cliente de hub (`src/lib/notificationsHub.ts`) que reutiliza el `accessToken` de `authStore` (mismo patrón que `lib/axios.ts`), y un hook de ciclo de vida (`useNotificationsHub()`) montado una sola vez que conecta al autenticarse y desconecta en logout.
- Frontend: al recibir `"notificacionNueva"`, insertar la notificación en el cache de TanStack Query (`queryClient.setQueryData` sobre `QUERY_KEYS.notifications.all`) y disparar el toast inmediatamente, sin esperar un refetch.
- Frontend: agregar `refetchInterval: 60_000` a `useNotifications()` — cubre los 5 tipos sin push y sirve de red de respaldo para los 2 urgentes si la conexión del hub se cae.
- Frontend: reconciliar `useNotificationToast.ts` con el hub para no duplicar toasts — el hub pasa a ser la única fuente de toast para `SEVERIDAD_CRITICA`/`CIERRE` (marcando esos `createdAt` como ya vistos en el mismo heurístico de diffing), que se queda como está para los otros 5 tipos y como respaldo si el hub estuvo desconectado.
- Frontend: reescribir el comentario de `useNotificationToast.ts` (corregido en `cutover-notificaciones` para no prometer una resolución inexistente) reflejando el estado final: push real para 2 tipos, polling de 60s para el resto.

Este change cierra el Open Question dejado abierto en `cutover-notificaciones`: "¿Vale la pena agregar `refetchInterval` ... o se prefiere encarar SignalR/SSE directamente?" — la respuesta es ambas, cada una donde corresponde.

## Capabilities

### New Capabilities
- `notifications-realtime-hub`: Hub de SignalR en el backend (`NotificationsHub`), autenticación JWT por query string, agrupación por usuario, y el disparo de push desde los dos senders de tipos urgentes.
- `notifications-realtime-client`: Cliente de SignalR en el frontend (conexión/reconexión, ciclo de vida atado a la sesión autenticada, inserción en cache de TanStack Query al recibir un evento).

### Modified Capabilities
- `notification-query-hooks`: `useNotifications()` incorpora `refetchInterval: 60_000` (polling liviano), donde antes no existía ningún refetch automático.
- `notification-toast`: el requirement de "no hay push entre sesiones en el entorno mock" deja de ser universal — ahora es cierto solo para los 5 tipos no urgentes (mitigado por el nuevo polling de 60s) y falso para `SEVERIDAD_CRITICA`/`CIERRE` (push real vía hub); se agrega la regla de reconciliación hub-vs-heurístico-de-polling para evitar toasts duplicados.

## Impact

- **Backend** (`ShcMvpEndPoint`): `Program.cs` (`AddSignalR`, `MapHub`, `JwtBearerEvents.OnMessageReceived`), `ShcMvpEndPoint.Infrastructure/Extensions/ServiceCollectionExtensions.cs` (`AddOptions<JwtBearerOptions>`), nuevo `Features/Notifications/Shared/NotificationsHub.cs`, `Features/QualityEvents/Shared/QualityEventNotificationSender.cs` (inyecta `IHubContext<NotificationsHub>`).
- **Frontend** (`shc-controldoc`): `package.json` (+`@microsoft/signalr`), nuevo `src/lib/notificationsHub.ts`, nuevo hook `useNotificationsHub.ts`, punto de montaje cerca de la raíz (mismo lugar que `useNotificationToast()`), `features/notifications/hooks/useNotifications.ts`, `features/notifications/hooks/useNotificationToast.ts`.
- **Sin backend cambios de contrato REST** existentes — los 3 endpoints de `be-notifications-api` no cambian; el hub es un canal adicional, no un reemplazo.
- Cierra el Open Question de `cutover-notificaciones` (`openspec/changes/archive/2026-09-22-cutover-notificaciones/design.md`).
