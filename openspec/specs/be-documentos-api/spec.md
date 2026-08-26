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
El sistema SHALL exponer `GET /api/documents?pendientes=true` y `GET /api/documents/pendientes/count`, filtrando por rol del actor: `SUPERVISOR` ve documentos `EN_REVISION` donde es el `RevisorId` asignado; cualquier rol excepto `OPERARIO`, `AUDITOR_INTERNO` y `ALTA_DIRECCION` ve documentos `EN_APROBACION` donde es el `AprobadorId` asignado; `JEFE_CALIDAD_SYST` ve todo documento `EN_REVISION` o `EN_REVISION_PERIODICA` de la empresa (sin requerir asignación directa); `JEFE_CONTROL_DOCUMENTARIO` ve todo documento `EN_REVISION_PERIODICA` de la empresa. El conteo SHALL responder `0` para `OPERARIO`, `AUDITOR_INTERNO` y `ALTA_DIRECCION`, sin evaluar ninguna consulta adicional para esos roles.

#### Scenario: Revisor ve sus documentos EN_REVISION asignados
- **WHEN** un `SUPERVISOR` asignado como revisor de 2 documentos `EN_REVISION` solicita `GET /api/documents?pendientes=true`
- **THEN** la respuesta incluye esos 2 documentos, excluyendo cualquier otro documento `EN_REVISION` donde no es el revisor asignado

#### Scenario: JEFE_CALIDAD_SYST ve todo EN_REVISION sin necesitar asignación
- **WHEN** un `JEFE_CALIDAD_SYST` solicita `GET /api/documents?pendientes=true`
- **THEN** la respuesta incluye todo documento `EN_REVISION` o `EN_REVISION_PERIODICA` de la empresa activa, sin importar quién es el revisor asignado

#### Scenario: Conteo de pendientes es cero para roles sin bandeja
- **WHEN** un `OPERARIO` solicita `GET /api/documents/pendientes/count`
- **THEN** el sistema responde `{ count: 0 }` sin evaluar ninguna asignación

### Requirement: Permisos por (estado, docRole)
El sistema SHALL resolver `docRole` por documento (no por rol global del actor) en este orden: `AUTOR` si `AutorId == actor.Id`; si no, `REVISOR` si `RevisorId == actor.Id`; si no, `APROBADOR` si `AprobadorId == actor.Id`; si no, `JEFE_CALIDAD` si el rol global es `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`; si no, `OPERARIO`. El sistema SHALL aplicar la matriz de 9 permisos (`canRead, canEdit, canDelete, canComment, canApprove, canReject, canSign, canStartReview, canCancelReview`) por `(estado, docRole)` idéntica a `document-permissions` (frontend), incluyendo que en `EN_REVISION_PERIODICA` solo el `AUTOR` asignado a esa versión puede editar, y que `OBSOLETO` es de solo lectura para todo `docRole` (RN-DOC-003).

#### Scenario: Autor sin ser el asignado no puede editar en EN_REVISION_PERIODICA
- **WHEN** un usuario con `docRole: AUTOR` mutila la única versión activa de un documento en `EN_REVISION_PERIODICA` donde el autor asignado es otro usuario
- **THEN** el sistema rechaza la edición

#### Scenario: Ningún rol puede mutar un documento OBSOLETO
- **WHEN** cualquier endpoint de mutación se invoca sobre un documento `OBSOLETO`
- **THEN** el sistema responde con un error de negocio, sin excepción por rol

### Requirement: Creación de Documento (RN-DOC-019, RN-DOC-020)
El sistema SHALL exponer `POST /api/documents`, creando el documento en `BORRADOR` con un `Codigo` generado por una secuencia atómica monótona (nunca reutilizable — ver Requirement "Generación de código correlativo"). SHALL responder `422` si `RevisorId == AprobadorId` (RN-DOC-019). SHALL responder `422` si `FechaVigencia` está definida y `FechaRevisionProxima` no cumple el margen mínimo de 30 días respecto a `FechaVigencia` (RN-DOC-020), excepto cuando `Tipo == INF`, donde `FechaRevisionProxima` es opcional y la validación no aplica si el campo queda vacío. SHALL responder `401` si el actor no tiene empresa activa. A diferencia de `NuevaVersionDocumento`, este endpoint NO revalida RN-DOC-001 (bloqueo de doble-versión-en-proceso): como el `Codigo` siempre es recién generado por una secuencia que nunca produce un valor ya existente, la colisión que motiva esa regla en `NuevaVersionDocumento` (donde el código SÍ se reutiliza entre versiones) es estructuralmente imposible aquí.

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

### Requirement: Edición de Documento
El sistema SHALL exponer `PUT /api/documents/:id`, permitiendo la edición solo si `estado == BORRADOR` (`409` en cualquier otro estado). SHALL reaplicar las mismas validaciones RN-DOC-019/RN-DOC-020 de creación.

#### Scenario: Edición rechazada fuera de BORRADOR
- **WHEN** se envía `PUT /api/documents/:id` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `409`

### Requirement: Eliminación y restauración (soft delete)
El sistema SHALL exponer `DELETE /api/documents/:id`, marcando `DeletedAt` solo si `estado ∈ {BORRADOR, EN_REVISION}` y el documento no tiene `QeVinculados` no vacío (RN-DOC-005, tratando cualquier vínculo como activo — mismo criterio simplificado que el mock, que no distingue QE cerrado de abierto). SHALL responder `409` si ya está eliminado, si el estado no califica, o si tiene vínculos. El sistema SHALL exponer `PATCH /api/documents/:id/restaurar`, que limpia `DeletedAt` y fija `Estado: BORRADOR` incondicionalmente, sin importar el estado que tenía al momento de eliminarse.

#### Scenario: Eliminación exitosa en BORRADOR
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento en `BORRADOR` sin vínculos activos
- **THEN** el sistema responde `200` con el documento marcado como eliminado, que queda excluido del listado por defecto

#### Scenario: Eliminación rechazada por estado no válido
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento `PUBLICADO`
- **THEN** el sistema responde `409`

#### Scenario: Eliminación rechazada por vínculo QE activo
- **WHEN** se envía `DELETE /api/documents/:id` sobre un documento con al menos un id en `QeVinculados`
- **THEN** el sistema responde `409`

#### Scenario: Restaurar siempre vuelve a BORRADOR
- **WHEN** se envía `PATCH /api/documents/:id/restaurar` sobre un documento eliminado que estaba en `EN_REVISION` al momento de eliminarse
- **THEN** el sistema responde `200` con `estado: BORRADOR`, no `EN_REVISION`

### Requirement: Cambio de estado sin firma
El sistema SHALL exponer `PATCH /api/documents/:id/status` con `{ estado, motivo?, notificarAutor? }`, validando la transición contra la máquina de estados y los permisos del `docRole` del actor. SHALL usarse para toda transición que no requiera PIN: enviar a revisión, aprobar revisión, cancelar revisión, rechazar (`EN_REVISION → BORRADOR` o `EN_APROBACION → BORRADOR`, con `motivo` mínimo 20 caracteres cuando se usa como rechazo), iniciar/cancelar revisión periódica. El sistema SHALL NOT exponer un endpoint `POST /:id/status` separado con firma obligatoria — esa transición (la única que requiere PIN, `EN_APROBACION → PUBLICADO`) se cubre exclusivamente por `POST /:id/sign`.

#### Scenario: Rechazo con motivo y notificación al autor
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: BORRADOR, motivo: "..." (20+ caracteres), notificarAutor: true }` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `200` con `estado: BORRADOR` y dispara una notificación best-effort al autor

#### Scenario: Motivo insuficiente en rechazo
- **WHEN** se envía `motivo` con menos de 20 caracteres en una transición a `BORRADOR` marcada como rechazo
- **THEN** el sistema responde `422`

### Requirement: Firma y publicación (RN-DOC-004)
El sistema SHALL exponer `POST /api/documents/:id/sign` con `{ pin }`, permitido solo desde `EN_APROBACION` y solo si el actor es el `docRole APROBADOR` asignado (`AprobadorId == actor.Id`) — verificación de identidad que el mock no realizaba. SHALL validar `pin` contra `ShacUser.PinHash` del actor vía `IPasswordHasher<ShacUser>`: `BusinessRuleException` si el actor no tiene PIN configurado, `UnauthorizedBusinessException` si el PIN no coincide. Al firmar exitosamente, el sistema SHALL: fijar `Estado: PUBLICADO`; obsoletizar automáticamente la versión previa `PUBLICADO` del mismo `Codigo`, si existe (RN-DOC-001); fijar `ArchivoOriginalBloqueado: true`; generar y persistir el PDF de distribución.

#### Scenario: Firma exitosa publica y obsoletiza la versión previa
- **WHEN** el aprobador asignado firma con su PIN correcto un documento en `EN_APROBACION` cuyo código ya tiene otra versión `PUBLICADO`
- **THEN** el sistema responde `200` con el documento actual en `PUBLICADO`, la versión previa pasa a `OBSOLETO`, y se genera el PDF de distribución

#### Scenario: Firma rechazada si el actor no es el aprobador asignado
- **WHEN** un usuario distinto del `AprobadorId` del documento intenta `POST /:id/sign`
- **THEN** el sistema responde con un error de autorización, sin publicar el documento

#### Scenario: PIN incorrecto no publica
- **WHEN** el aprobador asignado envía un `pin` que no coincide con su `PinHash`
- **THEN** el sistema responde `401` sin cambiar el estado

#### Scenario: Actor sin PIN configurado
- **WHEN** el aprobador asignado nunca configuró su PIN (`PinHash` nulo)
- **THEN** el sistema responde con un mensaje de negocio indicando que debe configurar su PIN primero, sin error genérico

### Requirement: Nueva versión
El sistema SHALL exponer `POST /api/documents/:id/nueva-version` con `{ tipoCambio: MENOR | MAYOR, motivo (mínimo 20 caracteres) }`, permitido solo desde `PUBLICADO` o `EN_REVISION_PERIODICA`. SHALL crear un nuevo `Documento` en `BORRADOR` con el mismo `Codigo`, `Version` incrementada según `tipoCambio`, `VersionAnteriorId` apuntando al documento origen, y una copia física real (no una referencia) del archivo original al directorio de la nueva versión. SHALL responder `409` si ya existe otra versión del mismo código en proceso.

#### Scenario: Nueva versión menor incrementa la versión correctamente
- **WHEN** se solicita `nueva-version` con `tipoCambio: MENOR` sobre un documento `v1.0` `PUBLICADO`
- **THEN** se crea un nuevo documento `BORRADOR` con `version: "v1.1"` y el mismo `codigo`

#### Scenario: Motivo insuficiente rechaza la nueva versión
- **WHEN** se envía `motivo` con menos de 20 caracteres
- **THEN** el sistema responde `422`

#### Scenario: El archivo original se copia físicamente, no se referencia
- **WHEN** se crea una nueva versión de un documento con archivo original existente
- **THEN** el nuevo documento tiene su propio archivo físico independiente en disco; modificar o eliminar el original de la versión anterior no afecta al de la nueva versión

### Requirement: Confirmar revisión periódica
El sistema SHALL exponer `PATCH /api/documents/:id/confirmar-revision`, permitido solo desde `PUBLICADO` o `EN_REVISION_PERIODICA`, que recalcula `FechaRevisionProxima` según `Tipo`: `POL/PRC/PLAN` +12 meses, `INS` +24 meses, `MAT` +6 meses, `REG/INF` sin nueva fecha (permanece sin próxima revisión).

#### Scenario: Confirmar revisión de un documento PRC
- **WHEN** se confirma revisión de un documento `tipo: PRC` con `fechaRevisionProxima` actual
- **THEN** la nueva `fechaRevisionProxima` es 12 meses después de la fecha de confirmación

### Requirement: Archivo original editable (RN-DOC-013, RN-DOC-015, RN-DOC-016, RN-DOC-018, CA-34)
El sistema SHALL exponer `GET /api/documents/:id/archivo-original` (descarga binaria real desde disco), permitido si `docRole != OPERARIO` y `estado ∈ {BORRADOR, EN_REVISION}`, **o** si el rol global del actor es `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION` y `estado == OBSOLETO` (CA-34, excepción de trazabilidad histórica). SHALL exponer `POST /api/documents/:id/archivo-original` (multipart, campo `archivoOriginal`) para reemplazar el original, permitido solo si `docRole ∈ {AUTOR, JEFE_CALIDAD}`, `estado ∈ {BORRADOR, EN_REVISION}` y `!ArchivoOriginalBloqueado` — validación de `docRole` que el mock no aplicaba en el POST. El archivo reemplazado SHALL archivarse con timestamp (no se sobreescribe ni se borra), preservando la trazabilidad.

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

### Requirement: PDF de distribución
El sistema SHALL exponer `GET /api/documents/:id/archivo-distribucion` (descarga binaria del PDF ya generado al momento de la firma), accesible a cualquier actor con `canRead` base y `estado ∈ {PUBLICADO, EN_REVISION_PERIODICA}`, sin gate adicional de asignación. El sistema SHALL NOT regenerar el PDF en cada solicitud — solo lo sirve desde disco.

#### Scenario: OPERARIO puede descargar el PDF de distribución de un documento PUBLICADO
- **WHEN** un `OPERARIO` con acceso de lectura solicita `GET /:id/archivo-distribucion` de un documento `PUBLICADO`
- **THEN** el sistema responde con el PDF ya generado

#### Scenario: Solicitudes repetidas no regeneran el PDF
- **WHEN** se solicita `GET /:id/archivo-distribucion` dos veces seguidas
- **THEN** ambas respuestas sirven el mismo archivo físico, sin regenerar contenido

### Requirement: Exportación de PDF controlado (RN-DOC-007)
El sistema SHALL exponer `POST /api/documents/:id/exportar-pdf`, permitido solo si `estado == PUBLICADO`, generando de forma síncrona un PDF real con marca de agua visible: nombre completo del usuario descargante, timestamp en zona horaria de Lima (GMT-5), hash SHA-256, y la leyenda "COPIA NO CONTROLADA — Solo válido al momento de impresión". SHALL registrar una entrada `DESCARGA` en el audit trail del documento.

#### Scenario: Exportación exitosa incluye marca de agua
- **WHEN** se exporta el PDF controlado de un documento `PUBLICADO`
- **THEN** el PDF generado incluye el nombre del usuario, el timestamp de Lima, y la leyenda de copia no controlada, y el audit trail gana una entrada `DESCARGA`

#### Scenario: Exportación rechazada fuera de PUBLICADO
- **WHEN** se solicita `POST /:id/exportar-pdf` sobre un documento en `BORRADOR`
- **THEN** el sistema rechaza la exportación

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
