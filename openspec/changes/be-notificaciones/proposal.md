## Why

`ShcMvpEndPoint` ya invoca 3 interfaces de notificación (`IIncidenteNotificationSender`, `INoConformidadNotificationSender`, `IQualityEventNotificationSender`) desde 6 puntos reales de negocio, pero las 3 implementaciones registradas hoy (`NoOp*NotificationSender`) solo escriben un log — ninguna notificación persiste, y no existe `GET /api/notifications` ni forma de marcarlas leídas. El frontend (`shc-controldoc`) ya tiene el inbox de notificaciones completo contra MSW (`notification-types`, `notification-generation`, `notification-msw-handlers`, `notification-bell`, `notification-query-hooks`), incluyendo el contrato multi-empresa (`empresaId` por notificación, filtrado por empresa activa) — sin este backend, ese inbox nunca puede salir de mock. Este cambio construye la contraparte real: entidad `Notificacion`, generación real en los 6 (pasa a 9, ver Impact) call sites ya wireados, y los 3 endpoints de lectura/lectura-masiva.

## What Changes

- Nueva entidad `Notificacion` + migración EF Core (`Guid Id`, `Guid UsuarioId` FK `ShacUser`, `Guid EmpresaId`, `Tipo`, `EntidadTipo`, `Guid EntidadId`, `string EntidadCodigo`, `Mensaje`, `Leida`, `CreatedAt`, `Link`).
- **BREAKING (interno, sin API pública todavía consumida)**: las 3 interfaces `I*NotificationSender` ganan un parámetro `EmpresaId` en cada record de payload — se edita la interfaz, la implementación y los 9 call sites (los 6 originales + 3 de reasignación de responsable de AC agregados en este cambio, ver Impact).
- Reemplazo de `NoOpIncidenteNotificationSender`, `NoOpNoConformidadNotificationSender`, `NoOpQualityEventNotificationSender` por implementaciones reales que persisten `Notificacion` (mismo patrón try/catch best-effort en cada call site, sin cambios de comportamiento ante fallo).
- Se conecta la reasignación de responsable de Acción Correctiva (los 3 `ActualizarAccionCorrectiva*Handler.cs` — Incidente/NC/QE — ya permiten cambiar `ResponsableId` pero hoy no notifican a nadie) a una notificación `ASIGNACION` real, cerrando un vacío que dejaba ese tipo del enum sin ningún generador.
- 3 endpoints nuevos: `GET /api/notifications`, `PATCH /api/notifications/:id/leida`, `PATCH /api/notifications/marcar-todas-leidas` — scoped por empresa activa del actor.
- Escaneo de vencimiento de Acciones Correctivas (3 dominios: Incidente/NC/QE) que cruzan a `AMARILLO` (umbral ya establecido: `> 5` días hábiles `VERDE`, `1-5` `AMARILLO`, `≤0` `ROJO`, vía el nuevo helper de semáforo que envuelve `AjustePlazoCalculator.ContarDiasHabiles`), idempotente por `(EntidadTipo, EntidadId, Tipo=VENCIMIENTO)`.

## Capabilities

### New Capabilities
- `be-notifications-api`: entidad `Notificacion`, generación real de notificaciones desde los 9 call sites de negocio ya existentes (6 wireados + 3 de reasignación de AC agregados aquí), escaneo de vencimiento de ACs, y los 3 endpoints de lectura (`GET`, marcar-leída, marcar-todas-leídas), todo scoped por empresa activa.

### Modified Capabilities
_Ninguna._ Los specs backend existentes (`be-incidentes-api`, `be-no-conformidades-api`, `be-quality-events-api`) no documentan las interfaces `I*NotificationSender` como parte de su contrato — son un detalle de implementación interno, así que el cambio de firma (agregar `EmpresaId`) no requiere una delta spec en esos capabilities.

## Impact

- **Código nuevo**: `Domain/Entities/Notificacion.cs`, `Domain/Enums/{NotificacionTipo,NotificacionEntidadTipo}.cs`, migración EF Core, `Features/Notifications/{ListarNotificaciones,MarcarLeida,MarcarTodasLeidas,Shared}/*`, implementaciones reales de los 3 `I*NotificationSender`, un `BackgroundService` (o mecanismo alternativo, ver Decisión pendiente en `design.md`) para el escaneo de vencimientos.
- **Código editado**: las 3 interfaces `I*NotificationSender` (nuevo parámetro `EmpresaId` en cada record), sus 3 implementaciones `NoOp*` (eliminadas, reemplazadas), y los 9 call sites: `CambiarEstadoIncidenteHandler`, `CrearNoConformidadHandler`, `ActualizarNoConformidadHandler`, `CrearQualityEventHandler`, `EditarSeveridadQEHandler`, `FirmarCierreQEHandler`, `VerificacionEficaciaQEHandler`, y los 3 `ActualizarAccionCorrectiva*Handler` (Incidente/NC/QE) para agregar la notificación `ASIGNACION` cuando `ResponsableId` cambia. `Extensions/EndpointExtensions.cs` (líneas 249/263/277 de registro de los NoOp senders, + 5 nuevos endpoints).
- **Fuera de alcance**: vencimiento de Documentos (RN-DOC-006 — no existe `Documento` en el backend real todavía); escalamiento RN-INC-006 (incidente sin QE vinculado tras su plazo) como notificación real — hoy solo existe como badge visual client-side (`incidentQEAlert.ts`), portar su tabla de plazos (`PLAZO_QE_HORAS`) server-side es una adición autocontenida que puede hacerse en un cambio posterior; el botón dev-only "Forzar vencimiento" (`ForzarVencimientoVerificacionEndpoint`, gateado a `IsDevelopment()`) no persiste `auditorAsignadoId` hoy y no se conecta a una notificación real en este cambio.
- **Dos decisiones confirmadas por Toño el 2026-08-25** (ver `design.md` D4/D7): `NotificacionTipo` se expande a 7 valores (no se aplanan a 3), y el mecanismo de generación de vencimientos es un `BackgroundService` real (no recompute-on-`GET`).
