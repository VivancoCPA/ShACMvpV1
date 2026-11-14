## MODIFIED Requirements

### Requirement: Firma dual de cierre
El sistema SHALL exponer `PATCH /api/quality-events/:id/firmar-cierre`, requiriendo dos firmas (`rol`, `pin`): la primera de `JEFE_CALIDAD_SYST`, la segunda del rol resuelto por `ResolverRolSegundaFirma`, que SHALL devolver siempre `'SUPERVISOR'` (RN-QE-004 reconciliada: la escalada a `ALTA_DIRECCION` por mismo firmante no se implementa, por ser estructuralmente inalcanzable bajo el modelo de un rol por usuario). La segunda firma SHALL exigir además que el actor sea supervisor del área del QE (ver "Supervisores del área del QE"); si no lo es, el sistema SHALL responder 403 con `errorCode: "NO_ES_SUPERVISOR_DEL_AREA"`. El sistema SHALL rechazar una segunda firma del mismo usuario que ya firmó como Jefe de Calidad (422). Antes de registrar la primera firma, el sistema SHALL verificar que el área del QE tenga al menos un supervisor; si no, SHALL responder 422 `AREA_SIN_SUPERVISOR`. Antes de aceptar cualquiera de las dos firmas, el sistema SHALL validar `pin` contra el `PinHash` del usuario firmante: si el usuario no tiene `PinHash` configurado, la firma se rechaza con `BusinessRuleException` (`RuleCode: "PIN_NO_CONFIGURADO"`) indicando que debe configurar su PIN primero (`POST /api/auth/set-pin`); si `PinHash` está configurado pero `pin` no coincide, la firma se rechaza como no autorizada (401). La primera firma SHALL registrar en el audit trail `accion: "FIRMA_CIERRE_JEFE_CALIDAD"` y la segunda `accion: "FIRMA_CIERRE_SUPERVISOR"`, ambas con `valorNuevo` igual al nombre completo del firmante.

#### Scenario: Primera firma
- **WHEN** un `JEFE_CALIDAD_SYST` firma `PATCH /:id/firmar-cierre` sobre un QE con cierre iniciado y área con supervisor, con su PIN de firma correcto
- **THEN** el sistema responde 200, registra `cerradoPorId`, agrega `FIRMA_CIERRE_JEFE_CALIDAD` con su nombre en `valorNuevo`, y el QE permanece sin `estado: 'CERRADO'` hasta la segunda firma

#### Scenario: Segunda firma de un supervisor del área completa el cierre
- **WHEN** un `SUPERVISOR` con el área del QE en `AreaIds` firma tras la primera firma de Jefe de Calidad, con su PIN de firma correcto
- **THEN** el sistema responde 200 con `estado: 'CERRADO'`, agrega `FIRMA_CIERRE_SUPERVISOR` con su nombre en `valorNuevo` y envía el aviso de cierre completo

#### Scenario: Supervisor de otra área
- **WHEN** un `SUPERVISOR` sin el área del QE en `AreaIds` intenta la segunda firma
- **THEN** el sistema responde 403 con `errorCode: "NO_ES_SUPERVISOR_DEL_AREA"` sin registrar la firma

#### Scenario: Primera firma con área sin supervisor
- **WHEN** un `JEFE_CALIDAD_SYST` intenta la primera firma y el área del QE no tiene ningún supervisor activo
- **THEN** el sistema responde 422 con `errorCode: "AREA_SIN_SUPERVISOR"` sin registrar la firma

#### Scenario: Doble firma del mismo usuario
- **WHEN** el mismo usuario que ya firmó como Jefe de Calidad intenta firmar la segunda firma
- **THEN** el sistema responde 422 sin completar el cierre

#### Scenario: PIN incorrecto
- **WHEN** un usuario con `PinHash` configurado envía `PATCH /:id/firmar-cierre` con un `pin` que no coincide con el PIN configurado
- **THEN** el sistema responde 401 sin registrar la firma

#### Scenario: Usuario sin PIN configurado
- **WHEN** un usuario sin `PinHash` configurado (nunca llamó `POST /api/auth/set-pin`) envía `PATCH /:id/firmar-cierre`
- **THEN** el sistema responde `422` con `errorCode: "PIN_NO_CONFIGURADO"` en el envelope de error, sin registrar la firma ni devolver un error genérico 500

## ADDED Requirements

### Requirement: Supervisores del área del QE
El sistema SHALL resolver los supervisores del área de un QE (`SupervisoresAreaResolver`) como los usuarios con asignación `UsuarioEmpresa` en la empresa del QE con `Rol == SUPERVISOR` y `Estado == ACTIVO`, `ShacUser.Activo == true` y el `AreaId` del QE contenido en `ShacUser.AreaIds`. `ShacUser.AreaId` (departamento propio) NO SHALL considerarse. Cada resultado SHALL exponer `id`, `nombreCompleto` y `avatarUrl`.

#### Scenario: Incluye solo supervisores activos del área
- **WHEN** la empresa tiene un SUPERVISOR activo con el área en `AreaIds`, otro SUPERVISOR con otra área, uno con asignación inactiva, uno con usuario inactivo, un JCA con el área y un SUPERVISOR de otra empresa con el área
- **THEN** el resolver devuelve solo el primero

### Requirement: Inicio del cierre bloqueado si el área no tiene supervisor
`PATCH /api/quality-events/:id/cerrar` SHALL responder 422 con `errorCode: "AREA_SIN_SUPERVISOR"` y el mensaje "El área {nombre del área} no tiene un supervisor activo asignado. Asigna uno en Usuarios antes de cerrar." cuando el área del QE no tiene supervisores, sin registrar `resultadoCierre`.

#### Scenario: Área sin supervisores
- **WHEN** se envía `PATCH /:id/cerrar` válido para un QE cuya área no tiene ningún supervisor activo
- **THEN** el sistema responde 422 `AREA_SIN_SUPERVISOR` y `resultadoCierre` sigue vacío

### Requirement: Rechazo del cierre por el supervisor del área
El sistema SHALL exponer `POST /api/quality-events/:id/rechazar-cierre` con body `{ motivo }` (20–500 caracteres; fuera de rango → 400). Un QE de otra empresa SHALL responder 404. El QE SHALL estar en `PENDIENTE_CIERRE` con `cerradoPorId` y sin `cierreFirmaSupervisorId`; si no, 422. El actor SHALL ser supervisor del área del QE; si no, 403 `NO_ES_SUPERVISOR_DEL_AREA`. No requiere PIN. El efecto SHALL ser: `estado = EN_EJECUCION`, `cerradoPorId = null`, `resultadoCierre` y `plazoVerificacionDias` conservados, audit `CIERRE_RECHAZADO` con `estadoAnterior: PENDIENTE_CIERRE`, `estadoNuevo: EN_EJECUCION` y `valorNuevo` = motivo, sincronización del incidente vinculado (`IncidenteQeSync`) y aviso de rechazo al JCA.

#### Scenario: Rechazo válido
- **WHEN** un supervisor del área rechaza con un motivo de 30 caracteres un QE en PENDIENTE_CIERRE con la firma del JCA
- **THEN** el sistema responde 200 con `estado: 'EN_EJECUCION'`, `cerradoPorId: null`, `resultadoCierre` intacto, una entrada `CIERRE_RECHAZADO` con el motivo, el incidente vinculado en `EN_EJECUCION` y una notificación al JCA que firmó

#### Scenario: Motivo corto
- **WHEN** el motivo tiene menos de 20 caracteres
- **THEN** el sistema responde 400

#### Scenario: Sin firma del JCA
- **WHEN** el QE está en PENDIENTE_CIERRE sin `cerradoPorId`
- **THEN** el sistema responde 422

#### Scenario: Supervisor de otra área rechaza
- **WHEN** un SUPERVISOR sin el área del QE intenta rechazar
- **THEN** el sistema responde 403 `NO_ES_SUPERVISOR_DEL_AREA`

#### Scenario: QE de otra empresa
- **WHEN** el QE pertenece a otra empresa
- **THEN** el sistema responde 404

### Requirement: EN_EJECUCION → PENDIENTE_CIERRE manual exige AC cerradas (RN-QE-003)
`PATCH /api/quality-events/:id/status` con `nuevoEstado: PENDIENTE_CIERRE` SHALL responder 422 `RN-QE-003` si alguna acción correctiva del QE no está `CERRADA` o no tiene `descripcionEvidencia`.

#### Scenario: Re-cierre tras un rechazo con todas las AC cerradas
- **WHEN** un QE en EN_EJECUCION (tras un rechazo) con todas sus AC cerradas con evidencia pasa a PENDIENTE_CIERRE
- **THEN** el sistema responde 200 y envía el aviso "listo para cierre"

#### Scenario: AC abierta
- **WHEN** el QE tiene una AC en PENDIENTE
- **THEN** el sistema responde 422 `RN-QE-003`

### Requirement: Avisos del flujo de cierre
El sistema SHALL enviar, best-effort (después de persistir, sin alterar la respuesta si falla), sin incluir al actor, sin duplicados y con `link: /quality-events/{id}`:
- **Listo para cierre** (`CAMBIO_ESTADO`) al pasar a PENDIENTE_CIERRE (auto-transición al cerrar la última AC o transición manual): JCA con asignación activa y supervisores del área. Mensaje: "El {numero} está listo para cierre: todas sus acciones correctivas están cerradas."
- **Firma pendiente** (`ASIGNACION`) tras la primera firma: supervisores del área. Mensaje: "El {numero} espera tu firma de cierre como Supervisor de {área}. Firmó el Jefe de Calidad {nombreJCA}."
- **Cierre rechazado** (`CAMBIO_ESTADO`): el JCA que firmó si sigue activo como JCA en la empresa; si no, todos los JCA activos. Mensaje: `El supervisor {nombre} rechazó el cierre del {numero}: "{primeros 100 caracteres del motivo}".`
- **Cierre completo** (`CIERRE`) tras la segunda firma: reportante, responsable de investigación, JCA activos y, con severidad ALTA o CRITICA, ALTA_DIRECCION. Mensaje: "El {numero} fue cerrado con doble firma. Verificación de eficacia programada para el {dd/MM/yyyy}."

`{área}` SHALL ser el nombre del área, no su id.

#### Scenario: Listo para cierre solo al área
- **WHEN** se cierra la última AC de un QE del área 1
- **THEN** reciben aviso los JCA y los supervisores del área 1, y no un supervisor del área 2

#### Scenario: Firma pendiente
- **WHEN** el JCA da la primera firma
- **THEN** solo los supervisores del área reciben el aviso `ASIGNACION`

#### Scenario: Cierre completo con severidad ALTA
- **WHEN** se completa la segunda firma de un QE con severidad ALTA
- **THEN** reciben aviso `CIERRE` el reportante, el responsable, los JCA y ALTA_DIRECCION, y no el supervisor que firmó

#### Scenario: Cierre completo con severidad MEDIA
- **WHEN** se completa la segunda firma de un QE con severidad MEDIA
- **THEN** ALTA_DIRECCION no recibe aviso

#### Scenario: Fallo de notificación
- **WHEN** el envío de un aviso del cierre lanza una excepción
- **THEN** la respuesta del endpoint no cambia

### Requirement: Detalle del QE con firmantes y supervisores del área
`GET /api/quality-events/:id` SHALL devolver `cerradoPorNombre` y `cierreFirmaSupervisorNombre` (nombre completo de los firmantes, `null` si no firmaron) y, solo cuando `estado == PENDIENTE_CIERRE`, `supervisoresArea: [{ id, nombreCompleto, avatarUrl }]`; en otros estados `supervisoresArea` SHALL ser `null`.

#### Scenario: Detalle en PENDIENTE_CIERRE con primera firma
- **WHEN** se pide el detalle de un QE en PENDIENTE_CIERRE firmado por el JCA, con dos supervisores en el área
- **THEN** la respuesta trae `cerradoPorNombre` con el nombre del JCA y `supervisoresArea` con los dos supervisores
