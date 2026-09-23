## Context

`useNotifications()` (`shc-controldoc/src/features/notifications/hooks/useNotifications.ts`) tiene cero `refetchInterval` hoy, y el backend real (`be-notifications-api`, cutover-eado 2026-09-22) no tiene ningún canal de push — solo 3 endpoints REST (`GET /api/notifications`, `PATCH .../leida`, `PATCH .../marcar-todas-leidas`). El único disparador de toast (`useNotificationToast.ts`) solo detecta notificaciones creadas dentro de la misma pestaña, por diseño (diffing de `createdAt` sobre los datos que ya trajo el propio fetch del usuario actual).

Los dos tipos urgentes (`SEVERIDAD_CRITICA`, `CIERRE`) se generan hoy exclusivamente desde `QualityEventNotificationSender` (`ShcMvpEndPoint/Features/QualityEvents/Shared/QualityEventNotificationSender.cs`). Ese archivo expone 3 métodos públicos (`NotificarSeveridadCriticaAsync`, `NotificarCierreAsync`, `NotificarVerificacionEfectivaAsync`) que **todos** delegan en un único helper privado, `NotificarPorRolAsync`, el cual resuelve destinatarios vía `RolNotificationHelper.ResolverDestinatariosPorRolAsync`, arma las filas `Notificacion` en memoria y llama `SaveChangesAsync` una sola vez. No son 3 call sites independientes con su propio acceso a datos — son 3 wrappers delgados sobre el mismo bucle de persistencia, parametrizado por `NotificacionTipo`.

## Goals / Non-Goals

**Goals:**
- Push real vía SignalR para `SEVERIDAD_CRITICA`/`CIERRE`, entregado solo al usuario destinatario (grupo `usuario-{usuarioId}`), autenticado por JWT.
- Polling de 60s en `useNotifications()` para los 5 tipos restantes, y como red de respaldo si el hub se desconecta.
- Cero duplicación de toast entre el hub y el heurístico de diffing existente.
- Cerrar el Open Question de `cutover-notificaciones` con una decisión de producto ya tomada (push + polling, no una u otra).

**Non-Goals:**
- No se construye un mecanismo de recuperación de mensajes perdidos durante una desconexión (tipo `Last-Event-Id`) — el polling de 60s es la mitigación aceptada.
- No se agrega push para los otros 5 tipos de notificación (`CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`) ni para disparadores fuera de QE (No Conformidades, Incidentes, Documentos) — hoy ninguno emite `SEVERIDAD_CRITICA`/`CIERRE`, y si alguno empezara a hacerlo en el futuro sería una extensión de este mismo mecanismo, no un rediseño.
- No se resuelve el edge case de multi-empresa-multi-pestaña salvo documentarlo (ver Open Questions) — no tiene caso de uso confirmado hoy.
- No se agregan tests de integración `TestServer` + `HubConnection` real (ver D5) — se documenta la decisión, no se construye el arnés.

## Decisions

### D1 — El push se dispara dentro de `NotificarPorRolAsync`, no duplicado en los 2 métodos públicos urgentes

La instrucción original asumía 2 call sites independientes a modificar (`NotificarSeveridadCriticaAsync`/`NotificarCierreAsync`). El código real tiene un único helper compartido por los 3 tipos de QE. Duplicar la lógica de push en cada método público que delega en `NotificarPorRolAsync` violaría DRY sin necesidad — el helper ya conoce el `NotificacionTipo` de cada llamada y ya tiene el bucle de `destinatarios` completo.

**Decisión**: `NotificarPorRolAsync` recibe `IHubContext<NotificationsHub>` (inyectado en el constructor de `QualityEventNotificationSender`, junto a `ShacDbContext db`). El bucle existente construye la lista de `Notificacion` en memoria como hoy; después de `await db.SaveChangesAsync(ct)`, un `if (tipo is NotificacionTipo.SEVERIDAD_CRITICA or NotificacionTipo.CIERRE)` itera esa misma lista y llama `hubContext.Clients.Group($"usuario-{n.UsuarioId}").SendAsync("notificacionNueva", n, ct)` por cada notificación creada — reutilizando la entidad `Notificacion` ya poblada (mismo shape que devuelve `GET /api/notifications`, sin DTO nuevo). `NotificarVerificacionEfectivaAsync` sigue pasando por el mismo helper sin cambios de comportamiento: su `tipo` (`VERIFICACION_EFICAZ`) simplemente no entra en el filtro, así que nunca dispara el hub.

**Alternativa descartada**: exponer un método público nuevo (`NotificarPorRolConPushAsync`) y solo llamarlo desde los 2 métodos urgentes, dejando `NotificarPorRolAsync` intacto. Se descarta porque duplica el bucle de persistencia y el riesgo de que alguien agregue un push urgente nuevo sin darse cuenta de que existen dos caminos.

### D2 — El payload del hub es la entidad `Notificacion`, no un DTO nuevo

`ListarNotificacionesHandler` ya serializa `Notificacion` (vía Dapper, columnas mapeadas 1:1) directamente como respuesta REST, con `ConfigureHttpJsonOptions` aplicando camelCase + `JsonStringEnumConverter`. El hub reutiliza la misma clase de entidad como payload de `SendAsync`, configurando `AddSignalR().AddJsonProtocol(...)` con la misma `PropertyNamingPolicy`/`JsonStringEnumConverter` (sin naming policy propia para los enums — viajan como literal string, igual que en REST). Esto garantiza que el frontend reciba exactamente el mismo shape por los dos canales, sin mantener dos contratos en paralelo.

**Alternativa descartada**: un DTO de push reducido (solo campos necesarios para el toast). Se descarta porque el frontend ya inserta la notificación completa en el cache de TanStack Query (`setQueryData`) — necesita el objeto `Notificacion` completo para que la lista quede consistente con lo que un refetch normal traería.

### D3 — Autenticación del hub: token JWT por query string, mismo `TokenValidationParameters`

Un `HubConnection` de navegador no puede mandar el header `Authorization` en el handshake inicial. Se agrega un `OnMessageReceived` a las `JwtBearerOptions` ya configuradas en `ServiceCollectionExtensions.AddInfrastructure` (`services.AddOptions<JwtBearerOptions>(...)`, línea ~57), que lee `?access_token=` solo cuando el path empieza con `/hubs/notifications` — no se toca la validación para el resto de los endpoints REST.

**Alternativa descartada**: un esquema de autenticación separado para el hub. Se descarta porque duplicaría `TokenValidationParameters` y el riesgo de que diverja de la validación REST ya en producción.

### D4 — Reconciliación hub-vs-polling: el hub es la única fuente de toast para los 2 tipos urgentes

Ver riesgo detallado abajo. El hub, al recibir `"notificacionNueva"`, hace `queryClient.setQueryData` + `toast()` inmediato, y marca ese `createdAt`/`id` como visto en el mismo `lastSeenCreatedAtRef` que usa `useNotificationToast.ts`. El heurístico de polling existente sigue intacto para los otros 5 tipos y como red de respaldo si el hub estuvo desconectado (en ese caso, el siguiente refetch de 60s SÍ lo toasteará vía el heurístico normal — es el comportamiento de respaldo deseado, no un bug).

**Alternativa descartada**: desactivar el heurístico de polling por completo para `SEVERIDAD_CRITICA`/`CIERRE` y confiar 100% en el hub. Se descarta porque elimina la red de respaldo ante una desconexión del hub — exactamente el escenario que el polling de 60s está para cubrir.

**Nota (descubierta durante la verificación, no un cambio de este proposal):** `FirmarCierreQEHandler` solo llama `NotificarCierreAsync` cuando `qe.Severidad is ALTA or CRITICA` (línea ~101) — un QE de severidad `MEDIA`/`BAJA` se cierra sin generar ninguna notificación `CIERRE`, con o sin hub. Comportamiento preexistente, no introducido por este change, pero documentado aquí porque cualquier verificación manual futura de "el cierre no dispara push" debe primero confirmar la severidad del QE de prueba antes de sospechar del hub — el primer intento de `NotificationsHubPushTests.CierreDeQE_...` falló exactamente por este motivo (QE sembrado con la severidad `MEDIA` por defecto del seeder).

### D5 — Sin test de integración `TestServer` + `HubConnection` real; dos niveles de verificación en su lugar

Un hub de SignalR requiere un cliente WebSocket real para probarse de punta a punta; el valor de construir un arnés `TestServer` + `HubConnection` (.NET) permanente para un solo hub con 2 tipos de mensaje no justifica el esfuerzo en este change. En su lugar, la verificación usa dos niveles complementarios:

1. **Transporte real, una vez, manual** (no automatizado, no queda en el repo como test): dos sesiones autenticadas contra el backend dev corriendo de verdad — una conectada al hub como `dash.altadireccion.qa@shac.dev` (WebSocket crudo hablando el protocolo JSON de SignalR, sin instalar el cliente `@microsoft/signalr` en Node solo para un script puntual), otra generando un QE `CRITICA` como `dash.jefecalidad.qa@shac.dev` vía API directa — confirma que negotiate, el auth por query string (D3), el `AddJsonProtocol` (D2) y el filtro de tipo (D1) funcionan juntos de punta a punta contra Postgres real. Metodología y resultado documentados en `tasks.md`.
2. **Filtro de tipo, permanente, en el repo** (`ShcMvpEndPoint.Tests/Features/Notifications/NotificationsHubPushTests.cs`): sustituye `IHubContext<NotificationsHub>` por un fake que solo captura llamadas (sin WebSocket, sin `HubConnection` real — no contradice la decisión de arriba) para fijar como regresión permanente que `SEVERIDAD_CRITICA`/`CIERRE` disparan el push y `VERIFICACION_EFICAZ` (mismo helper `NotificarPorRolAsync`) no. Este test encontró un comportamiento real no documentado hasta ahora: `NotificarCierreAsync` solo se invoca si `qe.Severidad is ALTA or CRITICA` (ver nota debajo) — sin este nivel de verificación, ese matiz habría quedado sin cubrir.

## Risks / Trade-offs

- **[Riesgo] Duplicar el toast si el hub y el polling ven la misma notificación como "nueva"** → Mitigación: D4 — el hub marca la notificación como vista en el mismo ref que usa el heurístico de polling, apenas la recibe.
- **[Riesgo] Mensajes perdidos durante una desconexión del hub** (`withAutomaticReconnect()` no reentrega mensajes emitidos mientras el cliente estaba caído) → Mitigación aceptada, no resuelta: el polling de 60s recupera cualquier notificación perdida dentro de like máximo 60s de retraso adicional. No se construye un mecanismo de `Last-Event-Id`.
- **[Riesgo] Serialización del hub diverge de REST si `AddJsonProtocol` no se configura explícitamente** (D2) → Mitigación: configurar `AddJsonProtocol` con la misma `PropertyNamingPolicy`/`JsonStringEnumConverter` que `ConfigureHttpJsonOptions`, y verificar explícitamente el shape del payload recibido en la sesión de prueba manual (no asumir que "funciona igual que REST").
- **[Riesgo] Costo de conexiones SignalR persistentes a escala** → No es un problema a la escala actual (empresas QA). Si esto llega a producción con muchos usuarios concurrentes, memoria del proceso y sticky sessions (si hay más de una instancia detrás de un load balancer) son consideraciones de infraestructura — ver Open Questions, no se resuelve en este change.
- **[Riesgo] Multi-empresa-multi-pestaña**: el grupo del hub es por `usuarioId`, no por `empresaId`. Si un usuario tiene dos pestañas con empresas activas distintas, ambas reciben el mismo push sin filtrar por empresa activa de esa pestaña específica → Mitigación: no se resuelve en este change (no hay caso de uso confirmado); documentado como Open Question de escalamiento/edge case.

## Migration Plan

1. Backend: agregar `AddSignalR().AddJsonProtocol(...)`, `MapHub<NotificationsHub>("/hubs/notifications")`, el `OnMessageReceived` en `JwtBearerOptions`, y el `NotificationsHub` nuevo.
2. Backend: inyectar `IHubContext<NotificationsHub>` en `QualityEventNotificationSender` y extender `NotificarPorRolAsync` (D1).
3. Frontend: agregar `@microsoft/signalr`, `src/lib/notificationsHub.ts`, `useNotificationsHub()`, montarlo en `NotificationBell.tsx` (mismo lugar donde hoy vive `useNotificationToast()`).
4. Frontend: `refetchInterval: 60_000` en `useNotifications()`; reconciliación en `useNotificationToast.ts` (D4); reescribir su comentario.
5. Verificación manual de punta a punta (D5); documentar metodología y resultado en `tasks.md`.
6. Rollback: revertir el commit — no hay migración de datos ni cambio de contrato REST existente, el hub es aditivo.

## Open Questions

- Escalamiento de conexiones SignalR persistentes a producción (memoria del proceso, sticky sessions detrás de un load balancer con más de una instancia) — no bloquea este change, decisión de infraestructura futura.
- Si el escenario multi-empresa-multi-pestaña resulta tener un caso de uso real, decidir si el grupo del hub debe incluir `empresaId` (`usuario-{usuarioId}-empresa-{empresaId}`) — no se resuelve aquí por falta de caso de uso confirmado.
