## Context

`ShcMvpEndPoint` ya tiene 3 interfaces de notificación inyectadas por DI y ya invocadas desde 6 handlers reales, cada uno con un `TODO` explícito citando este momento — confirmado leyendo las 3 interfaces y sus 6 call sites completos:

- `IIncidenteNotificationSender.NotificarCambioEstadoAsync(IncidenteNotificacionDestinatarios)` — `CambiarEstadoIncidenteHandler.cs:65`, tras cada transición válida de estado. `Destinatarios` ya viene resuelto por el handler: responsables de ACs no `CERRADA` + `ReportadoPorId`, excluyendo al actor, `Distinct()`.
- `INoConformidadNotificationSender` — `NotificarComercioExteriorAsync(NCComercioExteriorNotificacion)` en `CrearNoConformidadHandler.cs:87` (solo si `Dominio == ADUANERO`, fuera de la transacción de creación) y `NotificarCambioEstadoAsync(NCCambioEstadoNotificacion)` en `ActualizarNoConformidadHandler.cs:192` (mismo patrón de destinatarios que Incidente).
- `IQualityEventNotificationSender` — `NotificarSeveridadCriticaAsync(QESeveridadCriticaNotificacion)` en `CrearQualityEventHandler.cs:111` y `EditarSeveridadQEHandler.cs:47` (severidad `CRITICA`); `NotificarCierreAsync(QECierreNotificacion)` en `FirmarCierreQEHandler.cs:104` (severidad `ALTA`/`CRITICA`); `NotificarVerificacionEfectivaAsync(QEVerificacionEfectivaNotificacion)` en `VerificacionEficaciaQEHandler.cs:48` (severidad `ALTA`/`CRITICA`, resultado `EFECTIVO`).

Los 6 call sites ya usan el mismo patrón `try { await notificationSender... } catch (Exception ex) { logger.LogWarning(...) }` — best-effort, nunca bloqueante, confirmado carácter por carácter en cada uno. Las 3 implementaciones registradas hoy (`NoOp*NotificationSender`, `Extensions/EndpointExtensions.cs:249,263,277`) solo hacen `logger.LogInformation` y `Task.CompletedTask`.

**Corrección a la instrucción original**: los registros `Incidente`/`QualityEvent`/`NoConformidad` (`Domain/Entities/*.cs`) tienen `Guid Id` — no `string` — y por separado `string Numero` (el código legible, `"QE-2026-001"`). Las interfaces de notificación ya escritas pasan `entidad.Id.ToString()` como el campo `*Id` de cada record (nunca `Numero`) — es decir, ya codifican un Guid como string, no un id de dominio nativamente string. `Notificacion.EntidadId` debe ser `Guid` (no `string`), y `Notificacion.EntidadCodigo` guarda `Numero` para mostrar en el frontend — ambos campos ya vienen disponibles en cada record de notificación (`QualityEventId`/`Numero`, etc.), así que no hace falta una consulta extra para resolverlo.

**Hallazgo no anticipado por la instrucción original**: los 3 `ActualizarAccionCorrectiva*Handler.cs` (Incidente/NC/QE) ya permiten cambiar `ResponsableId` de una AC (reasignación) — confirmado leyendo `Features/Incidentes/ActualizarAccionCorrectiva/ActualizarAccionCorrectivaHandler.cs` — pero **ninguno invoca un notification sender hoy**. La instrucción original asumía que no había ningún call site real para `ASIGNACION` y por tanto no haría falta implementarlo; en realidad sí hay 3 call sites reales (la mutación que cambia el responsable ya existe), solo les falta la línea de notificación. Este cambio los conecta (D5) — sin esto, `ASIGNACION` quedaría en el enum sin ningún generador real, un tipo muerto desde el día uno.

`openspec/specs/notification-generation`, `notification-types`, `notification-msw-handlers`, `notification-api-client` (frontend, ya sincronizados a la fase multi-empresa — **no** la versión mono-tenant original de `2026-07-20-m-sistema-notificaciones`, que quedó obsoleta) son la fuente de verdad del contrato ya construido contra MSW: `Notificacion { id, usuarioId, empresaId, tipo, entidadTipo, entidadId, entidadCodigo, mensaje, leida, createdAt, link }`, `NotificacionTipo = 'CAMBIO_ESTADO' | 'ASIGNACION' | 'VENCIMIENTO'` (a nivel de tipo TS, restringido), `NotificacionEntidadTipo = 'QE' | 'NC' | 'INCIDENTE' | 'DOCUMENTO' | 'AC'`, y los 3 endpoints exactos (`GET /api/notifications`, `PATCH /api/notifications/:id/leida`, `PATCH /api/notifications/marcar-todas-leidas`) ya scoped por empresa activa (`empresaId === getActiveEmpresaId()`), confirmado en `notification-msw-handlers/spec.md` — coincide con la instrucción original. **Las reglas RN-NOTIF-001 (cambio de estado) / RN-NOTIF-002 (asignación) / RN-NOTIF-003 (vencimiento) ya existen y están referenciadas en specs activas** (`incident-msw-handlers`, `nc-msw-handlers`, `quality-event-verificacion`) — este backend implementa el lado servidor de esas mismas reglas, así que reutiliza esos IDs en vez de inventar unos nuevos. Las 4 notificaciones adicionales (severidad crítica, cierre, verificación eficaz, comercio exterior) ya tienen su propio ID de regla de negocio en su dominio (`RN-QE-005`, `RN-NC-002` — citados textualmente en los comentarios de las interfaces backend) — no hace falta numeración nueva para ellas tampoco.

**Confirmado, sin BackgroundService/IHostedService existente**: no hay ningún `BackgroundService`/`IHostedService` registrado en `ShcMvpEndPoint` hoy.

**Confirmado, 3 entidades de Acción Correctiva separadas** (no una sola `AccionCorrectiva` genérica): `AccionCorrectivaIncidente`, `AccionCorrectivaNC`, `AccionCorrectivaQE` (`ShacDbContext.AccionesCorrectivasIncidente/NC/QE`), cada una con `Guid ResponsableId`, `DateTime PlazoFecha` (mismo nombre en las 3 — no `FechaLimite`) y su propio enum `Estado`.

## Goals / Non-Goals

**Goals:**
- Entidad `Notificacion` + migración, con índice único parcial de idempotencia para `VENCIMIENTO`.
- Reemplazar las 3 implementaciones `NoOp*` por implementaciones reales, editando las 3 interfaces para llevar `EmpresaId`.
- Conectar `ASIGNACION` a los 3 `ActualizarAccionCorrectiva*Handler` (hallazgo de este design, ver Context).
- 3 endpoints (`GET/PATCH/PATCH`) scoped por empresa activa, sin restricción de rol.
- Escaneo idempotente de vencimiento de ACs (3 dominios), reutilizando `AjustePlazoCalculator.ContarDiasHabiles`.

**Non-Goals:**
- Vencimiento de Documentos (RN-DOC-006) — no existe `Documento` en el backend real todavía.
- Escalamiento RN-INC-006 (incidente sin QE vinculado tras su plazo `PLAZO_QE_HORAS`) como notificación real — hoy es únicamente un badge visual client-side (`incidentQEAlert.ts`); portar la tabla de plazos por `IncidentTipo` al backend es una adición autocontenida, no bloqueante para este cambio, que puede hacerse aparte.
- `ForzarVencimientoVerificacionHandler` (dev-only, `IsDevelopment()`) — confirmado que ni siquiera persiste `auditorAsignadoId` hoy (solo fuerza la transición de estado para pruebas manuales); no se conecta a una notificación real en este cambio.
- Cualquier canal de entrega (email, push, WebSocket) — solo persistencia + polling vía `GET`, igual que el mock.

## Decisions

### D1 — Estructura de Features
```
Features/Notifications/ListarNotificaciones/{Endpoint,Handler}.cs        (Dapper, sin Command/Validator)
Features/Notifications/MarcarLeida/{Endpoint,Handler}.cs                  (sin Command — solo :id de ruta)
Features/Notifications/MarcarTodasLeidas/{Endpoint,Handler}.cs           (sin Command — sin body)
Features/Notifications/Shared/VencimientoSemaforo.cs                      (D8)
Features/Notifications/Shared/VencimientoScanService.cs                  (D7 — BackgroundService)
```
Las 3 implementaciones reales de `I*NotificationSender` viven junto a su interfaz existente (`Features/Incidentes/Shared/IncidenteNotificationSender.cs`, etc.), no en `Features/Notifications/`, para no crear una dependencia inversa `Features.Notifications -> Features.{Incidentes,NoConformidades,QualityEvents}` — cada implementación real solo necesita `ShacDbContext` (para escribir `Notificacion`) y el record de su propia interfaz, ya en su namespace. `Features/Notifications/*` depende de `Domain.Entities.Notificacion` únicamente.

### D2 — `Notificacion`: `EntidadId` es `Guid`, no `string` (corrige el supuesto de la instrucción original)
```
Notificacion { Guid Id, Guid UsuarioId (FK ShacUser), Guid EmpresaId, NotificacionTipo Tipo,
  NotificacionEntidadTipo EntidadTipo, Guid EntidadId, string EntidadCodigo, string Mensaje,
  bool Leida = false, DateTime CreatedAt, string Link }
```
Cada record de notificación ya wireado (`QESeveridadCriticaNotificacion`, `NCCambioEstadoNotificacion`, etc.) pasa `entidad.Id.ToString()` — el Guid stringificado — nunca el `Numero` legible. `EntidadId` se guarda como `Guid` real (se parsea el string en el sender, o mejor: se cambia el tipo del campo `*Id` en cada record de interfaz a `Guid` directamente en vez de `string`, ver D3) y `EntidadCodigo` guarda `Numero` (ya viene en los records que lo tienen — `QESeveridadCriticaNotificacion.Numero`, etc.; para `IncidenteNotificacionDestinatarios`, que hoy NO lleva `Numero`, hay que agregarlo, ver D3).

`NotificacionEntidadTipo = QE | NC | INCIDENTE | DOCUMENTO | AC` (5 valores, igual que el frontend `notification-types` — `DOCUMENTO` se incluye por paridad de contrato aunque este backend nunca lo emita, ver Non-Goals).

### D3 — Las 3 interfaces ganan `EmpresaId` (y, de paso, se corrige el tipo de los campos `*Id` a `Guid`)
```csharp
// Antes: IncidenteNotificacionDestinatarios(string IncidenteId, string EstadoNuevo, IReadOnlyList<Guid> Destinatarios)
// Después:
public sealed record IncidenteNotificacionDestinatarios(
    Guid EmpresaId, Guid IncidenteId, string IncidenteNumero, string EstadoNuevo, IReadOnlyList<Guid> Destinatarios);
```
Mismo criterio para `NCComercioExteriorNotificacion`, `NCCambioEstadoNotificacion`, `QESeveridadCriticaNotificacion`, `QECierreNotificacion`, `QEVerificacionEfectivaNotificacion` — cada una gana `EmpresaId` (ya en scope en su handler, primer parámetro de todo `HandleAsync`) y su campo `*Id` pasa de `string` a `Guid` (ya no hace falta `.ToString()`/parseo). Los que no llevaban `Numero` (`IncidenteNotificacionDestinatarios`) lo ganan, para poder poblar `EntidadCodigo` sin una consulta adicional en el sender real. Esto toca los 9 call sites (6 originales + 3 de D5) — cambio mecánico, ningún call site pierde información que no tuviera ya en scope.

Para los 3 disparadores de QE y el de comercio exterior de NC (`NCComercioExteriorNotificacion`, `QESeveridadCriticaNotificacion`, `QECierreNotificacion`, `QEVerificacionEfectivaNotificacion`) — que a diferencia de los de cambio-de-estado **no llevan una lista de `Destinatarios`** (confirmado leyendo las 4 implementaciones `NoOp*`: ninguna recibe destinatarios, son alertas por rol) — el sender real resuelve destinatarios internamente por rol dentro de `EmpresaId`, vía `db.UsuariosEmpresa.Where(ue => ue.EmpresaId == empresaId && ue.Rol == <rol>)`: `ALTA_DIRECCION` para severidad crítica (RN-QE-005, "notificar a Gerencia"), `JEFE_CALIDAD_SYST` para cierre/verificación eficaz, `JEFE_CONTROL_DOCUMENTARIO` para comercio exterior (mismo rol que ya recibe la alerta de vencimiento de documentos en el mock — no existe un rol "Comercio Exterior" dedicado en `UserRole`).

### D4 — Forma de `NotificacionTipo` — 7 valores, confirmado por Toño, 2026-08-25
La spec del mock (`notification-types`) restringe `NotificacionTipo` a 3 valores (`CAMBIO_ESTADO | ASIGNACION | VENCIMIENTO`) a nivel de tipo TypeScript. El backend ya invirtió en distinguir 4 disparadores adicionales (severidad crítica, cierre, verificación eficaz, comercio exterior) a nivel de interfaz — ninguno encaja limpio en esos 3 valores.

**Verificado, no anticipado por la instrucción original**: `generateVencimientoNotifications()` (`notification-generation/spec.md`) — la función real y actual del mock — **no genera ninguna notificación para estos 4 disparadores**; solo cubre AC/Documento/Incidente-RN-INC-006 como `VENCIMIENTO`. Es decir, no existe hoy ningún contrato de frontend real que estos 4 disparadores deban respetar — son terreno nuevo, no una migración de comportamiento mock existente. Esto refuerza la opción (a):

- **(a) Expandir a 7 valores** (`CAMBIO_ESTADO, ASIGNACION, VENCIMIENTO, SEVERIDAD_CRITICA, CIERRE, VERIFICACION_EFICAZ, COMERCIO_EXTERIOR`) — preserva la distinción que el backend ya modela; requiere ampliar el union type de `NotificacionTipo` en el frontend cuando este backend reemplace MSW.
- **(b) Mapear los 4 a `CAMBIO_ESTADO`** — cero cambio de contrato frontend, pero pierde la distinción ya invertida a nivel de interfaz; el campo `Mensaje` (texto libre) absorbe la diferencia semántica.

**Confirmado por Toño, 2026-08-25**: opción (a), 7 valores — por la misma razón que la instrucción original: aplanar tiraría información que el backend ya distingue explícitamente.

### D5 — `ASIGNACION` se conecta a los 3 `ActualizarAccionCorrectiva*Handler` (resuelto, no requiere aprobación de producto)
Cuando el body de `PATCH .../acciones-correctivas/:id` (Incidente/NC/QE) incluye `responsableId` y su valor difiere del `ResponsableId` actual, el handler crea una notificación `ASIGNACION` para el nuevo responsable (excluyendo al actor si se autoasigna) — mismo patrón try/catch best-effort que los demás 6 call sites, agregado ahora en vez de dejarlo pendiente: la mutación que reasigna ya existe (`ActualizarAccionCorrectivaHandler.cs` línea 27: `if (command.ResponsableId is not null) accion.ResponsableId = command.ResponsableId.Value;`), solo le faltaba la notificación. Sin esto, `ASIGNACION` sería un valor de enum sin ningún generador real desde el día uno.

### D6 — Multi-tenancy: mismo criterio ya establecido (D2 de `be-crud-gestion-usuarios`)
`Notificacion.EmpresaId` se fija siempre desde el `empresaId` que cada handler emisor ya tiene en scope (nunca desde el body ni inferido después) — coincide con la instrucción original y con `notification-types/spec.md` ("empresaId is populated from the originating entity, not derived at read time").

`GET /api/notifications`: `401 "Sesión sin empresa activa"` si el actor no tiene empresa activa (sin excepción para `SUPERADMIN` aquí — a diferencia de `GET /api/users`, un `SUPERADMIN` no tiene un caso de uso para ver notificaciones de todo el sistema; si `SUPERADMIN` accede, igual recibe `401` por construcción, mismo mecanismo que D2 de Usuarios). Filtra por `UsuarioId == actor.Id AND EmpresaId == empresaActivaId`, orden `CreatedAt DESC`. Sin restricción de rol — cualquier rol autenticado con empresa activa ve las suyas.

`PATCH .../:id/leida`: `404` (no `403`) si la notificación no existe o no pertenece al actor (`UsuarioId != actor.Id` se trata igual que "no existe" — nunca revela que la notificación pertenece a otro usuario). `PATCH .../marcar-todas-leidas`: marca `Leida = true` en todas las filas `UsuarioId == actor.Id AND EmpresaId == empresaActivaId AND Leida == false`; también exige empresa activa (`401` si falta).

### D7 — Mecanismo de generación de vencimientos — `BackgroundService` real, confirmado por Toño, 2026-08-25
El mock recalcula en cada `GET /api/notifications` porque no tiene cron disponible; su propio design.md documenta esto como descartable en el backend real. Este backend no tiene esa limitación (confirmado: cero `BackgroundService`/`IHostedService` hoy, pero el SDK lo soporta nativamente sin dependencias nuevas).

- **(a) `BackgroundService` real** — corre cada N minutos (configurable vía `appsettings`, p.ej. `Notifications:VencimientoScanIntervalMinutes`), escanea las 3 tablas de AC de todos los tenants, usa `AjustePlazoCalculator.ContarDiasHabiles` + el nuevo mapeo de umbrales (D8) para detectar cruces a `AMARILLO`, crea `Notificacion` si no existe ya una para `(EntidadTipo, EntidadId, Tipo=VENCIMIENTO)` — reforzado con el índice único parcial de BD (D9), no solo el chequeo en código, para tolerar dos corridas concurrentes.
- **(b) Recompute-on-`GET`** — igual que el mock: la misma lógica de escaneo corre síncronamente al inicio de `ListarNotificacionesHandler`, antes de filtrar. Cero infraestructura nueva, pero cada `GET /api/notifications` paga el costo de escanear las 3 tablas de AC de la empresa activa (acotable a `EmpresaId == empresaActivaId` en vez de todos los tenants, a diferencia de (a) que sí debe recorrer todos porque no hay una request que lo dispare).

**Confirmado por Toño, 2026-08-25**: opción (a), `BackgroundService` real — porque el escaneo cruza información de otros usuarios (responsables de AC que no son quien hace el `GET`); hacerlo síncrono en cada lectura de notificaciones de un actor no relacionado con esas ACs sería un acoplamiento raro (un `OPERARIO` cualquiera abriendo su bandeja dispararía un escaneo de TODAS las ACs de su empresa).

### D8 — Helper de semáforo para vencimientos (nuevo, pequeño)
`Features/Notifications/Shared/VencimientoSemaforo.cs`:
```csharp
public static class VencimientoSemaforo
{
    public static string CalcularEstado(int diasHabilesRestantes) => diasHabilesRestantes switch
    {
        > 5 => "VERDE",
        >= 1 => "AMARILLO",
        _ => "ROJO",
    };
}
```
Umbrales confirmados carácter por carácter contra `shared-semaforo-pendientes/spec.md` (`calcularEstadoSemaforoFila`). Se combina con `AjustePlazoCalculator.ContarDiasHabiles(DateTime.UtcNow, ac.PlazoFecha)` — no se reimplementa el conteo de días hábiles. Dispara una notificación de vencimiento quando el estado pasa a `"AMARILLO"` (mismo umbral que el mock — no en `"ROJO"`, igual que RN-INC-006 del frontend solo notifica en `ROJO` para ESE caso puntual, pero para AC el mock notifica al entrar a `AMARILLO`, confirmado en `notification-generation/spec.md`).

### D9 — Idempotencia de vencimientos: índice único parcial + chequeo en código
```csharp
builder.Entity<Notificacion>(entity =>
{
    entity.HasIndex(e => new { e.EntidadTipo, e.EntidadId })
          .HasFilter("tipo = 'VENCIMIENTO'")
          .IsUnique();
});
```
Doble capa: el chequeo `AnyAsync` en código evita el roundtrip de excepción en el caso común; el índice único parcial (Postgres, soportado por `HasFilter` de EF Core/Npgsql) es la garantía real bajo concurrencia si el job corriera dos veces en paralelo — un `DbUpdateException` por violación de índice único en el intento duplicado se ignora (no es un error real, es la garantía de idempotencia funcionando).

### D10 — Exclusión del actor aplica también a las alertas por rol (resuelto, criterio propio)
Los 4 disparadores de rol (severidad crítica, cierre, verificación eficaz, comercio exterior) excluyen al actor de la lista de destinatarios resueltos por rol, igual que los 2 disparadores de cambio-de-estado (que ya excluyen al actor explícitamente) — consistente con el criterio ya establecido en todo el sistema ("el actor nunca se notifica a sí mismo"), aunque el actor sea, por ejemplo, `JEFE_CALIDAD_SYST` y coincida con el rol de destino.

## Risks / Trade-offs

- [Riesgo] Cambiar la firma de 3 interfaces ya invocadas desde 9 call sites reales → Mitigación: cambio mecánico (agregar `EmpresaId`, cambiar `string` a `Guid` en los campos `*Id`), sin lógica nueva en los call sites existentes salvo D5; `dotnet build` detecta cualquier call site no actualizado (todos son named-record construction, no hay overloads ambiguos).
- [Riesgo] El escaneo de vencimientos (opción D7-a) corriendo en un `BackgroundService` singleton necesita su propio `IServiceScopeFactory` para resolver `ShacDbContext`/`UserManager` scoped — patrón estándar de ASP.NET Core, sin riesgo adicional más allá de seguirlo correctamente.
- [Riesgo] Los 4 disparadores de rol (D3) podrían notificar a cero usuarios si ninguna `UsuarioEmpresa` tiene ese rol en la empresa — comportamiento aceptado (best-effort, no bloqueante; no hay garantía de que exista alguien con rol `ALTA_DIRECCION` en toda empresa de prueba).
- [Riesgo, no bloqueante] `NotificacionEntidadTipo` incluye `DOCUMENTO` aunque este backend nunca lo emita — mantenido por paridad de contrato con el frontend; revisar cuando exista M1 backend.

## Migration Plan

1. Migración EF Core: tabla `notificaciones` + índice único parcial (D9). Sin datos preexistentes que migrar.
2. Editar las 3 interfaces `I*NotificationSender` (D3) y sus 9 call sites (6 originales + 3 de D5).
3. Implementar los 3 senders reales, `Features/Notifications/*` (3 endpoints), `VencimientoSemaforo` (D8), y el `BackgroundService` de vencimientos (D7).
4. Registrar en `Extensions/EndpointExtensions.cs` (reemplaza las 3 líneas `NoOp*`, agrega 3 endpoints + el `BackgroundService`).
5. `dotnet build` + `dotnet test` (SDK disponible en este entorno, confirmado en `be-crud-gestion-usuarios`).
6. Sin rollback especial — no hay datos de producción.

Ninguno de los dos puntos que requerían confirmación de Toño (D4: `NotificacionTipo` de 7 valores; D7: `BackgroundService` real) quedó pendiente — ambos se resolvieron el 2026-08-25, antes de iniciar `/opsx:apply`, igual que D9/D10 en `be-crud-gestion-usuarios`.
