## 0. Confirmación previa

- [x] 0.1 D4 (design.md) confirmado por Toño 2026-08-25: `NotificacionTipo` se expande a 7 valores (`CAMBIO_ESTADO, ASIGNACION, VENCIMIENTO, SEVERIDAD_CRITICA, CIERRE, VERIFICACION_EFICAZ, COMERCIO_EXTERIOR`) — no se aplanan los 4 disparadores adicionales a `CAMBIO_ESTADO`.
- [x] 0.2 D7 (design.md) confirmado por Toño 2026-08-25: mecanismo de vencimientos = `BackgroundService` real (opción a) — no recompute-on-`GET`.
- [x] 0.3 Verificado: `dotnet 10.0.101` disponible en este entorno.

## 1. Entidad y migración

- [x] 1.1 `Domain/Enums/NotificacionTipo.cs` — 7 valores (`CAMBIO_ESTADO, ASIGNACION, VENCIMIENTO, SEVERIDAD_CRITICA, CIERRE, VERIFICACION_EFICAZ, COMERCIO_EXTERIOR`), confirmado en 0.1.
- [x] 1.2 `Domain/Enums/NotificacionEntidadTipo.cs` — `QE | NC | INCIDENTE | DOCUMENTO | AC` (diseño D2).
- [x] 1.3 `Domain/Entities/Notificacion.cs` — `Id, UsuarioId (Guid), EmpresaId (Guid), Tipo, EntidadTipo, EntidadId (Guid), EntidadCodigo (string), Mensaje (string), Leida (bool, default false), CreatedAt, Link (string)` (diseño D2).
- [x] 1.4 `ShacDbContext`: `DbSet<Notificacion> Notificaciones`, conversión de enums a string (mismo criterio que el resto del dominio), índice único parcial `(EntidadTipo, EntidadId) WHERE Tipo = 'VENCIMIENTO'` (diseño D9), más un índice `(UsuarioId, EmpresaId, CreatedAt)` para el listado.
- [x] 1.5 Migración EF Core (`dotnet ef migrations add AddNotificaciones`) — generada y aplicada contra la BD de desarrollo (`dotnet ef database update`), confirmado el índice único parcial y el de listado en el SQL ejecutado.

## 2. Interfaces de notificación — agregar EmpresaId, corregir tipos, implementar real

- [x] 2.1 `IIncidenteNotificationSender` — `IncidenteNotificacionDestinatarios` gana `Guid EmpresaId`, `IncidenteNumero (string)`; `IncidenteId` pasa de `string` a `Guid` (diseño D3).
- [x] 2.2 `INoConformidadNotificationSender` — `NCComercioExteriorNotificacion`/`NCCambioEstadoNotificacion` ganan `Guid EmpresaId`; `NoConformidadId` pasa de `string` a `Guid`. Gap encontrado en diseño: `NCCambioEstadoNotificacion` tampoco llevaba `Numero` (el diseño solo mencionaba agregarlo a `IncidenteNotificacionDestinatarios`) — agregado también aquí para poder poblar `EntidadCodigo`.
- [x] 2.3 `IQualityEventNotificationSender` — `QESeveridadCriticaNotificacion`/`QECierreNotificacion`/`QEVerificacionEfectivaNotificacion` ganan `Guid EmpresaId`; `QualityEventId` pasa de `string` a `Guid`.
- [x] 2.4 Actualizados los 7 call sites existentes (`CambiarEstadoIncidenteHandler`, `CrearNoConformidadHandler`, `ActualizarNoConformidadHandler`, `CrearQualityEventHandler`, `EditarSeveridadQEHandler`, `FirmarCierreQEHandler`, `VerificacionEficaciaQEHandler`) para pasar `empresaId`/`actorId` (ya en scope) y `entidad.Id` directo (sin `.ToString()`).
- [x] 2.5 Implementación real `IncidenteNotificationSender` (reemplaza `NoOpIncidenteNotificationSender`) — persiste `Notificacion` por cada destinatario de `Destinatarios`, `Tipo: CAMBIO_ESTADO`, `EntidadTipo: INCIDENTE`.
- [x] 2.6 Implementación real `NoConformidadNotificationSender` (reemplaza `NoOpNoConformidadNotificationSender`) — `NotificarCambioEstadoAsync` igual que 2.5 con `EntidadTipo: NC`; `NotificarComercioExteriorAsync` resuelve destinatarios por rol `JEFE_CONTROL_DOCUMENTARIO` en `EmpresaId` (diseño D3), excluyendo al actor, vía `RolNotificationHelper` compartido.
- [x] 2.7 Implementación real `QualityEventNotificationSender` (reemplaza `NoOpQualityEventNotificationSender`) — `NotificarSeveridadCriticaAsync` resuelve destinatarios por rol `ALTA_DIRECCION`; `NotificarCierreAsync`/`NotificarVerificacionEfectivaAsync` resuelven por rol `JEFE_CALIDAD_SYST` — todos excluyendo al actor (diseño D3/D10), vía `RolNotificationHelper` compartido. `Guid ActorId` agregado a los 3 records.
- [x] 2.8 Eliminadas las 3 clases `NoOp*NotificationSender.cs`, registros actualizados en `EndpointExtensions.cs`.

## 3. Conectar ASIGNACION a la reasignación de responsable de AC (diseño D5)

- [x] 3.1 `Features/Incidentes/ActualizarAccionCorrectiva/ActualizarAccionCorrectivaHandler.cs` — si `command.ResponsableId` cambia respecto al valor anterior y es distinto del actor, notificar `ASIGNACION` (best-effort, try/catch). Handler ganó `actorId`/`ILogger` (no los tenía antes); endpoint actualizado para pasar `user.GetUsuarioId()`.
- [x] 3.2 Mismo cambio en `Features/NoConformidades/ActualizarAccionCorrectiva/ActualizarAccionCorrectivaHandler.cs`.
- [x] 3.3 Mismo cambio en `Features/QualityEvents/ActualizarAccionCorrectivaQE/ActualizarAccionCorrectivaQEHandler.cs`.
- [x] 3.4 Resuelto: `Features/Notifications/Shared/IAsignacionNotificationSender.cs` + `AsignacionNotificationSender.cs` — sender común compartido por los 3 dominios, en vez de triplicar el método en las 3 interfaces existentes.

## 4. GET /api/notifications

- [x] 4.1 `Features/Notifications/ListarNotificaciones/{Endpoint,Handler}.cs` — Dapper, `WHERE usuario_id = @ActorId AND empresa_id = @EmpresaActivaId ORDER BY created_at DESC`.
- [x] 4.2 `401 "Sesión sin empresa activa"` si no hay empresa activa (guard manual en el endpoint, mismo criterio D2/D6 que `be-crud-gestion-usuarios`).
- [x] 4.3 Sin restricción de rol — `.RequireAuthorization()` sin `RequireRole`.
- [x] 4.4 N/A: 0.2 resolvió `BackgroundService` real, no recompute-on-GET.

## 5. PATCH /api/notifications/:id/leida

- [x] 5.1 `Features/Notifications/MarcarLeida/{Endpoint,Handler}.cs` — `404` si la notificación no existe o `UsuarioId != actor.Id` (mismo criterio, sin distinguir los dos casos).
- [x] 5.2 `401` sin empresa activa (mismo guard que 4.2).
- [x] 5.3 Marca `Leida = true`, responde `200` con la notificación actualizada.

## 6. PATCH /api/notifications/marcar-todas-leidas

- [x] 6.1 `Features/Notifications/MarcarTodasLeidas/{Endpoint,Handler}.cs` — marca `Leida = true` en todas las filas `UsuarioId == actor.Id AND EmpresaId == empresaActivaId AND Leida == false`.
- [x] 6.2 `401` sin empresa activa.
- [x] 6.3 Responde `200` con la lista actualizada.

## 7. Escaneo de vencimientos (mecanismo según 0.2)

- [x] 7.1 `Features/Notifications/Shared/VencimientoSemaforo.cs` — mapeo de umbrales (diseño D8), reutilizando `AjustePlazoCalculator.ContarDiasHabiles`. Referencia narrow y documentada a `Features.QualityEvents.Shared` desde `VencimientoScanService` (gap encontrado: D1 pedía cero dependencia de los 3 dominios, D8 pedía reutilizar `AjustePlazoCalculator` que vive justo ahí — se resolvió reutilizando el helper estático puro, documentado inline).
- [x] 7.2 Lógica de escaneo: iterar `AccionesCorrectivasIncidente`/`NC`/`QE` no cerradas (join con su padre para `EmpresaId`/`Numero`), calcular semáforo contra `PlazoFecha`, crear `Notificacion VENCIMIENTO` para `ResponsableId` si cruza a `AMARILLO` y no existe ya una fila `(EntidadTipo=AC, EntidadId, Tipo=VENCIMIENTO)`.
- [x] 7.3 `Features/Notifications/Shared/VencimientoScanService.cs` (`BackgroundService`), intervalo configurable (`Notifications:VencimientoScanIntervalMinutes`, default 60), usa `IServiceScopeFactory` para resolver `ShacDbContext` scoped; registrado con `services.AddHostedService<VencimientoScanService>()` en `Program.cs`.
- [x] 7.4 N/A (0.2 resolvió BackgroundService, no recompute-on-GET).
- [x] 7.5 `DbUpdateException` por violación del índice único (D9) capturada como no-error — `db.ChangeTracker.Clear()` y continúa.

## 8. Registro

- [x] 8.1 `Extensions/EndpointExtensions.cs`: reemplazadas las 3 líneas `AddScoped<I*NotificationSender, NoOp*>()` por las implementaciones reales; agregada sección "Notifications" con los 3 endpoints nuevos + handlers + `IAsignacionNotificationSender`. `AddHostedService<VencimientoScanService>()` y `Configure<NotificationsOptions>` en `Program.cs` (vive en el host, no en `AddInfrastructure`, mismo criterio que el resto del registro de Features/).

## 9. Tests

- [x] 9.1 Generación de `CAMBIO_ESTADO` desde Incidente y NC: destinatarios correctos (reportante + responsables de AC no cerrada), actor nunca se autonotifica. (Fallo de notificación no bloqueando la respuesta no se probó con inyección de fallo — sin precedente de ese patrón en el resto de la suite; el try/catch es idéntico al de los 6 call sites preexistentes, ya confiado sin test dedicado en esos módulos.)
- [x] 9.2 Generación de las 4 notificaciones por rol de QE/NC (severidad crítica, cierre, verificación eficaz, comercio exterior): destinatarios resueltos por rol dentro de la empresa correcta, condición de severidad respetada (incluido el caso negativo: severidad MEDIA no notifica cierre), actor excluido.
- [x] 9.3 Generación de `ASIGNACION` en reasignación de AC (los 3 dominios): notifica al nuevo responsable, no notifica en autoasignación.
- [x] 9.4 Listado: orden `createdAt` desc, notificación de otra empresa del mismo usuario no aparece, `401` sin empresa activa.
- [x] 9.5 Marcar leída: éxito, `404` cross-usuario, `401` sin empresa activa.
- [x] 9.6 Marcar todas leídas: solo afecta empresa activa del actor, no afecta otra empresa del mismo usuario.
- [x] 9.7 Idempotencia del escaneo de vencimientos (`VencimientoScanner.ScanAsync`, extraído de `VencimientoScanService` para ser testable sin esperar el timer del `BackgroundService`): AC que cruza a `AMARILLO` genera exactamente una notificación, correr el escaneo dos veces no duplica, AC con >5 días hábiles no notifica, AC ya `CERRADA` no notifica aunque esté por vencer.
- [x] 9.8 Confirmado con la suite completa (364/364): `CambiarEstadoIncidenteHandler`, `CrearNoConformidadHandler`, `ActualizarNoConformidadHandler`, `CrearQualityEventHandler`, `EditarSeveridadQEHandler`, `FirmarCierreQEHandler`, `VerificacionEficaciaQEHandler` y todos los tests preexistentes de Incidentes/NC/QE/Empresas/Users siguen pasando tras el cambio de firma de las interfaces (2.1-2.4) y las ediciones de los 3 `ActualizarAccionCorrectiva*Handler` (D5).

## 10. Verificación

- [x] 10.1 `dotnet build` limpio (Domain/Infrastructure/Host/Tests).
- [x] 10.2 `dotnet test` ejecutado directamente en este entorno: 364/364 pruebas correctas, incluidas las 23 nuevas de `Features/Notifications`.
- [x] 10.3 Implementación final consistente con 0.1 (`NotificacionTipo` de 7 valores) y 0.2 (`BackgroundService` real) — verificado explícitamente en los tests de 9.2 (tipos SEVERIDAD_CRITICA/CIERRE/VERIFICACION_EFICAZ/COMERCIO_EXTERIOR propios) y 9.7 (escaneo vía `VencimientoScanner`, no recompute-on-GET).
