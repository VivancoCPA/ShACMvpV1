## MODIFIED Requirements

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

### Requirement: Cambio de estado sin firma
El sistema SHALL exponer `PATCH /api/documents/:id/status` con `{ estado, motivo?, notificarAutor? }`, validando la transición contra la máquina de estados y los permisos del `docRole` del actor. SHALL usarse para toda transición que no requiera PIN: enviar a revisión, aprobar revisión, cancelar revisión, rechazar (`EN_REVISION → BORRADOR` o `EN_APROBACION → BORRADOR`, con `motivo` mínimo 20 caracteres cuando se usa como rechazo), iniciar/cancelar revisión periódica. El sistema SHALL NOT exponer un endpoint `POST /:id/status` separado con firma obligatoria — esa transición (la única que requiere PIN, `EN_APROBACION → PUBLICADO`) se cubre exclusivamente por `POST /:id/sign`.

En la transición `BORRADOR → EN_REVISION`, el sistema SHALL validar, antes de evaluar los permisos del `docRole`, que el documento tenga `RevisorId` y `AprobadorId` asignados; si falta alguno SHALL responder con un error de validación por campo (mismo formato que `FieldValidationException`, `400`, no `403` ni `422`) indicando qué campo falta, sin modificar el estado del documento.

#### Scenario: Rechazo con motivo y notificación al autor
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: BORRADOR, motivo: "..." (20+ caracteres), notificarAutor: true }` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `200` con `estado: BORRADOR` y dispara una notificación best-effort al autor

#### Scenario: Motivo insuficiente en rechazo
- **WHEN** se envía `motivo` con menos de 20 caracteres en una transición a `BORRADOR` marcada como rechazo
- **THEN** el sistema responde `422`

#### Scenario: Enviar a revisión sin revisor asignado es rechazado con error de campo
- **WHEN** se envía `PATCH /:id/status` con `{ estado: EN_REVISION }` sobre un `BORRADOR` cuyo `revisorId` es `null`
- **THEN** el sistema responde `400` con un error de validación en el campo `revisorId`, y el documento permanece en `BORRADOR`

#### Scenario: Enviar a revisión sin aprobador asignado es rechazado con error de campo
- **WHEN** se envía `PATCH /:id/status` con `{ estado: EN_REVISION }` sobre un `BORRADOR` cuyo `aprobadorId` es `null`
- **THEN** el sistema responde `400` con un error de validación en el campo `aprobadorId`, y el documento permanece en `BORRADOR`

#### Scenario: Un JEFE_CALIDAD que es revisor o aprobador asignado de un BORRADOR ajeno no puede enviarlo a revisión
- **WHEN** un `JEFE_CALIDAD_SYST` que es el `revisorId` o `aprobadorId` asignado de un `BORRADOR` cuyo autor es otra persona intenta `PATCH /:id/status` con `{ estado: EN_REVISION }`
- **THEN** el sistema responde `403` — el `docRole` resuelto es `REVISOR`/`APROBADOR` (precedencia sobre `JEFE_CALIDAD`), que no tiene `CanEdit` en `BORRADOR`; comportamiento esperado, no afectado por este fix
