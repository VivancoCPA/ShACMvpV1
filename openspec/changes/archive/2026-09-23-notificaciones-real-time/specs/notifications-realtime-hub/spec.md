## ADDED Requirements

### Requirement: NotificationsHub autenticado por JWT
El sistema SHALL exponer un `NotificationsHub` de SignalR en `/hubs/notifications`, decorado `[Authorize]`, aceptando el token de acceso vía query string (`?access_token=`) exclusivamente para ese path — nunca para ningún otro endpoint REST existente.

#### Scenario: Conexión con token válido se acepta
- **WHEN** un cliente abre una `HubConnection` a `/hubs/notifications?access_token=<jwt válido>`
- **THEN** la conexión se acepta y `Context.User` refleja el usuario del token

#### Scenario: Conexión sin token o con token inválido se rechaza
- **WHEN** un cliente intenta conectar a `/hubs/notifications` sin `access_token` o con uno expirado/inválido
- **THEN** la conexión se rechaza con 401, sin agregar la conexión a ningún grupo

### Requirement: Agrupación de conexiones por usuario
El sistema SHALL agregar cada conexión aceptada al grupo `usuario-{usuarioId}` (mismo `usuarioId` que resuelve `ClaimsPrincipal.GetUsuarioId()` en los endpoints REST existentes), en `OnConnectedAsync`. Un mismo usuario SHALL poder tener múltiples conexiones simultáneas en el mismo grupo (múltiples pestañas o dispositivos).

#### Scenario: Dos pestañas del mismo usuario reciben el mismo push
- **WHEN** un usuario tiene el hub conectado en dos pestañas simultáneas
- **THEN** ambas conexiones están en el grupo `usuario-{usuarioId}` y ambas reciben cualquier evento enviado a ese grupo

### Requirement: Push exclusivo para SEVERIDAD_CRITICA y CIERRE, después de persistir
El sistema SHALL emitir el evento `"notificacionNueva"` al grupo `usuario-{usuarioId}` de cada destinatario únicamente cuando se genera una notificación de `Tipo` `SEVERIDAD_CRITICA` o `CIERRE` desde `QualityEventNotificationSender`, y únicamente después de que `SaveChangesAsync` haya persistido la fila `Notificacion` correspondiente. Ningún otro `Tipo` de notificación (`CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `VERIFICACION_EFICAZ`, `COMERCIO_EXTERIOR`) SHALL disparar este evento.

#### Scenario: QE con severidad CRITICA dispara push a Alta Dirección
- **WHEN** un Quality Event cambia a severidad `CRITICA` y se genera su notificación `SEVERIDAD_CRITICA`
- **THEN** cada destinatario de rol `ALTA_DIRECCION` conectado al hub recibe `"notificacionNueva"` con la `Notificacion` recién persistida

#### Scenario: Cierre de QE dispara push a Jefe de Calidad
- **WHEN** un Quality Event se cierra y se genera su notificación `CIERRE`
- **THEN** cada destinatario de rol `JEFE_CALIDAD_SYST` conectado al hub recibe `"notificacionNueva"` con la `Notificacion` recién persistida

#### Scenario: Verificación eficaz no dispara push
- **WHEN** un Quality Event se verifica como efectivo y se genera su notificación `VERIFICACION_EFICAZ` (mismo helper compartido `NotificarPorRolAsync` que los dos casos anteriores)
- **THEN** ningún cliente conectado al hub recibe `"notificacionNueva"` para ese evento — solo queda disponible vía `GET /api/notifications` (polling o fetch manual)

#### Scenario: Falla al persistir nunca dispara un push fantasma
- **WHEN** `SaveChangesAsync` falla al intentar persistir una notificación `SEVERIDAD_CRITICA` o `CIERRE`
- **THEN** el sistema no llama `SendAsync` para esa notificación — el push nunca precede a la persistencia

### Requirement: Payload del hub coincide en forma con el contrato REST
El sistema SHALL serializar el payload de `"notificacionNueva"` con la misma `PropertyNamingPolicy` (camelCase) y `JsonStringEnumConverter` que ya usa `ConfigureHttpJsonOptions` para los endpoints REST — el objeto recibido por el cliente SHALL tener el mismo shape que un elemento de `GET /api/notifications`.

#### Scenario: Los campos del payload llegan en camelCase
- **WHEN** el hub emite `"notificacionNueva"`
- **THEN** el payload recibido por el cliente tiene claves `id`, `usuarioId`, `empresaId`, `tipo`, `entidadTipo`, `entidadId`, `entidadCodigo`, `mensaje`, `leida`, `createdAt`, `link` — mismas que el DTO `Notificacion` que consume el frontend

### Requirement: El push nunca cruza empresas
El sistema SHALL restringir los destinatarios del push a los resueltos por `RolNotificationHelper.ResolverDestinatariosPorRolAsync` para la `EmpresaId` de la notificación — el grupo del hub es por `usuarioId`, pero el conjunto de destinatarios que recibe el `SendAsync` ya viene acotado por empresa desde el mismo mecanismo que usa la persistencia REST.

#### Scenario: Un usuario sin acceso a la empresa del QE no recibe el push
- **WHEN** se genera una notificación `SEVERIDAD_CRITICA`/`CIERRE` para la empresa A
- **THEN** solo los destinatarios resueltos para la empresa A reciben `"notificacionNueva"` — un usuario de la empresa B, aunque esté conectado al hub, no está entre los grupos a los que se envía
