## ADDED Requirements

### Requirement: Entidad Notificacion persistida
El sistema SHALL persistir cada notificación como una fila `Notificacion` con campos `Id (Guid)`, `UsuarioId (Guid, destinatario)`, `EmpresaId (Guid, empresa de la entidad que originó la notificación)`, `Tipo`, `EntidadTipo`, `EntidadId (Guid)`, `EntidadCodigo (string, el código legible de la entidad — p.ej. "QE-2026-001")`, `Mensaje (string)`, `Leida (bool, default false)`, `CreatedAt (DateTime UTC)` y `Link (string, ruta deep-link del frontend)`.

#### Scenario: Notificación creada con todos los campos requeridos
- **WHEN** se genera una notificación para cualquiera de los disparadores de este módulo
- **THEN** la fila persistida tiene `UsuarioId`, `EmpresaId`, `Tipo`, `EntidadTipo`, `EntidadId`, `EntidadCodigo`, `Mensaje`, `Leida: false` y `CreatedAt` poblados

### Requirement: NotificacionTipo — 7 valores (D4, confirmado)
El sistema SHALL definir `NotificacionTipo` con 7 valores: `CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ` y `COMERCIO_EXTERIOR` — los 3 primeros coinciden con el contrato ya establecido en `notification-types` (frontend); los 4 adicionales preservan la distinción que las interfaces del backend ya modelan en vez de aplanarlos a `CAMBIO_ESTADO`.

#### Scenario: Los 3 tipos base siempre están disponibles
- **WHEN** se genera una notificación de cambio de estado, asignación o vencimiento
- **THEN** su `Tipo` es `CAMBIO_ESTADO`, `ASIGNACION` o `VENCIMIENTO` respectivamente

#### Scenario: Los 4 disparadores por rol usan su propio valor de Tipo
- **WHEN** se genera una notificación de severidad crítica, cierre, verificación eficaz o comercio exterior
- **THEN** su `Tipo` es `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ` o `COMERCIO_EXTERIOR` respectivamente, nunca `CAMBIO_ESTADO`

### Requirement: NotificacionEntidadTipo
El sistema SHALL definir `NotificacionEntidadTipo = QE | NC | INCIDENTE | DOCUMENTO | AC` (mismo conjunto que el frontend, `notification-types`) — `DOCUMENTO` incluido por paridad de contrato aunque este módulo no lo emita (no existe `Documento` en el backend real todavía).

#### Scenario: EntidadTipo refleja el dominio de origen
- **WHEN** se genera una notificación desde un Quality Event, una No Conformidad, un Incidente o una Acción Correctiva
- **THEN** su `EntidadTipo` es `QE`, `NC`, `INCIDENTE` o `AC` respectivamente

### Requirement: Generación real de notificación en cambio de estado de Incidente y No Conformidad (RN-NOTIF-001)
El sistema SHALL crear una notificación `CAMBIO_ESTADO` cuando `PATCH /api/incidents/:id/status` o `PATCH /api/nonconformities/:id` (cambiando `estado`) completan una transición válida, con destinatarios = responsables de Acciones Correctivas no cerradas de esa entidad más su `ReportadoPorId`, deduplicados y excluyendo al actor. El envío SHALL ser best-effort: un fallo al persistir la notificación SHALL registrarse en logs y nunca debe impedir que la respuesta HTTP de la transición de estado se complete con éxito.

#### Scenario: Cambio de estado de Incidente notifica al reportante y responsables de AC activas
- **WHEN** un Incidente transiciona de estado válidamente y tiene una AC no cerrada con `ResponsableId` distinto del actor
- **THEN** se crea una notificación `CAMBIO_ESTADO` para el `ReportadoPorId` del Incidente y para ese responsable, ninguna para el actor

#### Scenario: Fallo al notificar no bloquea la respuesta de la transición
- **WHEN** la persistencia de la notificación de cambio de estado lanza una excepción
- **THEN** `PATCH /api/incidents/:id/status` (o el equivalente de NC) igual responde `200` con el estado ya actualizado

### Requirement: Generación real de notificación de comercio exterior en alta de NC aduanera (RN-NC-002)
El sistema SHALL crear una notificación `COMERCIO_EXTERIOR` al crear una No Conformidad con `Dominio == ADUANERO`, dirigida a los usuarios con rol `JEFE_CONTROL_DOCUMENTARIO` en la empresa de la NC, excluyendo al actor, de forma best-effort (fuera de la transacción de creación de la NC).

#### Scenario: Alta de NC aduanera notifica a Jefe de Control Documentario
- **WHEN** se crea una No Conformidad con `dominio: ADUANERO` en una empresa con al menos un usuario `JEFE_CONTROL_DOCUMENTARIO` distinto del actor
- **THEN** ese usuario recibe una notificación referenciando la NC recién creada

### Requirement: Generación real de notificaciones de Quality Event por rol (RN-QE-005)
El sistema SHALL crear una notificación `Tipo: SEVERIDAD_CRITICA` al crear un QE con severidad `CRITICA` o al editar su severidad a `CRITICA` (destinatarios: rol `ALTA_DIRECCION` en la empresa del QE), una notificación `Tipo: CIERRE` al completarse la firma dual de cierre si la severidad es `ALTA` o `CRITICA` (destinatarios: rol `JEFE_CALIDAD_SYST`), y una notificación `Tipo: VERIFICACION_EFICAZ` al verificar eficacia con resultado `EFECTIVO` si la severidad es `ALTA` o `CRITICA` (destinatarios: rol `JEFE_CALIDAD_SYST`) — en los tres casos excluyendo al actor, de forma best-effort.

#### Scenario: QE con severidad crítica notifica a Alta Dirección
- **WHEN** se crea (o se edita a) un QE con `severidad: CRITICA` en una empresa con al menos un usuario `ALTA_DIRECCION` distinto del actor
- **THEN** ese usuario recibe una notificación referenciando el QE

#### Scenario: Cierre de QE de severidad baja/media no notifica
- **WHEN** se completa la firma dual de cierre de un QE con `severidad: BAJA` o `MEDIA`
- **THEN** no se crea ninguna notificación de cierre para ese QE

### Requirement: Generación real de notificación de asignación de responsable de Acción Correctiva (RN-NOTIF-002)
El sistema SHALL crear una notificación `ASIGNACION` cuando `PATCH` de una Acción Correctiva (Incidente, NC o QE) cambia `responsableId` a un usuario distinto del valor anterior, dirigida al nuevo responsable — sin notificar si el nuevo responsable es el propio actor —, de forma best-effort.

#### Scenario: Reasignar el responsable de una AC notifica al nuevo responsable
- **WHEN** se actualiza una Acción Correctiva cambiando `responsableId` a un usuario distinto del actor y del responsable anterior
- **THEN** el nuevo responsable recibe una notificación `ASIGNACION` referenciando esa AC

#### Scenario: Autoasignarse una AC no genera notificación
- **WHEN** el actor se asigna a sí mismo como `responsableId` de una AC
- **THEN** no se crea ninguna notificación

### Requirement: Escaneo idempotente de vencimiento de Acciones Correctivas (RN-NOTIF-003)
El sistema SHALL detectar, a través de las tres tablas de Acción Correctiva (Incidente, NC, QE) de todas las empresas, cada AC no cerrada cuyo estado de semáforo (calculado con los mismos umbrales que `shared-semaforo-pendientes`: `VERDE` si quedan más de 5 días hábiles hasta `PlazoFecha`, `AMARILLO` entre 1 y 5, `ROJO` en 0 o menos) cruza a `AMARILLO`, y SHALL crear como máximo una notificación `VENCIMIENTO` por AC (dirigida a su `ResponsableId`, si es distinto de nadie en particular — no aplica exclusión de actor, es un disparador por tiempo, no por acción de un actor), identificada de forma estable por `(EntidadTipo, EntidadId)`. Ejecutar el escaneo repetidamente SHALL NOT crear una segunda notificación para la misma AC mientras no exista una nueva reasignación de plazo. El escaneo SHALL ejecutarse mediante un `BackgroundService` real (proceso en segundo plano, intervalo configurable), no mediante recálculo síncrono en cada `GET /api/notifications` (D7, confirmado).

#### Scenario: AC que cruza a AMARILLO genera exactamente una notificación
- **WHEN** una AC no cerrada tiene 3 días hábiles restantes hasta su `PlazoFecha` y no existe ya una notificación `VENCIMIENTO` para ella
- **THEN** se crea exactamente una notificación `VENCIMIENTO` para su responsable

#### Scenario: Repetir el escaneo no duplica la notificación
- **WHEN** el escaneo de vencimientos se ejecuta dos veces seguidas sin que cambie el estado de la AC
- **THEN** la segunda ejecución no crea ninguna notificación nueva para esa AC

### Requirement: Listado de notificaciones scoped por empresa activa
El sistema SHALL exponer `GET /api/notifications`, sin restricción de rol, requiriendo empresa activa en la sesión del actor (`401 "Sesión sin empresa activa"` si no hay). SHALL devolver únicamente las notificaciones con `UsuarioId == actor.Id AND EmpresaId == empresaActivaDelActor`, ordenadas por `CreatedAt` descendente.

#### Scenario: Listado exitoso ordenado por más reciente primero
- **WHEN** un actor con empresa activa y al menos 2 notificaciones propias en esa empresa envía `GET /api/notifications`
- **THEN** el sistema responde `200` con las notificaciones ordenadas de más reciente a más antigua

#### Scenario: Una notificación de otra empresa del mismo usuario no aparece
- **WHEN** el actor tiene notificaciones en dos empresas a las que pertenece, y su empresa activa es solo una de ellas
- **THEN** `GET /api/notifications` devuelve únicamente las notificaciones de la empresa activa

#### Scenario: Sin empresa activa
- **WHEN** un actor autenticado sin empresa activa en su sesión envía `GET /api/notifications`
- **THEN** el sistema responde `401 "Sesión sin empresa activa"`

### Requirement: Marcar notificación individual como leída
El sistema SHALL exponer `PATCH /api/notifications/:id/leida`, requiriendo empresa activa (`401` si falta), que marca `Leida: true` en la notificación indicada solo si pertenece al actor (`UsuarioId == actor.Id`); SHALL responder `404` (nunca `403`) si la notificación no existe o pertenece a otro usuario, sin distinguir entre ambos casos.

#### Scenario: Marcar como leída una notificación propia
- **WHEN** el actor marca como leída una notificación propia no leída
- **THEN** el sistema responde `200` con `leida: true`

#### Scenario: Notificación de otro usuario responde 404
- **WHEN** el actor intenta marcar como leída una notificación que pertenece a otro usuario
- **THEN** el sistema responde `404`, sin revelar que la notificación existe

### Requirement: Marcar todas las notificaciones como leídas
El sistema SHALL exponer `PATCH /api/notifications/marcar-todas-leidas`, requiriendo empresa activa (`401` si falta), que marca `Leida: true` en todas las notificaciones con `UsuarioId == actor.Id AND EmpresaId == empresaActivaDelActor AND Leida == false`, sin afectar notificaciones de otras empresas del mismo usuario ni de otros usuarios.

#### Scenario: Marca todas las no leídas de la empresa activa
- **WHEN** el actor tiene 3 notificaciones no leídas en su empresa activa y envía `PATCH /api/notifications/marcar-todas-leidas`
- **THEN** las 3 quedan `leida: true` y la respuesta es `200`

#### Scenario: No afecta notificaciones de otra empresa del mismo usuario
- **WHEN** el actor tiene una notificación no leída en una empresa distinta de su empresa activa
- **THEN** esa notificación permanece `leida: false` tras `PATCH /api/notifications/marcar-todas-leidas`
