## MODIFIED Requirements

### Requirement: Cambio de estado sin firma
El sistema SHALL exponer `PATCH /api/documents/:id/status` con `{ estado, motivo?, notificarAutor? }`, validando la transición contra la máquina de estados y los permisos del `docRole` del actor. SHALL usarse para toda transición que no requiera PIN: enviar a revisión, aprobar revisión, cancelar revisión, rechazar (`EN_REVISION → BORRADOR` o `EN_APROBACION → BORRADOR`, con `motivo` mínimo 20 caracteres cuando se usa como rechazo), iniciar/cancelar revisión periódica. El sistema SHALL NOT exponer un endpoint `POST /:id/status` separado con firma obligatoria — esa transición (la única que requiere PIN, `EN_APROBACION → PUBLICADO`) se cubre exclusivamente por `POST /:id/sign`. Además de la notificación de rechazo ya existente, el sistema SHALL disparar, best-effort (try/catch, después de `SaveChangesAsync`, nunca falla la transición), una notificación por cada transición exitosa distinta del rechazo: `BORRADOR → EN_REVISION` notifica `ASIGNACION` al `RevisorId`; `EN_REVISION → EN_APROBACION` notifica `ASIGNACION` al `AprobadorId`; `EN_REVISION → BORRADOR` sin `motivo` (cancelar revisión) notifica `CAMBIO_ESTADO` al `AutorId` y al `RevisorId`; `PUBLICADO → EN_REVISION_PERIODICA` notifica `CAMBIO_ESTADO` al `AutorId`. Ninguna de estas notificaciones SHALL enviarse al propio actor de la transición, ni si el destinatario es `null`.

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
- **WHEN** se envía a revisión un documento sin `RevisorId` asignado
- **THEN** no se intenta crear ninguna notificación para esa transición

#### Scenario: Una falla del sender no revierte la transición
- **WHEN** el envío de la notificación best-effort lanza una excepción durante cualquiera de estas transiciones
- **THEN** la respuesta sigue siendo `200` con el nuevo `estado` persistido, sin revertir el cambio

### Requirement: Firma y publicación (RN-DOC-004)
El sistema SHALL exponer `POST /api/documents/:id/sign` con `{ pin }`, permitido solo desde `EN_APROBACION` y solo si el actor es el `docRole APROBADOR` asignado (`AprobadorId == actor.Id`) — verificación de identidad que el mock no realizaba. SHALL validar `pin` contra `ShacUser.PinHash` del actor vía `IPasswordHasher<ShacUser>`: `BusinessRuleException` si el actor no tiene PIN configurado, `UnauthorizedBusinessException` si el PIN no coincide. Al firmar exitosamente, el sistema SHALL: fijar `Estado: PUBLICADO`; obsoletizar automáticamente la versión previa `PUBLICADO` del mismo `Codigo`, si existe (RN-DOC-001); fijar `ArchivoOriginalBloqueado: true`; generar y persistir el PDF de distribución; disparar, best-effort y después de `SaveChangesAsync`, una notificación `CAMBIO_ESTADO` informativa al `AutorId` y al `RevisorId` del documento publicado (excluyendo al actor y a cualquier destinatario nulo).

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

#### Scenario: Publicación notifica a autor y revisor
- **WHEN** el aprobador firma exitosamente un documento con `AutorId` y `RevisorId` distintos del aprobador
- **THEN** se crean notificaciones `CAMBIO_ESTADO` para el `AutorId` y el `RevisorId`, indicando que el documento fue publicado con su versión

#### Scenario: Publicación no notifica al propio aprobador
- **WHEN** el aprobador firmante es también el `AutorId` o el `RevisorId` del documento
- **THEN** no se crea notificación para ese rol coincidente, solo para el que sigue siendo distinto del actor

### Requirement: Nueva versión
El sistema SHALL exponer `POST /api/documents/:id/nueva-version` con `{ tipoCambio: MENOR | MAYOR, motivo (mínimo 20 caracteres) }`, permitido solo desde `PUBLICADO` o `EN_REVISION_PERIODICA`. SHALL crear un nuevo `Documento` en `BORRADOR` con el mismo `Codigo`, `Version` incrementada según `tipoCambio`, `VersionAnteriorId` apuntando al documento origen, y una copia física real (no una referencia) del archivo original al directorio de la nueva versión. SHALL responder `409` si ya existe otra versión del mismo código en proceso. Al crear la nueva versión, que hereda `RevisorId`/`AprobadorId` del documento origen, el sistema SHALL disparar, best-effort y después de `SaveChangesAsync`, una notificación `ASIGNACION` al `RevisorId` y al `AprobadorId` heredados (excluyendo al actor y a cualquier destinatario nulo), indicando que fueron designados para la nueva versión.

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
