## MODIFIED Requirements

### Requirement: Cambio de estado sin firma
El sistema SHALL exponer `PATCH /api/documents/:id/status` con `{ estado, motivo?, notificarAutor? }`, validando la transición contra la máquina de estados y los permisos del `docRole` del actor. SHALL usarse para toda transición que no requiera PIN: enviar a revisión, aprobar revisión, cancelar revisión, rechazar (`EN_REVISION → BORRADOR` o `EN_APROBACION → BORRADOR`, con `motivo` mínimo 20 caracteres cuando se usa como rechazo), iniciar/cancelar revisión periódica. El sistema SHALL NOT exponer un endpoint `POST /:id/status` separado con firma obligatoria — esa transición (la única que requiere PIN, `EN_APROBACION → PUBLICADO`) se cubre exclusivamente por `POST /:id/sign`.

Excepción a la validación por `docRole`: las transiciones `PUBLICADO → EN_REVISION_PERIODICA` y `EN_REVISION_PERIODICA → BORRADOR` SHALL autorizarse por `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(actorRolGlobal)` (rol global `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`), no por los flags `CanStartReview`/`CanCancelReview` de la matriz `(estado, docRole)` — un actor con ese rol global autoriza estas dos transiciones aunque su `docRole` resuelto para ese documento sea `AUTOR`, `REVISOR` o `APROBADOR`. Cualquier otro rol SHALL recibir `403`.

#### Scenario: Rechazo con motivo y notificación al autor
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: BORRADOR, motivo: "..." (20+ caracteres), notificarAutor: true }` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `200` con `estado: BORRADOR` y dispara una notificación best-effort al autor

#### Scenario: Motivo insuficiente en rechazo
- **WHEN** se envía `motivo` con menos de 20 caracteres en una transición a `BORRADOR` marcada como rechazo
- **THEN** el sistema responde `422`

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

### Requirement: Confirmar revisión periódica
El sistema SHALL exponer `PATCH /api/documents/:id/confirmar-revision`, permitido solo desde `PUBLICADO` o `EN_REVISION_PERIODICA`, que recalcula `FechaRevisionProxima` según `Tipo`: `POL/PRC/PLAN` +12 meses, `INS` +24 meses, `MAT` +6 meses, `REG/INF` sin nueva fecha (permanece sin próxima revisión).

El sistema SHALL autorizar esta acción exclusivamente por `DocumentPermissionResolver.PuedeGestionarRevisionPeriodica(actorRolGlobal)` (rol global `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`) — cualquier otro rol autenticado SHALL recibir `403`. Este gate es nuevo: antes de este requirement, el endpoint no validaba ningún permiso.

#### Scenario: Confirmar revisión de un documento PRC
- **WHEN** se confirma revisión de un documento `tipo: PRC` con `fechaRevisionProxima` actual
- **THEN** la nueva `fechaRevisionProxima` es 12 meses después de la fecha de confirmación

#### Scenario: JEFE_CALIDAD_SYST que fue revisor del documento confirma la vigencia
- **WHEN** un `JEFE_CALIDAD_SYST` que es el `RevisorId` asignado de un documento `PUBLICADO` envía `PATCH /:id/confirmar-revision`
- **THEN** el sistema responde `200`

#### Scenario: OPERARIO no puede confirmar la revisión periódica
- **WHEN** un `OPERARIO` envía `PATCH /:id/confirmar-revision` sobre cualquier documento `PUBLICADO` o `EN_REVISION_PERIODICA`
- **THEN** el sistema responde `403`
