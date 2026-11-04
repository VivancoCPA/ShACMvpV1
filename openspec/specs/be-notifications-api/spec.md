# be-notifications-api

## Purpose

Backend .NET del inbox de notificaciones de SHAC: entidad `Notificacion` persistida, generación real de notificaciones desde los call sites de negocio de Incidentes, No Conformidades y Quality Events (cambio de estado, comercio exterior en NC aduanera, severidad crítica/cierre/verificación eficaz de QE, asignación de responsable de Acción Correctiva), un escaneo idempotente de vencimiento de Acciones Correctivas vía `BackgroundService`, y los endpoints de lectura/lectura-masiva (`GET /api/notifications`, marcar individual como leída, marcar todas como leídas) — todo scoped por empresa activa del actor, reemplazando el inbox que hoy solo existe contra MSW en el frontend.

## Requirements

### Requirement: Entidad Notificacion persistida
El sistema SHALL persistir cada notificación como una fila `Notificacion` con campos `Id (Guid)`, `UsuarioId (Guid, destinatario)`, `EmpresaId (Guid, empresa de la entidad que originó la notificación)`, `Tipo`, `EntidadTipo`, `EntidadId (Guid)`, `EntidadCodigo (string, el código legible de la entidad — p.ej. "QE-2026-001")`, `Mensaje (string)`, `Leida (bool, default false)`, `CreatedAt (DateTime UTC)`, `Link (string, ruta deep-link del frontend)` y `CicloClave (string, default "")`. `CicloClave` SHALL permanecer `""` para toda notificación que no sea del bloque de vencimiento de revisión periódica de Documentos (Acciones Correctivas, cambio de estado, asignación, etc.) — preserva exactamente la idempotencia "una sola notificación para siempre por entidad" que esos bloques ya tenían antes de este campo.

#### Scenario: Notificación creada con todos los campos requeridos
- **WHEN** se genera una notificación para cualquiera de los disparadores de este módulo
- **THEN** la fila persistida tiene `UsuarioId`, `EmpresaId`, `Tipo`, `EntidadTipo`, `EntidadId`, `EntidadCodigo`, `Mensaje`, `Leida: false`, `CreatedAt` y `CicloClave` poblados

#### Scenario: CicloClave queda vacío para notificaciones que no son de revisión periódica de Documentos
- **WHEN** se genera una notificación de cambio de estado, asignación, o vencimiento de una Acción Correctiva
- **THEN** su `CicloClave` es `""`

### Requirement: NotificacionTipo — 7 valores (D4, confirmado)
El sistema SHALL definir `NotificacionTipo` con 7 valores: `CAMBIO_ESTADO`, `ASIGNACION`, `VENCIMIENTO`, `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ` y `COMERCIO_EXTERIOR` — los 3 primeros coinciden con el contrato ya establecido en `notification-types` (frontend); los 4 adicionales preservan la distinción que las interfaces del backend ya modelan en vez de aplanarlos a `CAMBIO_ESTADO`.

#### Scenario: Los 3 tipos base siempre están disponibles
- **WHEN** se genera una notificación de cambio de estado, asignación o vencimiento
- **THEN** su `Tipo` es `CAMBIO_ESTADO`, `ASIGNACION` o `VENCIMIENTO` respectivamente

#### Scenario: Los 4 disparadores por rol usan su propio valor de Tipo
- **WHEN** se genera una notificación de severidad crítica, cierre, verificación eficaz o comercio exterior
- **THEN** su `Tipo` es `SEVERIDAD_CRITICA`, `CIERRE`, `VERIFICACION_EFICAZ` o `COMERCIO_EXTERIOR` respectivamente, nunca `CAMBIO_ESTADO`

### Requirement: NotificacionEntidadTipo
El sistema SHALL definir `NotificacionEntidadTipo = QE | NC | INCIDENTE | DOCUMENTO | AC` (mismo conjunto que el frontend, `notification-types`). `DOCUMENTO` SHALL emitirse activamente desde `be-documentos-api`: notificaciones de asignación (revisor/aprobador), rechazo, y el escaneo de vencimiento de revisión periódica (RN-DOC-006, ver requirement dedicado).

#### Scenario: EntidadTipo refleja el dominio de origen
- **WHEN** se genera una notificación desde un Quality Event, una No Conformidad, un Incidente o una Acción Correctiva
- **THEN** su `EntidadTipo` es `QE`, `NC`, `INCIDENTE` o `AC` respectivamente

#### Scenario: Notificación de Documento usa EntidadTipo DOCUMENTO
- **WHEN** se genera cualquier notificación con origen en un `Documento` (asignación, rechazo, o vencimiento de revisión)
- **THEN** su `EntidadTipo` es `DOCUMENTO`

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

### Requirement: Escaneo idempotente de vencimiento de revisión periódica de Documentos (RN-DOC-006)
El sistema SHALL extender el escaneo de vencimientos (`VencimientoScanner.ScanAsync`) con un cuarto bloque sobre `Documento`, limitado a documentos con `Estado == PUBLICADO`, `DeletedAt == null` y `FechaRevisionProxima` no nula. "Hoy" SHALL calcularse como fecha de calendario en `America/Lima` (no UTC del servidor), una sola vez por corrida del escaneo.

Para cada documento que cumple el filtro, SHALL calcular `diasRestantes = (FechaRevisionProxima.Date - hoyLima).Days` y distinguir dos ramas mutuamente excluyentes:
- **Preaviso** (`0 < diasRestantes <= 30`): SHALL crear una notificación `VENCIMIENTO` por destinatario (autor + todo usuario con rol efectivo `JEFE_CONTROL_DOCUMENTARIO`/`JEFE_CALIDAD_SYST` en la empresa del documento, igual que antes) con el mensaje "El documento {código} vence su revisión periódica el {dd/mm/aaaa}".
- **Vencido** (`diasRestantes <= 0`): SHALL, además de notificar a los mismos destinatarios con el mensaje "La revisión periódica de {código} está vencida desde {fecha}. Debe iniciarse la revisión.", agregar **una** entrada `REVISION_PERIODICA_VENCIDA` al audit trail del documento, con `RealizadoPorId: "system"`, `RealizadoPorNombre: "Sistema"`, `GeneradoPorIA: true`, y el motivo o `ValorNuevo` indicando la fecha de revisión vencida ("Fecha de revisión periódica alcanzada: dd/mm/aaaa").
- Documentos con `diasRestantes > 30` SHALL omitirse sin generar nada.

La idempotencia SHALL evaluarse por **ciclo**: cada rama usa una `CicloClave` derivada de la `FechaRevisionProxima` vigente (p.ej. `"PREAVISO:{fecha:yyyy-MM-dd}"` / `"VENCIDO:{fecha:yyyy-MM-dd}"`), reforzada por el índice único `(EntidadTipo, EntidadId, UsuarioId, CicloClave)` filtrado a `Tipo = 'VENCIMIENTO'`. Mientras la `FechaRevisionProxima` del documento no cambie, cada rama SHALL generar como máximo un lote de notificaciones (y, en el caso de vencido, una sola entrada de audit trail); al confirmarse una `FechaRevisionProxima` nueva (ver `ConfirmarRevisionPeriodicaHandler`), el ciclo siguiente SHALL volver a evaluar y notificar independientemente de los avisos de ciclos anteriores, que SHALL NOT borrarse.

#### Scenario: Documento a 15 días de su revisión notifica a autor y jefes (preaviso)
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` a 15 días corridos (calculados en `America/Lima`), sin notificación `VENCIMIENTO` previa para ese ciclo, en una empresa con un `JEFE_CALIDAD_SYST` y un `JEFE_CONTROL_DOCUMENTARIO` distintos del autor
- **THEN** se crean 3 notificaciones `VENCIMIENTO` (autor + 2 jefes) con la `CicloClave` de preaviso de ese ciclo

#### Scenario: Documento a más de 30 días no genera notificación
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` a 45 días corridos
- **THEN** no se crea ninguna notificación `VENCIMIENTO` para ese documento

#### Scenario: Documento vencido genera notificación de vencido y una entrada de audit trail
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` en el pasado, sin notificación de vencido previa para ese ciclo
- **THEN** se crea la notificación `VENCIMIENTO` de vencido para cada destinatario, y el audit trail del documento gana exactamente una entrada `REVISION_PERIODICA_VENCIDA` con actor `"Sistema"`

#### Scenario: Repetir el escaneo en el mismo ciclo no duplica notificaciones ni la entrada de audit trail
- **WHEN** el escaneo se ejecuta dos veces seguidas sin que cambie `FechaRevisionProxima`
- **THEN** la segunda ejecución no crea notificaciones adicionales ni una segunda entrada `REVISION_PERIODICA_VENCIDA`, incluso si un nuevo `JEFE_CALIDAD_SYST` se incorporó a la empresa entre ambas corridas

#### Scenario: Confirmar la vigencia con una fecha nueva vuelve a habilitar los avisos del ciclo siguiente
- **WHEN** un documento ya generó sus avisos de preaviso y/o vencido para una `FechaRevisionProxima`, y luego se confirma la revisión periódica con una `FechaRevisionProxima` distinta
- **THEN** cuando esa nueva fecha entra en la ventana de 30 días, el escaneo vuelve a generar el preaviso correspondiente — sin borrar las notificaciones del ciclo anterior

#### Scenario: Documentos en BORRADOR, OBSOLETO o EN_REVISION_PERIODICA no generan avisos
- **WHEN** un documento en `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, `OBSOLETO` o `EN_REVISION_PERIODICA` tiene `fechaRevisionProxima` dentro de la ventana de 30 días (heredada de un ciclo anterior)
- **THEN** el escaneo lo omite sin generar ninguna notificación ni entrada de audit trail

#### Scenario: Documento sin fechaRevisionProxima nunca dispara este escaneo
- **WHEN** un documento tiene `fechaRevisionProxima` nula (p.ej. tipo `INF` sin revisión periódica)
- **THEN** el escaneo lo omite sin evaluarlo

#### Scenario: El escaneo ejecuta dentro del mismo BackgroundService
- **WHEN** corre `VencimientoScanService`
- **THEN** evalúa Acciones Correctivas y Documentos en la misma corrida, sin un proceso separado

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

### Requirement: Escaneo idempotente del plazo para vincular un QE a un incidente (RN-INC-006)
El `VencimientoScanner` SHALL evaluar, en cada corrida, los incidentes activos sin QE: `QeId` nulo, no eliminados y en un estado distinto de `CERRADO`/`ANULADO`. Lo hace contra el plazo de su tipo (ACCIDENTE 24 h, INCIDENTE 48 h, CUASI_ACCIDENTE 72 h, CONDICION_INSEGURA 48 h), en horas corridas desde `FechaEvento` en UTC, con dos ramas excluyentes:
- **Preaviso:** transcurrido ≥ 75 % y < 100 %. `CicloClave = "QE_PREAVISO"`, mensaje "El incidente {numero} ({tipo}) vence en {X} h su plazo para vincular un Quality Event.".
- **Vencido:** transcurrido ≥ 100 %. `CicloClave = "QE_VENCIDO"`, mensaje "El incidente {numero} ({tipo}) superó su plazo de {plazo} h para vincular un Quality Event.". Esta rama además agrega al audit trail del incidente `PLAZO_QE_VENCIDO`, con `ValorNuevo = "{plazo} h"`, actor "Sistema" y `GeneradoPorIA = true`.

Destinatarios y formato:
- Destinatarios: los `UsuariosEmpresa` en estado `ACTIVO` de la empresa del incidente con rol `JEFE_CALIDAD_SYST` o `SUPERVISOR`, sin duplicados.
- Notificación: `Tipo = VENCIMIENTO`, `EntidadTipo = INCIDENTE`, `EntidadCodigo` = número y `link = /incidents/{id}`.

Idempotencia: SHALL evaluarse por incidente y `CicloClave` antes de generar el lote, de modo que una segunda corrida no duplique notificaciones ni la entrada de audit.

#### Scenario: Preaviso de un ACCIDENTE
- **WHEN** un ACCIDENTE sin QE lleva 19 h desde `FechaEvento`
- **THEN** cada JCA y SUP activo de la empresa recibe una notificación `VENCIMIENTO` con `CicloClave = QE_PREAVISO`, y no se agrega audit trail

#### Scenario: Vencido de un ACCIDENTE
- **WHEN** un ACCIDENTE sin QE lleva 25 h desde `FechaEvento`
- **THEN** cada JCA y SUP activo recibe una notificación con `CicloClave = QE_VENCIDO`, y el incidente tiene una entrada `PLAZO_QE_VENCIDO` con actor Sistema

#### Scenario: Segunda corrida no duplica
- **WHEN** el escaneo se ejecuta dos veces seguidas sobre el mismo incidente vencido
- **THEN** la segunda corrida no crea notificaciones ni audit trail nuevos

#### Scenario: Incidentes excluidos
- **WHEN** el incidente tiene QE, está eliminado o está `ANULADO`
- **THEN** el escaneo no genera nada para él

#### Scenario: Destinatarios inactivos o de otra empresa
- **WHEN** hay un SUPERVISOR inactivo en la empresa y un JCA activo en otra empresa
- **THEN** ninguno de los dos recibe la notificación
