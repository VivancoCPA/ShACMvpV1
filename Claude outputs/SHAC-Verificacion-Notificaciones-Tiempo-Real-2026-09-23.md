# Verificación independiente — Notificaciones en tiempo real (push SignalR + polling liviano)

Fecha: 2026-09-23
Autor: Cowork, releyendo el código real (frontend `shc-controldoc`, backend `.NET`) vía device
bridge — sin confiar en el reporte de Claude Code ni en el de Toño ("listo, implementado"). Resuelve
el Open Question dejado por `cutover-notificaciones`.

**Veredicto: aprobado.** Esta es la implementación más grande de esta serie — infraestructura nueva
(hub de SignalR), no un cutover de contrato — y la verifiqué punto por punto contra el código real,
no contra la prosa de `design.md`. Todo coincide, incluido un hallazgo real que Claude Code
encontró y corrigió durante su propia verificación.

## 1. El change abrió como `notificaciones-real-time` (nombre distinto al que sugerí, sin problema)

Confirmé `openspec/changes/notificaciones-real-time/` — sin archivar, único change pendiente en el
repo. Leí `design.md`/`tasks.md`/`proposal.md` completos.

## 2. Decisión de diseño no anticipada por mí, y correcta: un único helper compartido, no 2 call sites

Mis instrucciones asumían que `NotificarSeveridadCriticaAsync`/`NotificarCierreAsync` eran 2 call
sites independientes a modificar. Confirmé leyendo `QualityEventNotificationSender.cs` que Claude
Code tenía razón en corregirme (D1 de su `design.md`): los 3 métodos públicos (incluido
`NotificarVerificacionEfectivaAsync`) delegan en un único `NotificarPorRolAsync` privado. El fix
real está ahí: acumula las `Notificacion` creadas en una lista, y **después** de
`await db.SaveChangesAsync(ct)`, un filtro `if (tipo is SEVERIDAD_CRITICA or CIERRE)` dispara el
push — nunca antes de persistir. `NotificarVerificacionEfectivaAsync` pasa por el mismo helper sin
ningún cambio de código propio y queda afuera del push solo porque su `tipo` no matchea el filtro —
exactamente como se documentó, confirmado leyendo el archivo completo.

## 3. Los tres puntos "no obvios" que marqué en las instrucciones — los tres resueltos correctamente

- **Autenticación del hub por query string**: releí `ServiceCollectionExtensions.cs` — el
  `OnMessageReceived` está agregado dentro del mismo `AddOptions<JwtBearerOptions>()` existente
  (no duplicado), acepta `?access_token=` únicamente cuando el path empieza con
  `/hubs/notifications`, sin tocar la validación de los endpoints REST.
- **Serialización del hub**: releí `Program.cs` — `AddSignalR().AddJsonProtocol(...)` configura
  explícitamente la misma `PropertyNamingPolicy` (camelCase) y `JsonStringEnumConverter` que
  `ConfigureHttpJsonOptions` ya usa para REST. Sin esto, el payload del hub hubiera divergido en
  forma del contrato REST — está resuelto, no asumido.
- **Grupo por usuario, scoping multi-tenant**: `NotificationsHub.OnConnectedAsync` agrega la
  conexión a `usuario-{usuarioId}` (leído de `Context.User.GetUsuarioId()`, misma extensión que ya
  usan los endpoints REST) — confirmado en el archivo real. El push nunca cruza empresas porque
  `destinatarios` ya viene acotado por `empresaId` desde `RolNotificationHelper`, sin cambios ahí.

## 4. El hallazgo real de esta implementación — verificado, no solo leído en la prosa

`design.md` documenta que `FirmarCierreQEHandler` solo dispara `NotificarCierreAsync` para
severidad `ALTA`/`CRITICA`, y que el primer intento de test falló porque el seeder por defecto usa
`MEDIA`. Confirmé esto leyendo `NotificationsHubPushTests.cs` completo: el test
`CierreDeQE_SegundaFirma_DisparaPushCierreAlJefeDeCalidad` siembra explícitamente
`severidad: QESeveridad.ALTA` con un comentario que documenta exactamente esa causa raíz — no es
solo una afirmación en `design.md`, está reflejada en el propio código del test como nota
permanente para quien lo lea después.

Los tres tests de `NotificationsHubPushTests.cs` están completos y hacen lo que dicen: uno confirma
que `SEVERIDAD_CRITICA` dispara el push al grupo correcto del destinatario (con
`NotificationsHub.GrupoUsuario(...)`, no un string hardcodeado), otro confirma `CIERRE` tras la
firma dual real (dos firmas, dos roles), y el tercero confirma que `VERIFICACION_EFICAZ` —mismo
helper compartido— nunca dispara nada (`Assert.Empty(Hub.Sent)`). Los tres usan un
`IHubContext<NotificationsHub>` sustituido por un fake real (`FakeNotificationsHubContext`,
confirmé que existe en el mismo directorio), no un mock superficial.

## 5. Regresión real encontrada y corregida — confirmada en el código, no solo en el reporte

`tasks.md` 6.1 reporta que la primera corrida completa de `vitest` rompió 12 tests de rutas no
relacionadas a Notificaciones, porque `HubConnectionBuilder.build()` revienta de forma síncrona con
`VITE_API_BASE_URL` vacío (el estado normal de `.env.development` en desarrollo puro contra MSW).
Confirmé el fix leyendo `useNotificationsHub.ts`: el guard
`if (!isAuthenticated || !import.meta.env.VITE_API_BASE_URL) return` está ahí, con el comentario
explicando exactamente esa causa raíz, más `connection.start().catch(() => {})` para que un backend
inalcanzable tampoco deje una promesa sin manejar. Este es precisamente el tipo de hallazgo que
justifica correr la suite completa en vez de solo los archivos tocados — y quedó documentado así en
`tasks.md` para que no se repita el error de alcance en un cierre futuro.

## 6. Reconciliación hub/polling — el punto que más marqué como riesgoso, verificado en el código real

Confirmé el mecanismo completo: `useNotificationToast()` ahora devuelve un `NotificationToastHandle`
con `markSeen(createdAt)`, memoizado (`useCallback`/`useMemo`, evita reconexiones del hub en cada
render). `useNotificationsHub()` recibe ese handle, y en el evento `"notificacionNueva"` hace tres
cosas en orden correcto: inserta la notificación en el cache de TanStack Query
(`setQueryData`, prepend), llama `toastHandle.markSeen(...)` **antes** de reflejarse en el próximo
poll, y recién ahí dispara el `toast()`. El heurístico de diffing de `useNotificationToast.ts` queda
intacto para los otros 5 tipos y como respaldo si el hub estuvo caído — confirmado leyendo el
archivo completo, con su comentario de cabecera reescrito reflejando el estado final real (ya no
promete nada que el código no cumpla, coincide con lo pedido).

## 7. Resto del contrato — verificado por lectura directa

- `NotificationBell.tsx`: llama `useNotificationsHub(toastHandle)` una sola vez, con el `toastHandle`
  de `useNotificationToast()` — wiring mínimo, sin clases Tailwind nuevas, coincide con lo reportado.
- `package.json`: `@microsoft/signalr` agregado como dependencia real (no devDependency).
- `useNotifications.ts`: `refetchInterval: 60_000` presente.
- `Program.cs`: `app.MapHub<NotificationsHub>("/hubs/notifications").RequireAuthorization();`
  registrado junto a `MapFeatureEndpoints()`.
- `.env.development`: revertido (`VITE_API_BASE_URL=`, `VITE_ENABLE_MSW=true`), confirmado leyendo
  el archivo.

## 8. Lo que no re-verifiqué, y por qué no bloquea el cierre

No repetí la prueba de transporte real (WebSocket crudo hablando el protocolo de SignalR) que
`tasks.md` documenta en la sección 5.1-5.2 — es una verificación manual, puntual, no reproducible
sin volver a levantar el backend dev y generar un QE real. Confío en el nivel 2 (los 3 tests
automatizados de `NotificationsHubPushTests.cs`, que sí releí completos) como la garantía
permanente de que el filtro de tipo funciona — el nivel 1 solo demostró que el transporte end-to-end
(negotiate, auth por query string, JSON protocol) funciona contra Postgres real una vez, que es
exactamente lo que un test automatizado no puede cubrir sin el arnés `TestServer`+`HubConnection`
que D5 decidió no construir, con una justificación que me parece razonable para el tamaño de este
change.

## Conclusión

Con esto se cierra el último Open Question activo del roadmap de cutover (el de notificaciones en
tiempo real) — solo queda pendiente el Open Question de hosting/dominio de producción heredado de
`cutover-auth`, que dijiste que se deja para el final, y el nuevo Open Question de escalamiento de
conexiones SignalR persistentes en producción (memoria del proceso, sticky sessions con más de una
instancia detrás de un load balancer) que `design.md` dejó explícitamente para más adelante. Te
recomiendo archivar `notificaciones-real-time` cuando quieras — no encontré ningún motivo para
retenerlo.
