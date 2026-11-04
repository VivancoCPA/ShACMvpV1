# be-documentos-api

## Purpose

Backend .NET del módulo Control Documentario (M1): entidad `Documento` persistida con máquina de estados estricta (`BORRADOR → EN_REVISION → EN_APROBACION → PUBLICADO → {OBSOLETO, EN_REVISION_PERIODICA}`), código correlativo por tipo y empresa, confidencialidad con control de acceso por rol, permisos derivados de un `docRole` por documento (no del rol global del actor), bandeja de pendientes, firma con PIN y publicación (obsoletización automática de la versión previa), nueva versión con copia física del archivo original, revisión periódica, gestión del archivo original editable (congelable, con archivado por timestamp) y el PDF de distribución generado en la firma, exportación de PDF controlado con marca de agua y auditoría, descargas firmadas con TTL, y aislamiento multi-tenant — reemplazando el CRUD que hoy solo existe contra MSW en el frontend.

## Requirements

### Requirement: Entidad Documento y máquina de estados
El sistema SHALL persistir `Documento` con `Id (Guid)`, `Codigo`, `Titulo`, `Tipo (DocType)`, `Version`, `Estado (DocStatus)`, `AreaId (string, código del catálogo Area — p.ej. "area-001", no un Guid; mismo tipo que `QualityEvent.AreaId`/`Incidente.AreaId`, confirmado en `Domain/Entities/Area.cs`, que usa `Id` string por diseño)`, `EmpresaId (Guid)`, `Confidencialidad`, `RolesAutorizados`, `AutorId`, `RevisorId?`, `AprobadorId?`, `FechaEmision?`, `FechaVigencia?`, `FechaRevisionProxima?`, `MotivoVersion?`, `Descripcion? (max 2000)`, `ArchivoOriginalUrl?`, `ArchivoOriginalNombre?`, `ArchivoOriginalBloqueado (bool, default false)`, `ArchivoDistribucionUrl?`, `QeVinculados (List<Guid>, sin tabla puente ni UI de vinculación en este módulo)`, `VersionAnteriorId? (self-FK)`, `DeletedAt?`, `CreadoEn`, `ActualizadoEn`. El sistema SHALL implementar exactamente las transiciones: `BORRADOR → EN_REVISION`; `EN_REVISION → EN_APROBACION, BORRADOR`; `EN_APROBACION → PUBLICADO, BORRADOR`; `PUBLICADO → OBSOLETO, EN_REVISION_PERIODICA`; `EN_REVISION_PERIODICA → BORRADOR, PUBLICADO`; `OBSOLETO` SHALL NOT tener transiciones salientes. Cualquier transición fuera de esta lista SHALL responder `422`.

#### Scenario: Transición válida es aceptada
- **WHEN** un documento en `BORRADOR` recibe una solicitud de cambio a `EN_REVISION`
- **THEN** el sistema acepta la transición

#### Scenario: Transición inválida es rechazada
- **WHEN** un documento en `BORRADOR` recibe una solicitud de cambio directo a `PUBLICADO`
- **THEN** el sistema responde `422` sin modificar el estado

#### Scenario: OBSOLETO no tiene transiciones salientes
- **WHEN** un documento en `OBSOLETO` recibe cualquier solicitud de cambio de estado
- **THEN** el sistema responde `422`

### Requirement: Generación de código correlativo por tipo de documento
El sistema SHALL generar `Codigo` con el formato `"{TIPO}-CD-{NNN}"` (p.ej. `PRC-CD-007`), sin componente de año, usando una secuencia atómica independiente por `(EmpresaId, DocType)` sobre la tabla `empresa_secuencias` (`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`, mismo mecanismo que `LocalZonaNumeroGenerator`), con clave `Tipo = "DOC_" + tipo` y `Anio` fijo en `0`.

#### Scenario: Dos documentos del mismo tipo generan códigos consecutivos
- **WHEN** se crean dos documentos `PRC` seguidos en la misma empresa
- **THEN** sus códigos son `PRC-CD-001` y `PRC-CD-002`

#### Scenario: Documentos de distinto tipo tienen secuencias independientes
- **WHEN** se crea un documento `PRC` y luego un documento `POL` en la misma empresa
- **THEN** el código del `POL` es `POL-CD-001`, no continúa la secuencia de `PRC`

#### Scenario: La secuencia es independiente por empresa
- **WHEN** dos empresas distintas crean cada una su primer documento `PRC`
- **THEN** ambos códigos son `PRC-CD-001`, sin colisión entre empresas

### Requirement: Confidencialidad y control de acceso
El sistema SHALL filtrar el listado y revalidar el detalle según `Confidencialidad`: `PUBLICO`/`INTERNO` visibles a cualquier rol con acceso al módulo (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`); `CONFIDENCIAL` visible solo a `JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`; `RESTRINGIDO` visible solo a roles listados en `RolesAutorizados`. Al crear o editar con `Confidencialidad: RESTRINGIDO`, el sistema SHALL rechazar con `422` si `RolesAutorizados` está vacío o ausente. `RolesAutorizados` SHALL aceptar únicamente los 6 roles operativos (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`) — nunca `ADMINISTRADOR_SISTEMA`, `ADMINISTRADOR_EMPRESA` ni `SUPERADMIN`.

#### Scenario: OPERARIO no ve documentos CONFIDENCIAL en el listado
- **WHEN** un `OPERARIO` solicita `GET /api/documents`
- **THEN** los documentos con `confidencialidad: CONFIDENCIAL` o `RESTRINGIDO` (sin su rol en `rolesAutorizados`) están ausentes de la respuesta

#### Scenario: RESTRINGIDO sin roles autorizados es rechazado al crear
- **WHEN** se envía `POST /api/documents` con `confidencialidad: RESTRINGIDO` y `rolesAutorizados: []`
- **THEN** el sistema responde `422`

#### Scenario: Acceso directo a un documento CONFIDENCIAL sin rol habilitado
- **WHEN** un `SUPERVISOR` solicita `GET /api/documents/:id` de un documento `CONFIDENCIAL`
- **THEN** el sistema responde `404` (mismo criterio de no revelar existencia que el aislamiento multi-tenant)

### Requirement: Bandeja de pendientes por rol y asignación
El sistema SHALL exponer `GET /api/documents?pendientes=true` y `GET /api/documents/pendientes/count`, con un único criterio de "pendiente" que depende exclusivamente de la asignación directa del actor sobre el documento, igual para todos los roles: `estado == BORRADOR AND AutorId == actor.Id` (le toca enviarlo a revisión); `estado == EN_REVISION AND RevisorId == actor.Id`; `estado == EN_APROBACION AND AprobadorId == actor.Id`. El único caso que depende del rol global en vez de una asignación individual es `estado == EN_REVISION_PERIODICA`, visible para `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO` (esa etapa no tiene un asignado individual). Ambos endpoints SHALL aplicar además `DeletedAt IS NULL` y la cláusula de confidencialidad (ver Requirement "Confidencialidad y control de acceso"), de modo que el número de `GET /api/documents/pendientes/count` coincida siempre con la cantidad de filas que devuelve `GET /api/documents?pendientes=true` para el mismo actor.

#### Scenario: El autor ve su propio BORRADOR sin enviar
- **WHEN** el `AutorId` de un documento `BORRADOR` solicita `GET /api/documents?pendientes=true`
- **THEN** la respuesta incluye ese documento

#### Scenario: Un AUDITOR_INTERNO revisor ve su EN_REVISION asignado
- **WHEN** un `AUDITOR_INTERNO` asignado como `RevisorId` de un documento `EN_REVISION` solicita `GET /api/documents?pendientes=true`
- **THEN** la respuesta incluye ese documento

#### Scenario: Una ALTA_DIRECCION aprobadora ve su EN_APROBACION asignado
- **WHEN** un `ALTA_DIRECCION` asignado como `AprobadorId` de un documento `EN_APROBACION` solicita `GET /api/documents?pendientes=true`
- **THEN** la respuesta incluye ese documento

#### Scenario: JEFE_CALIDAD_SYST que no es el revisor asignado no ve un EN_REVISION ajeno
- **WHEN** un `JEFE_CALIDAD_SYST` que no es el `RevisorId` de un documento `EN_REVISION` solicita `GET /api/documents?pendientes=true`
- **THEN** ese documento NO aparece en la respuesta, a menos que además sea `AutorId`, `RevisorId` o `AprobadorId` de otro documento

#### Scenario: JEFE_CALIDAD_SYST y JEFE_CONTROL_DOCUMENTARIO ven EN_REVISION_PERIODICA
- **WHEN** cualquiera de los dos roles solicita `GET /api/documents?pendientes=true`
- **THEN** la respuesta incluye todo documento `EN_REVISION_PERIODICA` de la empresa activa, sin requerir asignación individual

#### Scenario: El contador coincide con el listado filtrado
- **WHEN** el mismo actor solicita `GET /api/documents/pendientes/count` y luego `GET /api/documents?pendientes=true`
- **THEN** el valor de `count` es igual a la cantidad de elementos devueltos por el listado

#### Scenario: Documentos de otra empresa, eliminados u ocultos por confidencialidad no se cuentan
- **WHEN** existen documentos que calificarían como pendientes del actor pero pertenecen a otra empresa, están eliminados (`DeletedAt` no nulo), o son `RESTRINGIDO`/`CONFIDENCIAL` sin que el actor tenga el rol habilitado
- **THEN** ninguno de ellos se incluye en el conteo ni en el listado filtrado

### Requirement: Permisos por (estado, docRole)
El sistema SHALL resolver `docRole` por documento (no por rol global del actor) en este orden: `AUTOR` si `AutorId == actor.Id`; si no, `REVISOR` si `RevisorId == actor.Id`; si no, `APROBADOR` si `AprobadorId == actor.Id`; si no, `JEFE_CALIDAD` si el rol global es `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`; si no, `OPERARIO`. El sistema SHALL aplicar la matriz de 9 permisos (`canRead, canEdit, canDelete, canComment, canApprove, canReject, canSign, canStartReview, canCancelReview`) por `(estado, docRole)` idéntica a `document-permissions` (frontend), incluyendo que en `EN_REVISION_PERIODICA` solo el `AUTOR` asignado a esa versión puede editar, y que `OBSOLETO` es de solo lectura para todo `docRole` (RN-DOC-003).

#### Scenario: Autor sin ser el asignado no puede editar en EN_REVISION_PERIODICA
- **WHEN** un usuario con `docRole: AUTOR` mutila la única versión activa de un documento en `EN_REVISION_PERIODICA` donde el autor asignado es otro usuario
- **THEN** el sistema rechaza la edición

#### Scenario: Ningún rol puede mutar un documento OBSOLETO
- **WHEN** cualquier endpoint de mutación se invoca sobre un documento `OBSOLETO`
- **THEN** el sistema responde con un error de negocio, sin excepción por rol

### Requirement: Creación de Documento (RN-DOC-019, RN-DOC-020)
El sistema SHALL exponer `POST /api/documents`, creando el documento en `BORRADOR` con un `Codigo` generado por una secuencia atómica monótona (nunca reutilizable — ver Requirement "Generación de código correlativo"). SHALL responder `422` si `RevisorId == AprobadorId` (RN-DOC-019). SHALL responder `422` si `FechaVigencia` está definida y `FechaRevisionProxima` no cumple el margen mínimo de 30 días respecto a `FechaVigencia` (RN-DOC-020), excepto cuando `Tipo == INF`, donde `FechaRevisionProxima` es opcional y la validación no aplica si el campo queda vacío. SHALL rechazar con error de validación por campo un `RevisorId`/`AprobadorId` que no sea un usuario activo de la empresa activa con rol elegible y distinto del autor (ver capability `documentos-candidatos-asignacion`). SHALL responder `401` si el actor no tiene empresa activa. A diferencia de `NuevaVersionDocumento`, este endpoint NO revalida RN-DOC-001 (bloqueo de doble-versión-en-proceso): como el `Codigo` siempre es recién generado por una secuencia que nunca produce un valor ya existente, la colisión que motiva esa regla en `NuevaVersionDocumento` (donde el código SÍ se reutiliza entre versiones) es estructuralmente imposible aquí.

#### Scenario: Creación exitosa en BORRADOR
- **WHEN** se envía `POST /api/documents` con datos válidos
- **THEN** el sistema responde `201` con el documento en `estado: BORRADOR` y un `codigo` generado

#### Scenario: Revisor y aprobador no pueden ser la misma persona
- **WHEN** se envía `POST /api/documents` con `revisorId` igual a `aprobadorId`
- **THEN** el sistema responde `422`

#### Scenario: fechaRevisionProxima sin el margen mínimo es rechazada
- **WHEN** se envía `fechaVigencia` y `fechaRevisionProxima` a menos de 30 días de diferencia, con `tipo` distinto de `INF`
- **THEN** el sistema responde `422`

#### Scenario: INF sin fechaRevisionProxima es aceptado con fechaVigencia definida
- **WHEN** se envía `tipo: INF`, `fechaVigencia` definida y `fechaRevisionProxima` ausente
- **THEN** el sistema acepta la creación sin exigir `fechaRevisionProxima`

#### Scenario: Revisor de otra empresa es rechazado
- **WHEN** se envía `POST /api/documents` con un `revisorId` que pertenece a otra empresa
- **THEN** el sistema rechaza con error de validación en `revisorId` y no crea el documento

### Requirement: Edición de Documento
El sistema SHALL exponer `PUT /api/documents/:id`, permitiendo la edición solo si `estado == BORRADOR` (`409` en cualquier otro estado). SHALL reaplicar las mismas validaciones RN-DOC-019/RN-DOC-020 de creación, y la validación de elegibilidad de `RevisorId`/`AprobadorId` (contra el `AutorId` persistido).

#### Scenario: Edición rechazada fuera de BORRADOR
- **WHEN** se envía `PUT /api/documents/:id` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `409`

#### Scenario: Aprobador no elegible en edición es rechazado
- **WHEN** se envía `PUT /api/documents/:id` con un `aprobadorId` de rol `SUPERVISOR`
- **THEN** el sistema rechaza con error de validación en `aprobadorId`

### Requirement: Eliminación y restauración (soft delete)
El sistema SHALL exponer `DELETE /api/documents/:id`, marcando `DeletedAt` solo si `estado ∈ {BORRADOR, EN_REVISION}` y el documento no tiene ningún vínculo en la tabla puente `DocumentoQualityEvent` ni en la tabla puente `DocumentoNoConformidad` (protección de integridad propia de este endpoint, sin distinguir el estado de la entidad vinculada — no se deriva de RN-DOC-005, que gobierna la obsoletización, no el borrado). SHALL responder `409` si ya está eliminado, si el estado no califica, o si tiene vínculos de cualquiera de los dos tipos. El sistema SHALL exponer `PATCH /api/documents/:id/restaurar`, permitido únicamente a los roles `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` (`403` para cualquier otro rol, incluido `JEFE_CONTROL_DOCUMENTARIO`), que limpia `DeletedAt` y fija `Estado: BORRADOR` incondicionalmente, sin importar el estado que tenía al momento de eliminarse.

#### Scenario: Eliminación exitosa en BORRADOR
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento en `BORRADOR` sin vínculos activos
- **THEN** el sistema responde `200` con el documento marcado como eliminado, que queda excluido del listado por defecto

#### Scenario: Eliminación rechazada por estado no válido
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento `PUBLICADO`
- **THEN** el sistema responde `409`

#### Scenario: Eliminación rechazada por vínculo QE existente
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento con al menos un vínculo en la tabla puente `DocumentoQualityEvent`, sin importar el estado de ese QE
- **THEN** el sistema responde `409`

#### Scenario: Eliminación rechazada por vínculo NC existente
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento sin vínculos de QE pero con al menos un vínculo en la tabla puente `DocumentoNoConformidad`, sin importar el estado de esa NC
- **THEN** el sistema responde `409`

#### Scenario: Restaurar siempre vuelve a BORRADOR
- **WHEN** se envía `PATCH /api/documents/:id/restaurar` sobre un documento eliminado que estaba en `EN_REVISION` al momento de eliminarse, solicitado por un `JEFE_CALIDAD_SYST`
- **THEN** el sistema responde `200` con `estado: BORRADOR`, no `EN_REVISION`

#### Scenario: ALTA_DIRECCION puede restaurar
- **WHEN** un `ALTA_DIRECCION` envía `PATCH /api/documents/:id/restaurar` sobre un documento eliminado de su empresa
- **THEN** el sistema responde `200`

#### Scenario: Rol sin permiso no puede restaurar
- **WHEN** un `JEFE_CONTROL_DOCUMENTARIO`, `OPERARIO`, `SUPERVISOR` o `AUDITOR_INTERNO` envía `PATCH /api/documents/:id/restaurar`
- **THEN** el sistema responde `403` y el documento sigue eliminado

### Requirement: Cambio de estado sin firma
El sistema SHALL exponer `PATCH /api/documents/:id/status` con `{ estado, motivo?, notificarAutor? }`, validando la transición contra la máquina de estados y los permisos del `docRole` del actor. SHALL usarse para toda transición que no requiera PIN: enviar a revisión, aprobar revisión, cancelar revisión, rechazar (`EN_REVISION → BORRADOR` o `EN_APROBACION → BORRADOR`, con `motivo` mínimo 20 caracteres cuando se usa como rechazo), iniciar/cancelar revisión periódica. El sistema SHALL NOT exponer un endpoint `POST /:id/status` separado con firma obligatoria — esa transición (la única que requiere PIN, `EN_APROBACION → PUBLICADO`) se cubre exclusivamente por `POST /:id/sign`. Además de la notificación de rechazo ya existente, el sistema SHALL disparar, best-effort (try/catch, después de `SaveChangesAsync`, nunca falla la transición), una notificación por cada transición exitosa distinta del rechazo: `BORRADOR → EN_REVISION` notifica `ASIGNACION` al `RevisorId`; `EN_REVISION → EN_APROBACION` notifica `ASIGNACION` al `AprobadorId`; `EN_REVISION → BORRADOR` sin `motivo` (cancelar revisión) notifica `CAMBIO_ESTADO` al `AutorId` y al `RevisorId`; `PUBLICADO → EN_REVISION_PERIODICA` notifica `CAMBIO_ESTADO` al `AutorId`. Ninguna de estas notificaciones SHALL enviarse al propio actor de la transición, ni si el destinatario es `null`.

Las transiciones `_ → BORRADOR` SHALL registrar una entrada de audit trail con la acción específica del caso, nunca `ESTADO_CAMBIADO`, y el motivo (si existe) SHALL guardarse en el campo `Motivo` de `DocumentoAuditTrail` — nunca en `ValorAnterior`:
- `EN_REVISION → BORRADOR` con `motivo` (rechazo del revisor, `docRole` con `CanReject`) → `Accion: RECHAZADO_EN_REVISION`.
- `EN_APROBACION → BORRADOR` (rechazo del aprobador, `docRole` con `CanReject`) → `Accion: RECHAZADO_EN_APROBACION`.
- `EN_REVISION → BORRADOR` sin `motivo` (cancelación del Jefe de Calidad, `docRole` con `CanEdit`) → `Accion: REVISION_CANCELADA`, sin `Motivo`.

En las tres entradas, `EstadoAnterior` y `EstadoNuevo` SHALL seguir llenándose igual que antes. El resto de transiciones (enviar a revisión, aprobar revisión, cancelar revisión periódica) SHALL seguir registrando `ESTADO_CAMBIADO` sin cambios; iniciar la revisión periódica registra su propia acción (ver abajo).

En la transición `BORRADOR → EN_REVISION`, el sistema SHALL validar, antes de evaluar los permisos del `docRole`, que el documento tenga `RevisorId` y `AprobadorId` asignados; si falta alguno SHALL responder con un error de validación por campo (mismo formato que `FieldValidationException`, `400`, no `403` ni `422`) indicando qué campo falta, sin modificar el estado del documento.

La transición `PUBLICADO → EN_REVISION_PERIODICA` SHALL registrarse en el audit trail con su propia acción `REVISION_PERIODICA_INICIADA` (no el `ESTADO_CAMBIADO` genérico), con un `Motivo` calculado server-side — el `motivo` que venga en el body SHALL ignorarse para esta transición específica:
- `"Revisión sin fecha programada"` si el documento no tiene `FechaRevisionProxima`.
- `"Revisión programada (fecha dd/mm/aaaa)"` si quedan 30 días corridos o menos hasta `FechaRevisionProxima` (calculados contra "hoy" en `America/Lima`), incluyendo una fecha ya vencida.
- `"Revisión anticipada (programada para dd/mm/aaaa)"` si quedan más de 30 días.

Excepción a la validación por `docRole`: las transiciones `PUBLICADO → EN_REVISION_PERIODICA` y `EN_REVISION_PERIODICA → BORRADOR` SHALL autorizarse por `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(actorRolGlobal)` (rol global `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`), no por los flags `CanStartReview`/`CanCancelReview` de la matriz `(estado, docRole)` — un actor con ese rol global autoriza estas dos transiciones aunque su `docRole` resuelto para ese documento sea `AUTOR`, `REVISOR` o `APROBADOR`. Cualquier otro rol SHALL recibir `403`.

#### Scenario: Rechazo con motivo y notificación al autor
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: BORRADOR, motivo: "..." (20+ caracteres), notificarAutor: true }` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `200` con `estado: BORRADOR` y dispara una notificación best-effort al autor

#### Scenario: Motivo insuficiente en rechazo
- **WHEN** se envía `motivo` con menos de 20 caracteres en una transición a `BORRADOR` marcada como rechazo
- **THEN** el sistema responde `422`

#### Scenario: Enviar a revisión notifica al revisor asignado
- **WHEN** el autor envía `PATCH /:id/status` con `{ estado: EN_REVISION }` sobre un documento `BORRADOR` con `RevisorId` asignado distinto del autor
- **THEN** se crea una notificación `ASIGNACION` para el `RevisorId`, con un mensaje que indica que el documento está listo para su revisión

#### Scenario: Aprobar revisión notifica al aprobador asignado
- **WHEN** el revisor envía `PATCH /:id/status` con `{ estado: EN_APROBACION }` sobre un documento `EN_REVISION` con `AprobadorId` asignado distinto del revisor
- **THEN** se crea una notificación `ASIGNACION` para el `AprobadorId`, con un mensaje que indica que el documento está listo para su aprobación

#### Scenario: Cancelar revisión (sin motivo) notifica a autor y revisor
- **WHEN** el `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: BORRADOR }` sin `motivo` sobre un documento `EN_REVISION`
- **THEN** se crean notificaciones `CAMBIO_ESTADO` para el `AutorId` y el `RevisorId`, excluyendo al actor si coincide con alguno de los dos

#### Scenario: Iniciar revisión periódica notifica al autor
- **WHEN** se envía `PATCH /:id/status` con `{ estado: EN_REVISION_PERIODICA }` sobre un documento `PUBLICADO`
- **THEN** se crea una notificación `CAMBIO_ESTADO` para el `AutorId`, indicando que le toca iniciar la nueva versión

#### Scenario: El actor nunca se notifica a sí mismo
- **WHEN** el `AutorId` de un documento envía `PATCH /:id/status` con `{ estado: EN_REVISION_PERIODICA }` y es también el actor de la transición
- **THEN** no se crea ninguna notificación para ese actor

#### Scenario: Destinatario nulo no genera notificación
- **WHEN** el destinatario que correspondería notificar en una transición exitosa es `null` (p.ej. `AutorId`/`RevisorId` sin asignar al cancelar una revisión)
- **THEN** no se intenta crear ninguna notificación para ese destinatario

#### Scenario: Una falla del sender no revierte la transición
- **WHEN** el envío de la notificación best-effort lanza una excepción durante cualquiera de estas transiciones
- **THEN** la respuesta sigue siendo `200` con el nuevo `estado` persistido, sin revertir el cambio

#### Scenario: Rechazo del revisor registra RECHAZADO_EN_REVISION con el motivo
- **WHEN** un revisor rechaza un documento en `EN_REVISION` con un `motivo` válido
- **THEN** la respuesta incluye una única entrada nueva de audit trail con `accion: 'RECHAZADO_EN_REVISION'`, `estadoAnterior: 'EN_REVISION'`, `estadoNuevo: 'BORRADOR'`, `motivo` igual al texto enviado, y `valorAnterior` nulo

#### Scenario: Rechazo del aprobador registra RECHAZADO_EN_APROBACION con el motivo
- **WHEN** el aprobador asignado rechaza un documento en `EN_APROBACION` con un `motivo` válido
- **THEN** la respuesta incluye una única entrada nueva de audit trail con `accion: 'RECHAZADO_EN_APROBACION'`, `estadoAnterior: 'EN_APROBACION'`, `estadoNuevo: 'BORRADOR'`, y `motivo` igual al texto enviado

#### Scenario: Cancelación de revisión registra REVISION_CANCELADA sin motivo
- **WHEN** un `JEFE_CALIDAD_SYST` cancela la revisión de un documento en `EN_REVISION` sin enviar `motivo`
- **THEN** la respuesta incluye una única entrada nueva de audit trail con `accion: 'REVISION_CANCELADA'`, `estadoAnterior: 'EN_REVISION'`, `estadoNuevo: 'BORRADOR'`, y `motivo` nulo

#### Scenario: GET del documento expone el motivo del rechazo
- **WHEN** se consulta `GET /api/documents/:id` de un documento cuya última transición fue un rechazo con motivo
- **THEN** la entrada correspondiente del `auditTrail` devuelto incluye el campo `motivo` con el texto completo

#### Scenario: La notificación de rechazo incluye un extracto del motivo
- **WHEN** se rechaza un documento con `notificarAutor: true` y un `motivo` de más de 120 caracteres
- **THEN** la notificación creada para el autor incluye los primeros 120 caracteres del motivo en su `Mensaje`, y el texto completo sigue disponible en el audit trail del documento

#### Scenario: Enviar a revisión sin revisor asignado es rechazado con error de campo
- **WHEN** se envía `PATCH /:id/status` con `{ estado: EN_REVISION }` sobre un `BORRADOR` cuyo `revisorId` es `null`
- **THEN** el sistema responde `400` con un error de validación en el campo `revisorId`, y el documento permanece en `BORRADOR`

#### Scenario: Enviar a revisión sin aprobador asignado es rechazado con error de campo
- **WHEN** se envía `PATCH /:id/status` con `{ estado: EN_REVISION }` sobre un `BORRADOR` cuyo `aprobadorId` es `null`
- **THEN** el sistema responde `400` con un error de validación en el campo `aprobadorId`, y el documento permanece en `BORRADOR`

#### Scenario: Un JEFE_CALIDAD que es revisor o aprobador asignado de un BORRADOR ajeno no puede enviarlo a revisión
- **WHEN** un `JEFE_CALIDAD_SYST` que es el `revisorId` o `aprobadorId` asignado de un `BORRADOR` cuyo autor es otra persona intenta `PATCH /:id/status` con `{ estado: EN_REVISION }`
- **THEN** el sistema responde `403` — el `docRole` resuelto es `REVISOR`/`APROBADOR` (precedencia sobre `JEFE_CALIDAD`), que no tiene `CanEdit` en `BORRADOR`; comportamiento esperado, no afectado por este fix

#### Scenario: Iniciar revisión periódica con fecha próxima registra motivo "programada"
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: EN_REVISION_PERIODICA }` sobre un documento `PUBLICADO` cuya `fechaRevisionProxima` está a 10 días o ya vencida
- **THEN** el audit trail gana una entrada `REVISION_PERIODICA_INICIADA` con `Motivo: "Revisión programada (fecha dd/mm/aaaa)"`

#### Scenario: Iniciar revisión periódica con fecha lejana registra motivo "anticipada"
- **WHEN** se inicia la revisión periódica de un documento cuya `fechaRevisionProxima` está a 90 días
- **THEN** el audit trail gana una entrada `REVISION_PERIODICA_INICIADA` con `Motivo: "Revisión anticipada (programada para dd/mm/aaaa)"`

#### Scenario: Iniciar revisión periódica sin fecha programada
- **WHEN** se inicia la revisión periódica de un documento `tipo: REG` sin `fechaRevisionProxima`
- **THEN** el audit trail gana una entrada `REVISION_PERIODICA_INICIADA` con `Motivo: "Revisión sin fecha programada"`

#### Scenario: El motivo enviado por el cliente se ignora para esta transición
- **WHEN** se envía `PATCH /:id/status` con `{ estado: EN_REVISION_PERIODICA, motivo: "texto arbitrario del cliente" }`
- **THEN** el `Motivo` persistido es el calculado server-side, no el texto enviado

#### Scenario: JEFE_CONTROL_DOCUMENTARIO que fue aprobador del documento inicia la revisión periódica
- **WHEN** un `JEFE_CONTROL_DOCUMENTARIO` que es el `AprobadorId` asignado de un documento `PUBLICADO` envía `PATCH /:id/status` con `{ estado: EN_REVISION_PERIODICA }`
- **THEN** el sistema responde `200` con `estado: EN_REVISION_PERIODICA`

#### Scenario: JEFE_CALIDAD_SYST que fue autor del documento inicia la revisión periódica
- **WHEN** un `JEFE_CALIDAD_SYST` que es el `AutorId` de un documento `PUBLICADO` envía `PATCH /:id/status` con `{ estado: EN_REVISION_PERIODICA }`
- **THEN** el sistema responde `200` con `estado: EN_REVISION_PERIODICA`

#### Scenario: SUPERVISOR no puede iniciar ni cancelar la revisión periódica
- **WHEN** un `SUPERVISOR` envía `PATCH /:id/status` con `{ estado: EN_REVISION_PERIODICA }` sobre un documento `PUBLICADO`, o con `{ estado: BORRADOR }` sobre un documento `EN_REVISION_PERIODICA`
- **THEN** el sistema responde `403` en ambos casos

#### Scenario: JEFE_CONTROL_DOCUMENTARIO que participó del documento cancela la revisión periódica
- **WHEN** un `JEFE_CONTROL_DOCUMENTARIO` que es el `RevisorId` asignado de un documento `EN_REVISION_PERIODICA` envía `PATCH /:id/status` con `{ estado: BORRADOR }`
- **THEN** el sistema responde `200` con `estado: BORRADOR`

### Requirement: Firma y publicación (RN-DOC-004)
El sistema SHALL exponer `POST /api/documents/:id/sign` con `{ pin }`, permitido solo desde `EN_APROBACION` y solo si el actor es el `docRole APROBADOR` asignado (`AprobadorId == actor.Id`) — verificación de identidad que el mock no realizaba. SHALL validar `pin` contra `ShacUser.PinHash` del actor vía `IPasswordHasher<ShacUser>`: `BusinessRuleException` con `RuleCode: "PIN_NO_CONFIGURADO"` si el actor no tiene PIN configurado, `UnauthorizedBusinessException` si el PIN no coincide.

SHALL rechazar la firma con `BusinessRuleException` (código `SIN_ARCHIVO_ORIGINAL`) si el documento no tiene `ArchivoOriginalUrl`, antes de intentar cualquier conversión — sin generar ningún PDF sustituto.

Si el PIN es válido y hay archivo original, el sistema SHALL determinar si el archivo original es un PDF nativo (por su extensión real) o un archivo Office (`.docx`/`.xlsx`). Si es un archivo Office, SHALL convertirlo a PDF (`IDocumentoPdfConverter`, ver capacidad `document-pdf-conversion`) exactamente como hoy. Si es un PDF nativo, SHALL usar sus bytes directamente como entrada de `DocumentoPdfGenerator.SellarPublicado`, sin invocar `IDocumentoPdfConverter`. En ambos casos, el sistema SHALL sellar el resultado con los metadatos de publicación en cada página y calcular su hash SHA-256, **antes** de aplicar ningún cambio de estado o persistencia.

Si la conversión (archivo Office) falla, el sistema SHALL responder con `BusinessRuleException` (código `PDF_CONVERSION_FAILED`, no un error 500 genérico) y SHALL NOT modificar el estado del documento, la versión previa, ni crear ningún archivo o entrada de audit trail — sin cambios respecto al comportamiento actual.

Si el original es un PDF nativo y `PdfSharpCore` no puede abrirlo para sellarlo (protegido con contraseña o corrupto), el sistema SHALL responder con `BusinessRuleException` (código `PDF_PROTEGIDO_O_DANADO`, no un error 500 genérico) y SHALL NOT modificar el estado del documento, la versión previa, ni crear ningún archivo o entrada de audit trail. Esto es distinto del caso ya aceptado de un PDF *convertido* por LibreOffice que `PdfSharpCore` no logra abrir (incompatibilidad rara de la salida del conversor): ese caso SHALL seguir degradando a "publicado sin sello" sin bloquear la operación, porque el PDF de entrada en ese camino es siempre un archivo bien formado generado por el propio sistema. La distinción entre ambos casos SHALL basarse en si el PDF de entrada vino de una conversión (`IDocumentoPdfConverter`) o directamente del archivo original subido por el usuario.

Al firmar exitosamente, el sistema SHALL: fijar `Estado: PUBLICADO`; obsoletizar automáticamente la versión previa `PUBLICADO` del mismo `Codigo`, si existe (RN-DOC-001); fijar `ArchivoOriginalBloqueado: true`; persistir el PDF de distribución ya convertido (o ya nativo) y sellado; registrar el hash SHA-256 del archivo publicado como `ValorNuevo` de la entrada `FIRMA_REGISTRADA` del audit trail; disparar, best-effort y después de `SaveChangesAsync`, una notificación `CAMBIO_ESTADO` informativa al `AutorId` y al `RevisorId` del documento publicado (excluyendo al actor y a cualquier destinatario nulo).

#### Scenario: Firma exitosa publica y obsoletiza la versión previa
- **WHEN** el aprobador asignado firma con su PIN correcto un documento en `EN_APROBACION` con archivo original, cuyo código ya tiene otra versión `PUBLICADO`
- **THEN** el sistema responde `200` con el documento actual en `PUBLICADO`, la versión previa pasa a `OBSOLETO`, y se genera y persiste el PDF de distribución con el contenido real del archivo original

#### Scenario: Firma rechazada si el actor no es el aprobador asignado
- **WHEN** un usuario distinto del `AprobadorId` del documento intenta `POST /:id/sign`
- **THEN** el sistema responde con un error de autorización, sin publicar el documento

#### Scenario: PIN incorrecto no publica
- **WHEN** el aprobador asignado envía un `pin` que no coincide con su `PinHash`
- **THEN** el sistema responde `401` sin cambiar el estado

#### Scenario: Actor sin PIN configurado
- **WHEN** el aprobador asignado nunca configuró su PIN (`PinHash` nulo)
- **THEN** el sistema responde `422` con `errorCode: "PIN_NO_CONFIGURADO"` en el envelope de error, sin cambiar el estado del documento

#### Scenario: Firma rechazada por falta de archivo original
- **WHEN** el aprobador asignado firma con PIN correcto un documento en `EN_APROBACION` cuyo `ArchivoOriginalUrl` es `null`
- **THEN** el sistema responde con un error de negocio (código `SIN_ARCHIVO_ORIGINAL`), el documento permanece en `EN_APROBACION`, y no se genera ningún PDF

#### Scenario: Fallo de conversión no publica nada
- **WHEN** el aprobador asignado firma con PIN correcto un documento con archivo original Office, pero la conversión a PDF falla (p.ej. el conversor no está disponible)
- **THEN** el sistema responde con un error de negocio (código `PDF_CONVERSION_FAILED`, no `500`), el documento permanece en `EN_APROBACION`, la versión previa `PUBLICADO` (si existía) no cambia de estado, y no queda ningún archivo de distribución nuevo ni entradas de audit trail de la firma

#### Scenario: El hash del archivo publicado queda en el audit trail
- **WHEN** la firma se completa exitosamente
- **THEN** la entrada `FIRMA_REGISTRADA` del audit trail tiene `ValorNuevo` igual al SHA-256 del PDF de distribución guardado

#### Scenario: Publicación notifica a autor y revisor
- **WHEN** el aprobador firma exitosamente un documento con `AutorId` y `RevisorId` distintos del aprobador
- **THEN** se crean notificaciones `CAMBIO_ESTADO` para el `AutorId` y el `RevisorId`, indicando que el documento fue publicado con su versión

#### Scenario: Publicación no notifica al propio aprobador
- **WHEN** el aprobador firmante es también el `AutorId` o el `RevisorId` del documento
- **THEN** no se crea notificación para ese rol coincidente, solo para el que sigue siendo distinto del actor

#### Scenario: Firma de un PLAN con original PDF nativo publica sin invocar el conversor
- **WHEN** el aprobador asignado firma con PIN correcto un documento `tipo: PLAN` cuyo archivo original es un PDF nativo válido
- **THEN** el sistema responde `200`, el documento queda `PUBLICADO`, el PDF de distribución tiene el sello de publicación, el hash queda registrado, y `IDocumentoPdfConverter.ConvertirAsync` no se invoca

#### Scenario: Firma de un PLAN con PDF nativo protegido no publica nada
- **WHEN** el aprobador asignado firma con PIN correcto un documento `tipo: PLAN` cuyo archivo original es un PDF cifrado con contraseña
- **THEN** el sistema responde con un error de negocio (código `PDF_PROTEGIDO_O_DANADO`, no `500`), el documento permanece en `EN_APROBACION`, y no queda ningún archivo de distribución nuevo ni entradas de audit trail de la firma

### Requirement: RN-DOC-005 evaluada en la obsoletización automática al publicar
`FirmarPublicarDocumentoHandler` (la única vía real hacia `OBSOLETO`, que obsoletiza automáticamente la versión `PUBLICADO` previa del mismo código al firmar la publicación de una nueva versión) SHALL rechazar la operación completa con `409` si la versión previa tiene un vínculo en `DocumentoQualityEvent` a un `QualityEvent` cuyo estado no es `CERRADO` ni `VERIFICADO`. Ver `documento-qe-vinculacion` para el contrato completo de la tabla puente y sus endpoints.

#### Scenario: Firma de publicación bloqueada por QE activo en la versión previa
- **WHEN** se firma la publicación de una nueva versión y la versión `PUBLICADO` previa del mismo código tiene un vínculo a un QE en `EN_INVESTIGACION`
- **THEN** el sistema responde `409`, ninguna de las dos versiones cambia de estado, y no se genera el PDF de distribución de la nueva versión

#### Scenario: Firma de publicación exitosa cuando los QE vinculados están cerrados
- **WHEN** se firma la publicación de una nueva versión y todos los vínculos de la versión previa apuntan a QEs `CERRADO` o `VERIFICADO`
- **THEN** el sistema completa la publicación: la versión previa pasa a `OBSOLETO` y la nueva a `PUBLICADO`

### Requirement: GET /api/documents/:id incluye el resumen de QEs vinculados
El sistema SHALL poblar `data.qeVinculados` en la respuesta de `GET /api/documents/:id` con el resumen `{ id, numero, tipo, severidad, estado }` de cada `QualityEvent` vinculado, consultado desde la tabla puente `DocumentoQualityEvent`. El campo `QeVinculados: Guid[]` (columna cruda) queda eliminado del modelo — este resumen lo reemplaza por completo.

#### Scenario: Detalle de documento sin vínculos
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento sin ningún vínculo
- **THEN** `data.qeVinculados` es un array vacío

#### Scenario: Detalle de documento con vínculos poblados
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento vinculado a 2 QEs
- **THEN** `data.qeVinculados` contiene 2 objetos con `id`, `numero`, `tipo`, `severidad` y `estado` de cada QE

### Requirement: GET /api/documents/:id incluye el resumen de NCs vinculadas
El sistema SHALL poblar `data.ncVinculados` en la respuesta de `GET /api/documents/:id` con el resumen `{ id, numero, tipo, severidad, estado }` de cada `NoConformidad` vinculada, consultado desde la tabla puente `DocumentoNoConformidad`. Ver `documento-nc-vinculacion` para el contrato completo de la tabla puente y sus endpoints.

#### Scenario: Detalle de documento sin vínculos de NC
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento sin ninguna NC vinculada
- **THEN** `data.ncVinculados` es un array vacío

#### Scenario: Detalle de documento con NCs vinculadas
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento vinculado a 2 NCs
- **THEN** `data.ncVinculados` contiene 2 objetos con `id`, `numero`, `tipo`, `severidad` y `estado` de cada NC

### Requirement: Nueva versión
El sistema SHALL exponer `POST /api/documents/:id/nueva-version` con `{ tipoCambio: MENOR | MAYOR, motivo (mínimo 20 caracteres) }`, permitido solo desde `PUBLICADO` o `EN_REVISION_PERIODICA`, y solo si el actor es `AutorId` del documento origen o su rol global es `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` — cualquier otro usuario autenticado de la empresa SHALL recibir `403`. SHALL crear un nuevo `Documento` en `BORRADOR` con el mismo `Codigo`, `Version` incrementada según `tipoCambio`, `VersionAnteriorId` apuntando al documento origen, y una copia física real (no una referencia) del archivo original al directorio de la nueva versión. SHALL responder `409` si ya existe otra versión del mismo código en proceso.

El nuevo documento SHALL fijar `AutorId = actorId` (quien crea la versión, nunca el autor del documento origen). `RevisorId` y `AprobadorId` SHALL heredarse del documento origen solo si son distintos de `actorId` y siguen siendo candidatos válidos para ese `actorId` (activos, con asignación activa en la empresa, rol elegible — misma regla que `DocumentoAsignacionService`); en caso contrario SHALL quedar `null`. Las notificaciones de asignación (ASIGNACION) al nuevo revisor/aprobador SHALL dispararse solo para los campos efectivamente heredados, nunca para un campo que quedó `null`.

#### Scenario: Nueva versión menor incrementa la versión correctamente
- **WHEN** se solicita `nueva-version` con `tipoCambio: MENOR` sobre un documento `v1.0` `PUBLICADO`
- **THEN** se crea un nuevo documento `BORRADOR` con `version: "v1.1"` y el mismo `codigo`

#### Scenario: Motivo insuficiente rechaza la nueva versión
- **WHEN** se envía `motivo` con menos de 20 caracteres
- **THEN** el sistema responde `422`

#### Scenario: El archivo original se copia físicamente, no se referencia
- **WHEN** se crea una nueva versión de un documento con archivo original existente
- **THEN** el nuevo documento tiene su propio archivo físico independiente en disco; modificar o eliminar el original de la versión anterior no afecta al de la nueva versión

#### Scenario: Nueva versión notifica al revisor y aprobador heredados
- **WHEN** se crea una nueva versión que hereda `RevisorId` y `AprobadorId` del documento origen, ambos distintos del actor
- **THEN** se crean notificaciones `ASIGNACION` para ambos, referenciando el `codigo` y la nueva `version`

#### Scenario: El autor de la nueva versión es quien la crea
- **WHEN** el `JEFE_CONTROL_DOCUMENTARIO` que era el revisor asignado del documento origen crea una nueva versión
- **THEN** el nuevo documento tiene `autorId` igual al `JEFE_CONTROL_DOCUMENTARIO` que la creó, no al autor del origen

#### Scenario: Revisor heredado que coincide con el nuevo autor queda vacío
- **WHEN** el nuevo autor de la versión era el `revisorId` del documento origen
- **THEN** el nuevo documento tiene `revisorId: null`, y no se dispara ninguna notificación de asignación de revisor

#### Scenario: Aprobador heredado inactivo o sin rol elegible queda vacío
- **WHEN** el `aprobadorId` del documento origen ya no está activo en la empresa, o su rol ya no es elegible como aprobador
- **THEN** el nuevo documento tiene `aprobadorId: null`

#### Scenario: Autor original que crea la versión hereda todo
- **WHEN** el mismo `AutorId` del documento origen crea la nueva versión
- **THEN** el nuevo documento conserva el mismo `revisorId` y `aprobadorId` del origen (ambos siguen siendo válidos para ese autor)

#### Scenario: Usuario sin permiso no puede crear una nueva versión
- **WHEN** un usuario que no es el `AutorId` del documento origen ni tiene rol global `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` solicita `POST /:id/nueva-version`
- **THEN** el sistema responde `403` y no crea ningún documento

### Requirement: Confirmar revisión periódica
El sistema SHALL exponer `PATCH /api/documents/:id/confirmar-revision` con un body opcional `{ fechaRevisionProxima?: "YYYY-MM-DD" | null }`, permitido solo desde `PUBLICADO` o `EN_REVISION_PERIODICA`.

Si `fechaRevisionProxima` viene en el body y no es `null`, SHALL validar que sea una fecha de calendario igual o posterior a "hoy + 30 días", calculando "hoy" como fecha de calendario en la zona horaria `America/Lima` (no UTC del servidor). Si no cumple el margen, SHALL responder con un error de validación por campo (`fechaRevisionProxima`), sin modificar el documento.

Si `fechaRevisionProxima` no viene en el body o es `null`: para `Tipo ∈ {POL, PRC, PLAN, INS, MAT}` SHALL recalcular la fecha sugerida según `Tipo` (`POL/PRC/PLAN` +12 meses, `INS` +24 meses, `MAT` +6 meses, contados desde "hoy" en `America/Lima`); para `Tipo ∈ {REG, INF}` SHALL dejar `FechaRevisionProxima` en `null`.

En cualquier caso, la fecha final (enviada o calculada) SHALL persistirse como fecha de calendario a medianoche UTC del día elegido (sin hora), igual que `FechaVigencia`/`FechaRevisionProxima` en creación/edición de documentos.

El audit trail `REVISION_PERIODICA_CONFIRMADA` SHALL registrar `ValorAnterior` (la `FechaRevisionProxima` previa, formato `YYYY-MM-DD`, o ausente si no había) y `ValorNuevo` (la fecha nueva, mismo formato) — antes solo registraba la fecha nueva.

El sistema SHALL autorizar esta acción exclusivamente por `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(actorRolGlobal)` (rol global `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`) — cualquier otro rol autenticado SHALL recibir `403`. Este gate es nuevo: antes de este requirement, el endpoint no validaba ningún permiso.

#### Scenario: Confirmar revisión de un PRC sin especificar fecha usa la sugerida
- **WHEN** se confirma revisión de un documento `tipo: PRC` sin body (o con `fechaRevisionProxima: null`)
- **THEN** la nueva `fechaRevisionProxima` es "hoy + 12 meses" (calculado en `America/Lima`), persistida como fecha de calendario sin hora

#### Scenario: Confirmar revisión con una fecha elegida válida la persiste tal cual
- **WHEN** se confirma revisión de un documento `tipo: PRC` con `{ fechaRevisionProxima: "<hoy + 60 días>" }`
- **THEN** la `fechaRevisionProxima` guardada es exactamente esa fecha, no la sugerida por tipo

#### Scenario: Fecha elegida por debajo del margen mínimo es rechazada
- **WHEN** se confirma revisión con `{ fechaRevisionProxima: "<hoy + 10 días>" }`
- **THEN** el sistema responde con un error de validación en el campo `fechaRevisionProxima`, y el documento no cambia

#### Scenario: REG sin fecha queda sin próxima revisión
- **WHEN** se confirma revisión de un documento `tipo: REG` sin body (o con `fechaRevisionProxima: null`)
- **THEN** `fechaRevisionProxima` queda `null`

#### Scenario: REG con una fecha elegida válida la acepta
- **WHEN** se confirma revisión de un documento `tipo: REG` con `{ fechaRevisionProxima: "<hoy + 45 días>" }`
- **THEN** la `fechaRevisionProxima` guardada es esa fecha

#### Scenario: El audit trail registra la fecha anterior y la nueva
- **WHEN** se confirma revisión de un documento que ya tenía `fechaRevisionProxima` definida
- **THEN** la entrada `REVISION_PERIODICA_CONFIRMADA` tiene `ValorAnterior` igual a la fecha previa y `ValorNuevo` igual a la fecha nueva, ambos en formato `YYYY-MM-DD`

#### Scenario: JEFE_CALIDAD_SYST que fue revisor del documento confirma la vigencia
- **WHEN** un `JEFE_CALIDAD_SYST` que es el `RevisorId` asignado de un documento `PUBLICADO` envía `PATCH /:id/confirmar-revision`
- **THEN** el sistema responde `200`

#### Scenario: OPERARIO no puede confirmar la revisión periódica
- **WHEN** un `OPERARIO` envía `PATCH /:id/confirmar-revision` sobre cualquier documento `PUBLICADO` o `EN_REVISION_PERIODICA`
- **THEN** el sistema responde `403`

### Requirement: Archivo original editable (RN-DOC-013, RN-DOC-015, RN-DOC-016, RN-DOC-018, CA-34)
El sistema SHALL exponer `GET /api/documents/:id/archivo-original` (descarga binaria real desde disco), permitido si `docRole != OPERARIO` y `estado ∈ {BORRADOR, EN_REVISION}`, **o** si el rol global del actor es `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION` y `estado == OBSOLETO` (CA-34, excepción de trazabilidad histórica). SHALL exponer `POST /api/documents/:id/archivo-original` (multipart, campo `archivoOriginal`) para reemplazar el original (o realizar la primera carga tras la creación), permitido solo si `docRole ∈ {AUTOR, JEFE_CALIDAD}`, `estado ∈ {BORRADOR, EN_REVISION}` y `!ArchivoOriginalBloqueado` — validación de `docRole` que el mock no aplicaba en el POST. El archivo recibido SHALL validarse contra los formatos permitidos para el `Tipo` del documento (ver Requirement "Validación de formato del archivo original por tipo de documento (RN-DOC-021)") antes de guardarse. El archivo reemplazado SHALL archivarse con timestamp (no se sobreescribe ni se borra), preservando la trazabilidad.

La respuesta de `GET /:id/archivo-original` SHALL usar el `Content-Type` real correspondiente a la extensión de `ArchivoOriginalNombre` (resuelto vía `FileExtensionContentTypeProvider`, p.ej. `application/vnd.openxmlformats-officedocument.wordprocessingml.document` para `.docx`), en vez de `application/octet-stream` fijo. Si la extensión no se reconoce, SHALL usar `application/octet-stream` como fallback.

#### Scenario: Autor descarga el original en BORRADOR
- **WHEN** el `docRole AUTOR` de un documento en `BORRADOR` solicita `GET /:id/archivo-original`
- **THEN** el sistema responde con el archivo binario real

#### Scenario: OPERARIO no puede ver el original aunque el documento esté en BORRADOR
- **WHEN** un usuario con `docRole OPERARIO` solicita `GET /:id/archivo-original` de un documento en `BORRADOR`
- **THEN** el sistema rechaza el acceso

#### Scenario: CA-34 permite a JEFE_CONTROL_DOCUMENTARIO ver el original de un OBSOLETO
- **WHEN** un usuario con rol global `JEFE_CONTROL_DOCUMENTARIO` solicita `GET /:id/archivo-original` de un documento `OBSOLETO` del cual no es `docRole` asignado
- **THEN** el sistema responde con el archivo binario real

#### Scenario: Reemplazo rechazado por docRole insuficiente
- **WHEN** un usuario con `docRole REVISOR` intenta `POST /:id/archivo-original`
- **THEN** el sistema rechaza el reemplazo, incluso si el estado es `BORRADOR`

#### Scenario: Reemplazo rechazado por congelamiento
- **WHEN** el `docRole AUTOR` intenta `POST /:id/archivo-original` con `ArchivoOriginalBloqueado: true`
- **THEN** el sistema rechaza el reemplazo

#### Scenario: El archivo anterior se archiva, no se borra
- **WHEN** se reemplaza exitosamente el archivo original
- **THEN** el archivo físico anterior permanece accesible en disco bajo un nombre con timestamp, no se elimina

#### Scenario: Content-Type real para un .docx
- **WHEN** se descarga el archivo original de un documento cuyo `ArchivoOriginalNombre` termina en `.docx`
- **THEN** la respuesta tiene `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`

#### Scenario: Content-Type real para un .xlsx
- **WHEN** se descarga el archivo original de un documento cuyo `ArchivoOriginalNombre` termina en `.xlsx`
- **THEN** la respuesta tiene `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

#### Scenario: Content-Disposition con nombre no-ASCII usa filename*
- **WHEN** se descarga el archivo original de un documento cuyo `ArchivoOriginalNombre` contiene tildes o espacios (p.ej. "Procedimiento de Inspección.docx")
- **THEN** la respuesta incluye `Content-Disposition` con un valor `filename*=UTF-8''...` codificado correctamente, además del `filename=` ASCII de respaldo

#### Scenario: Reemplazo rechazado por formato no permitido para el tipo
- **WHEN** el `docRole AUTOR` de un documento `tipo: PRC` en `BORRADOR` intenta `POST /:id/archivo-original` con un PDF
- **THEN** el sistema rechaza el reemplazo con `400`, sin tocar el archivo original existente

### Requirement: PDF de distribución
El sistema SHALL exponer `GET /api/documents/:id/archivo-distribucion` (descarga binaria del PDF ya generado al momento de la firma), accesible a cualquier actor con `canRead` base y `estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}`, sin gate adicional de asignación. El sistema SHALL NOT regenerar el PDF en cada solicitud — solo lo sirve desde disco.

El PDF de distribución generado al firmar SHALL contener el contenido real del archivo original (`.docx`/`.xlsx`), convertido a PDF, con un sello aplicado en cada página indicando código, versión, "PUBLICADO", fecha de emisión, nombre del aprobador que firmó, y "Página X de N" — sin la marca de agua de copia, que es exclusiva del PDF controlado exportado bajo demanda.

#### Scenario: OPERARIO puede descargar el PDF de distribución de un documento PUBLICADO
- **WHEN** un `OPERARIO` con acceso de lectura solicita `GET /:id/archivo-distribucion` de un documento `PUBLICADO`
- **THEN** el sistema responde con el PDF ya generado

#### Scenario: Solicitudes repetidas no regeneran el PDF
- **WHEN** se solicita `GET /:id/archivo-distribucion` dos veces seguidas
- **THEN** ambas respuestas sirven el mismo archivo físico, sin regenerar contenido

#### Scenario: El PDF de distribución contiene el contenido real del documento
- **WHEN** se firma y publica un documento cuyo archivo original es un `.docx` con contenido de varias páginas
- **THEN** el PDF de distribución resultante tiene ese mismo contenido, con el sello de publicación visible en cada página

### Requirement: Exportación de PDF controlado (RN-DOC-007)
El sistema SHALL exponer `POST /api/documents/:id/exportar-pdf`, permitido solo si `estado == PUBLICADO`, generando de forma síncrona un PDF real a partir del PDF de distribución ya guardado (nunca una página nueva de metadatos), con marca de agua visible agregada en cada página: nombre completo del usuario descargante, timestamp en zona horaria de Lima (GMT-5), hash SHA-256, y la leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión". SHALL registrar una entrada `DESCARGA` en el audit trail del documento.

#### Scenario: Exportación exitosa incluye marca de agua
- **WHEN** se exporta el PDF controlado de un documento `PUBLICADO`
- **THEN** el PDF generado incluye el nombre del usuario, el timestamp de Lima, y la leyenda de copia no controlada en cada página, y el audit trail gana una entrada `DESCARGA`

#### Scenario: Exportación rechazada fuera de PUBLICADO
- **WHEN** se solicita `POST /:id/exportar-pdf` sobre un documento en `BORRADOR`
- **THEN** el sistema rechaza la exportación

#### Scenario: El PDF controlado conserva el contenido real y la cantidad de páginas
- **WHEN** se exporta el PDF controlado de un documento cuyo PDF de distribución tiene 3 páginas de contenido real
- **THEN** el PDF controlado resultante tiene las mismas 3 páginas, cada una con la marca de agua agregada

### Requirement: Descargas firmadas con TTL (RN-DOC-008, RN-DOC-009)
El sistema SHALL exponer `GET /api/documents/:id/download-url`, respondiendo `{ url, expiresAt }` con una vigencia de 15 minutos. SHALL exponer `POST /api/documents/:id/audit/access` con `{ accion: DESCARGA | VISUALIZACION }`, registrando el acceso en el audit trail con el actor resuelto del JWT de la sesión — nunca del body de la solicitud. SHALL exponer `GET /api/documents/:id/archivo`, que resuelve la URL firmada del archivo vigente y registra `VISUALIZACION`.

#### Scenario: URL de descarga expira a los 15 minutos
- **WHEN** se solicita `GET /:id/download-url`
- **THEN** el `expiresAt` devuelto es exactamente 15 minutos después del momento de la solicitud

#### Scenario: El actor del registro de acceso viene del JWT, no del body
- **WHEN** se envía `POST /:id/audit/access` con un `actorId` falsificado en el body
- **THEN** el sistema ignora ese campo y registra el acceso con el actor autenticado de la sesión

### Requirement: Aislamiento multi-tenant
El sistema SHALL responder `404` "Documento no encontrado" (nunca `403`) para cualquier operación sobre un documento cuyo `EmpresaId` no coincida con la empresa activa del actor, antes de evaluar cualquier otra regla de permisos o de negocio.

#### Scenario: Documento de otra empresa responde 404
- **WHEN** un actor con empresa activa distinta solicita cualquier endpoint sobre un `Documento` de otra empresa
- **THEN** el sistema responde `404`, sin distinguir si el documento no existe o pertenece a otra empresa

#### Scenario: Listado nunca mezcla empresas
- **WHEN** se solicita `GET /api/documents`
- **THEN** solo se devuelven documentos cuyo `EmpresaId` coincide con la empresa activa del actor

### Requirement: Fechas de calendario sin offset se aceptan y persisten en UTC
`POST /api/documents`, `PUT /api/documents/:id` y cualquier otro endpoint que reciba `FechaVigencia`, `FechaRevisionProxima` u otro campo `DateTime`/`DateTime?` del dominio Documentos SHALL aceptar un valor de fecha sin offset (p.ej. `"2026-09-29"`, deserializado por el cliente JSON como `DateTimeKind.Unspecified`) sin responder `500`. El valor SHALL persistirse como el instante UTC de medianoche de ese día calendario (`DateTimeKind.Utc`), sin desplazar la hora. Esto se logra con un convertidor de valor global de EF Core (no un mapeo por propiedad), por lo que aplica igual a cualquier entidad del sistema con columnas `timestamp with time zone`, no solo a Documentos.

#### Scenario: Fecha de vigencia sin offset no produce 500
- **WHEN** se envía `POST /api/documents` con `fechaVigencia: "2026-09-29"` (sin hora ni offset)
- **THEN** el sistema responde `201` y el documento queda con `fechaVigencia` en `2026-09-29T00:00:00Z`

#### Scenario: Fecha de vigencia vacía u omitida no produce 500
- **WHEN** se envía `POST /api/documents` sin `fechaVigencia` (campo omitido)
- **THEN** el sistema responde `201` sin error de deserialización

### Requirement: GET /api/documents/:id devuelve el audit trail real
`ObtenerDocumentoHandler` SHALL cargar las filas de `documento_audit_trail` para el documento solicitado (tras las comprobaciones de tenant y confidencialidad, que siguen devolviendo `404` como hoy), ordenadas por `timestamp` ascendente, y asignarlas a `Documento.AuditTrail`. La proyección SHALL incluir únicamente columnas que existen en `DocumentoAuditTrail` (`id`, `documentoId`, `accion`, `estadoAnterior`, `estadoNuevo`, `campoModificado`, `valorAnterior`, `valorNuevo`, `realizadoPorId`, `realizadoPorNombre`, `timestamp`, `generadoPorIA`) — nunca inventa `entidadTipo`/`entidadId`/`ipOrigen`, que no existen en la entidad backend. El alcance de visibilidad SHALL ser el mismo que hoy (cualquier actor que pueda leer el detalle ve el audit trail completo, igual que el mock) — restringir esa visibilidad por rol queda fuera de este requirement.

#### Scenario: Audit trail no vacío tras crear un documento
- **WHEN** se crea un documento y luego se consulta `GET /api/documents/:id`
- **THEN** `auditTrail` incluye al menos una entrada con `accion: "DOCUMENTO_CREADO"`

#### Scenario: Audit trail incluye un cambio de estado
- **WHEN** un documento pasa de `BORRADOR` a `EN_REVISION` y luego se consulta `GET /api/documents/:id`
- **THEN** `auditTrail` incluye una entrada con `accion: "ESTADO_CAMBIADO"`, `estadoAnterior: "BORRADOR"`, `estadoNuevo: "EN_REVISION"`

### Requirement: GET /api/documents (listado general) no incluye audit trail
`ListarDocumentosHandler` SHALL seguir devolviendo `auditTrail: []` para cada documento cuando la consulta no está filtrada por `codigo` — mismo criterio que `QeVinculados`/`NcVinculados`: cargar el audit trail de cada fila de un listado paginado arbitrario sería una consulta N+1.

#### Scenario: Listado general sin filtrar por codigo devuelve auditTrail vacío
- **WHEN** se consulta `GET /api/documents?page=1&pageSize=10` sin `codigo`
- **THEN** cada documento del listado tiene `auditTrail: []`

### Requirement: GET /api/documents?codigo= (versiones) sí incluye audit trail
Cuando `ListarDocumentosQuery.Codigo` está definido, `ListarDocumentosHandler` SHALL poblar `auditTrail` para cada documento del resultado — este resultado está acotado a las versiones de un único código (normalmente unas pocas filas), no a un listado paginado arbitrario, así que no aplica el riesgo de N+1 que justifica dejarlo vacío en el caso general. Esto es necesario para que `DocumentVersionesTab` (`getPublisher`, vía `useDocumentVersiones(codigo)`) pueda mostrar quién publicó cada versión.

#### Scenario: Listado filtrado por codigo incluye auditTrail por versión
- **WHEN** se consulta `GET /api/documents?codigo=PRC-CD-001&pageSize=100`
- **THEN** cada documento del resultado tiene su propio `auditTrail` poblado con sus entradas reales

### Requirement: CORS expone Content-Disposition para descargas de archivo
La política CORS `ShacFrontend` SHALL incluir `Content-Disposition` en sus headers de respuesta expuestos (`WithExposedHeaders`), para que el frontend (origen distinto en desarrollo) pueda leer ese header desde JavaScript en las respuestas de `GET /:id/archivo-original`, `GET /:id/archivo-distribucion` y `POST /:id/exportar-pdf`. Sin este header expuesto, el navegador oculta `Content-Disposition` al código JS aunque el servidor lo envíe, y cualquier parseo del lado del cliente siempre encuentra un valor vacío.

#### Scenario: Content-Disposition visible desde JavaScript en origen distinto
- **WHEN** el frontend en `http://localhost:5173` solicita `GET /:id/archivo-original` al backend en `http://localhost:5072`
- **THEN** `response.headers['content-disposition']` no está vacío en el cliente

### Requirement: Test de integración de CORS para descargas
El sistema SHALL tener un test de integración que verifique que una petición con `Origin: http://localhost:5173` a un endpoint de descarga de Documentos recibe `Access-Control-Expose-Headers: Content-Disposition` en la respuesta.

#### Scenario: Header de exposición presente para el origen del frontend
- **WHEN** se envía `GET /api/documents/:id/archivo-original` con `Origin: http://localhost:5173`
- **THEN** la respuesta incluye `Access-Control-Expose-Headers` con `Content-Disposition` entre sus valores

### Requirement: Validación de formato del archivo original por tipo de documento (RN-DOC-021)
El sistema SHALL definir, en un único lugar (`DocumentoFormatosPermitidos`), la lista de tipos de documento que aceptan un PDF nativo como archivo original: `INF`, `MAT`, `PLAN`. Para cualquier otro `Tipo` (`POL`, `PRC`, `INS`, `REG`), el archivo original SHALL ser únicamente `.docx` o `.xlsx`.

`POST /api/documents/:id/archivo-original` (tanto en la primera carga tras crear el documento como en cualquier reemplazo posterior) SHALL validar el archivo recibido contra esta lista usando el `Tipo` ya persistido del documento, verificando **tanto la extensión como la firma binaria** de los primeros bytes del archivo: un PDF SHALL comenzar con la secuencia ASCII `%PDF-`; un `.docx`/`.xlsx` SHALL ser una estructura ZIP válida (firma `PK`). Un archivo cuya extensión no coincide con su firma binaria (por ejemplo, un `.docx` renombrado a `.pdf`, o un archivo de texto renombrado a `.pdf`) SHALL ser rechazado igual que un archivo del tipo equivocado. El sistema SHALL responder `400` con un mensaje claro indicando los formatos aceptados para el `Tipo` del documento.

#### Scenario: PDF nativo aceptado para PLAN
- **WHEN** se envía `POST /:id/archivo-original` con un PDF válido sobre un documento `tipo: PLAN`
- **THEN** el sistema acepta el archivo y responde `200` con `archivoOriginalUrl`/`archivoOriginalNombre` actualizados

#### Scenario: PDF rechazado para PRC
- **WHEN** se envía `POST /:id/archivo-original` con un PDF válido sobre un documento `tipo: PRC`
- **THEN** el sistema responde `400` indicando que ese tipo requiere un archivo Word o Excel

#### Scenario: Archivo renombrado con extensión falsa es rechazado
- **WHEN** se envía `POST /:id/archivo-original` con un archivo `.pdf` cuyos primeros bytes no son `%PDF-` (p.ej. un `.docx` renombrado) sobre un documento `tipo: PLAN`
- **THEN** el sistema responde `400`, sin importar que la extensión declarada sea válida para ese tipo

#### Scenario: .docx válido sigue aceptado para cualquier tipo
- **WHEN** se envía `POST /:id/archivo-original` con un `.docx` válido sobre un documento `tipo: PLAN` o `tipo: PRC`
- **THEN** el sistema acepta el archivo en ambos casos

### Requirement: PIN incorrecto en firma de documento identificado con errorCode
Cuando `POST /api/documents/:id/sign` recibe un `pin` que no coincide con el `PinHash` del actor, el sistema SHALL responder 401 con `errorCode: "PIN_INCORRECTO"` en el envelope de error (`UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO")`) y SHALL NOT cambiar el estado del documento. El status SHALL seguir siendo 401.

#### Scenario: Firma con PIN incorrecto
- **WHEN** el aprobador asignado, con PIN configurado, firma un documento `EN_APROBACION` con un PIN distinto del suyo
- **THEN** el sistema responde 401 con `errorCode: "PIN_INCORRECTO"` y el documento sigue en `EN_APROBACION`
