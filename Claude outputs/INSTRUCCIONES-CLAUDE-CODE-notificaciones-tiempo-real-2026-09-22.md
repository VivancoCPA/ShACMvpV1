# Instrucciones para Claude Code — Notificaciones en tiempo real (push urgente + polling liviano)

Fecha: 2026-09-22
Autor: Cowork, tras investigar el código real (frontend `shc-controldoc`, backend `.NET`) vía
device bridge. Resuelve el Open Question que quedó abierto en `cutover-notificaciones`: cómo se
enteran los usuarios de una notificación que no generaron ellos mismos.

**Decisión ya tomada por Toño — no se la vuelvas a preguntar**: push real (SignalR) para
`SEVERIDAD_CRITICA`/`CIERRE`, polling liviano (`refetchInterval`) para el resto. Esto es trabajo de
producto nuevo, no un cutover — no hay ningún mismatch de contrato que corregir, se está
construyendo una capacidad que no existía.

## Contexto — por qué esta combinación y no solo una de las dos

Hoy `useNotifications()` no tiene `refetchInterval` y el backend real no tiene ningún mecanismo de
push (confirmado en `cutover-notificaciones`) — una notificación solo se ve la próxima vez que el
usuario interactúa con la app. Verifiqué que **solo dos disparadores** generan los tipos
`SEVERIDAD_CRITICA`/`CIERRE` hoy: `QualityEventNotificationSender.NotificarSeveridadCriticaAsync`
y `.NotificarCierreAsync` (`Features/QualityEvents/Shared/QualityEventNotificationSender.cs`) — no
existe ningún disparador de estos dos tipos en No Conformidades ni Incidentes (confirmé por grep en
todo `ShcMvpEndPoint` que `NotificacionTipo.CIERRE`/`.SEVERIDAD_CRITICA` solo aparecen en ese
archivo). Los otros 5 tipos (`CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `VERIFICACION_EFICAZ`,
`COMERCIO_EXTERIOR`) siguen con polling — no justifican la complejidad de un hub para casos que no
son, por definición, urgentes.

## 1. Backend — hub de SignalR, exclusivo para los 2 tipos urgentes

- **Agregar SignalR**: `Microsoft.AspNetCore.SignalR` ya viene en el shared framework de ASP.NET
  Core (`Microsoft.NET.Sdk.Web`) — no hace falta ningún paquete NuGet nuevo en
  `ShcMvpEndPoint.csproj`. `builder.Services.AddSignalR();` en `Program.cs`.
- **Hub nuevo**: `NotificationsHub` (sugiero `Features/Notifications/Shared/NotificationsHub.cs`,
  mismo namespace que `RolNotificationHelper`/`VencimientoScanner`), decorado `[Authorize]`.
  `OnConnectedAsync` agrega la conexión a un grupo `$"usuario-{usuarioId}"` (leído de
  `Context.User.GetUsuarioId()`, misma extensión que ya usan los endpoints REST) — esto soporta
  múltiples pestañas/dispositivos del mismo usuario sin trabajo adicional (SignalR permite N
  conexiones por grupo).
- **Registro de ruta**: `app.MapHub<NotificationsHub>("/hubs/notifications").RequireAuthorization();`
  en `Program.cs`, junto a `app.MapFeatureEndpoints()`.
- **Autenticación JWT sobre el hub — punto no obvio, no te lo saltees**: un `HubConnection` del
  navegador (WebSocket o SSE, según lo que negocie SignalR) no puede mandar el header
  `Authorization`. El cliente JS le pasa el token como query string
  (`?access_token=...`, convención estándar de `@microsoft/signalr`), y el backend necesita
  aceptarlo ahí — agregá un `OnMessageReceived` a las `JwtBearerOptions` ya configuradas en
  `ServiceCollectionExtensions.AddInfrastructure` (dentro del mismo `AddOptions<JwtBearerOptions>()`
  que ya está ahí, para no duplicar el `TokenValidationParameters`):
  ```csharp
  options.Events = new JwtBearerEvents
  {
      OnMessageReceived = context =>
      {
          var accessToken = context.Request.Query["access_token"];
          var path = context.HttpContext.Request.Path;
          if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/notifications"))
              context.Token = accessToken;
          return Task.CompletedTask;
      },
  };
  ```
  Sin esto, el hub va a rechazar toda conexión con 401 apenas el cliente intente conectar — no es
  opcional.
- **CORS**: ya está bien — `AllowCredentials()` con orígenes explícitos (`Cors:AllowedOrigins`), que
  es requisito de SignalR (no funciona con `AllowAnyOrigin` + credenciales). No toques la política
  existente.
- **Serialización JSON del hub — otro punto no obvio**: `Program.cs` configura camelCase +
  `JsonStringEnumConverter` solo para `ConfigureHttpJsonOptions` (endpoints REST) — eso **no**
  aplica automáticamente al protocolo del hub. Si no lo configurás explícitamente
  (`AddSignalR().AddJsonProtocol(options => { ... misma config ... })`), el payload que le llega al
  frontend por el hub puede no coincidir en casing/forma con lo que espera el tipo `Notificacion`
  del frontend — mismo tipo de mismatch silencioso que este proceso existe para atrapar, pero
  ahora en un canal nuevo. Configuralo con la misma `PropertyNamingPolicy`/`JsonStringEnumConverter`
  que ya usa `ConfigureHttpJsonOptions`, y verificalo explícitamente (no asumas que "ya funciona
  para REST, va a funcionar igual acá").
- **Disparar el push — solo en los 2 métodos que ya emiten estos tipos**: inyectá
  `IHubContext<NotificationsHub>` en `QualityEventNotificationSender` y, dentro de
  `NotificarSeveridadCriticaAsync`/`NotificarCierreAsync`, después de `SaveChangesAsync` (no antes —
  solo empujar lo que ya está persistido), iterá `destinatarios` y llamá
  `hubContext.Clients.Group($"usuario-{usuarioId}").SendAsync("notificacionNueva", notificacionDto, ct)`
  para cada uno, con el DTO de la notificación recién creada (mismo shape que `Notificacion`
  frontend). No toques `NotificarVerificacionEfectivaAsync` (tipo `VERIFICACION_EFICAZ`, no es de
  los 2 urgentes) ni ningún otro sender — se quedan solo con polling.
- **Multi-tenancy**: no hace falta ningún filtro adicional — `destinatarios` ya viene acotado por
  `empresaId` desde `RolNotificationHelper.ResolverDestinatariosPorRolAsync`, así que el push nunca
  cruza empresas. El grupo del hub es por `usuarioId`, no por `empresaId` — si un usuario tiene
  sesión abierta en dos pestañas con empresas activas distintas (¿es posible en esta app? confirmalo
  vos, no asumas que no — si sí, documentalo como edge case conocido en `design.md`, no hace falta
  resolverlo en este change si no tiene un caso de uso real hoy).

## 2. Frontend — cliente del hub + polling liviano para todo

- **Dependencia nueva**: `@microsoft/signalr` (no está en `package.json` — confirmé por lectura
  completa que no hay ningún cliente de WebSocket/SignalR instalado hoy).
- **Conexión del hub**: un módulo nuevo (sugiero `src/lib/notificationsHub.ts`) que construya un
  `HubConnection` vía `HubConnectionBuilder().withUrl(`${import.meta.env.VITE_API_BASE_URL}/hubs/notifications`,
  { accessTokenFactory: () => useAuthStore.getState().accessToken ?? '' }).withAutomaticReconnect().build()`
  — mismo patrón de leer el token que ya usa `axios.ts` (`useAuthStore.getState().accessToken`), no
  inventes un mecanismo de auth paralelo.
- **Ciclo de vida — dónde conectar/desconectar**: un hook nuevo (p.ej. `useNotificationsHub()`)
  llamado una sola vez cerca de la raíz (mismo lugar donde hoy vive `useNotificationToast()` —
  revisá `AppShell` o donde sea que se monte `NotificationBell`), que conecta cuando
  `isAuthenticated` pasa a `true` y desconecta en `logout`. No lo llames desde múltiples
  componentes — una sola conexión por sesión de pestaña.
- **Al recibir `"notificacionNueva"`**: dos cosas, no una — (a) `queryClient.setQueryData` sobre
  `QUERY_KEYS.notifications.all` para insertar la notificación al cache inmediatamente (no esperes
  a un refetch), y (b) disparar el toast ahí mismo (`toast(payload.mensaje)`), porque el servidor ya
  te está diciendo con certeza "esto es nuevo" — no hace falta el heurístico de diffing por
  `createdAt` que usa hoy `useNotificationToast.ts`.
- **Reconciliar con `useNotificationToast.ts` — para no toastear dos veces**: hoy ese hook decide
  qué es "nuevo" comparando `createdAt` contra el último visto, dentro de la misma pestaña. Si el
  hub también dispara un toast para la misma notificación, y después el polling la trae de nuevo en
  su próximo refetch, el heurístico de diffing la va a ver como "nueva" otra vez y duplicar el
  toast. Diseñalo así: el hub es la única fuente de toast para `SEVERIDAD_CRITICA`/`CIERRE`
  (marcá esos `createdAt`/`id` como "ya vistos" en el mismo `lastSeenCreatedAtRef` que usa el
  heurístico de polling, para que el próximo refetch no los vuelva a toastear); el heurístico de
  polling existente se queda como está para los otros 5 tipos y como red de respaldo si el hub se
  desconectó momentáneamente. Documentá esta reconciliación explícitamente en `design.md` — es la
  parte con más superficie para un bug sutil de todo este change.
- **Polling liviano para todo**: agregá `refetchInterval: 60_000` (60s, ajustable — no hace falta
  agresividad para tipos no urgentes) a `useNotifications()`. Esto cubre los 5 tipos sin push, y
  además sirve de red de respaldo para los 2 urgentes si la conexión del hub se cae y
  `withAutomaticReconnect()` todavía no reconectó.
- **Actualizar el comentario de `useNotificationToast.ts` una vez más**: ya lo corregiste en
  `cutover-notificaciones` para que no prometiera una resolución que no existía — ahora sí existe
  (parcialmente). Reescribilo para reflejar el estado final: push en tiempo real para
  `SEVERIDAD_CRITICA`/`CIERRE` vía `NotificationsHub`, polling de 60s para el resto, sin dejar
  ninguna promesa que el código no cumpla.

## 3. Riesgos a documentar como Decision en `design.md`, no a resolver en silencio

- **Reconexión y mensajes perdidos**: `withAutomaticReconnect()` de SignalR no garantiza que un
  mensaje enviado mientras el cliente estaba desconectado se entregue al reconectar — se pierde. El
  polling de 60s ya mitiga esto para el caso general, pero documentalo como decisión consciente
  (no construir un mecanismo de "mensajes perdidos" tipo `Last-Event-Id`) en vez de asumir que
  nadie lo va a notar.
- **Costo de conexiones abiertas**: cada usuario autenticado con la app abierta mantiene una
  conexión SignalR persistente al backend. A la escala actual (empresas QA, sin datos de producción
  reales) no es un problema, pero si esto va a producción con muchos usuarios concurrentes, es una
  consideración de infraestructura (memoria del proceso, sticky sessions si algún día hay más de
  una instancia del backend detrás de un load balancer) — dejalo anotado como Open Question de
  escalamiento, no lo resuelvas acá.
- **Tests**: un hub de SignalR es más difícil de testear que un endpoint REST — un test de
  integración real necesitaría `TestServer` + un `HubConnection` de verdad conectándose. Evaluá si
  vale la pena ese esfuerzo para este change o si alcanza con verificar manualmente (dos sesiones
  autenticadas simultáneas, una generando el QE crítico y otra recibiendo el push) — documentá la
  decisión y su razón, no lo dejes sin mencionar.

## 4. Estrategia de verificación

Esta vez **no alcanza con `curl`** como en los cutovers anteriores — un push de SignalR solo se
puede observar con un cliente real conectado. Sin herramienta de navegador disponible en este
entorno (mismo aviso de siempre), vas a necesitar algo como un script/cliente `@microsoft/signalr`
mínimo desde Node, o dos sesiones de navegador manuales tuyas, para conectar como
`dash.altadireccion.qa@shac.dev`, generar un QE `CRITICA` como `dash.jefecalidad.qa@shac.dev` (API
directa), y confirmar que el evento `"notificacionNueva"` llega por el hub, con el shape correcto
(coincide con `Notificacion` del frontend, no solo "algo llegó"). Documentá en `tasks.md` qué
metodología usaste, igual que en los cutovers anteriores.

## 5. Ciclo OpenSpec

Abrí un change nuevo (`notificaciones-tiempo-real`, o el nombre que prefieras — no es un
`cutover-*`, es una capacidad nueva). Documentá como Decision: la reconciliación
push/polling de la Sección 2, el edge case de multi-empresa-multi-pestaña si aplica, y la decisión
de testing de la Sección 3. Este change cierra el Open Question de `cutover-notificaciones` —
mencionalo en el `proposal.md` para que quede trazable.
