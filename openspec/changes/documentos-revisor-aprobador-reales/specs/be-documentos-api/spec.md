## MODIFIED Requirements

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

#### Scenario: Aprobador no elegible en edición es rechazado
- **WHEN** se envía `PUT /api/documents/:id` con un `aprobadorId` de rol `SUPERVISOR`
- **THEN** el sistema rechaza con error de validación en `aprobadorId`
