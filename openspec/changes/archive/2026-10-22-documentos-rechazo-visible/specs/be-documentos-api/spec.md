## MODIFIED Requirements

### Requirement: Cambio de estado sin firma
El sistema SHALL exponer `PATCH /api/documents/:id/status` con `{ estado, motivo?, notificarAutor? }`, validando la transición contra la máquina de estados y los permisos del `docRole` del actor. SHALL usarse para toda transición que no requiera PIN: enviar a revisión, aprobar revisión, cancelar revisión, rechazar (`EN_REVISION → BORRADOR` o `EN_APROBACION → BORRADOR`, con `motivo` mínimo 20 caracteres cuando se usa como rechazo), iniciar/cancelar revisión periódica. El sistema SHALL NOT exponer un endpoint `POST /:id/status` separado con firma obligatoria — esa transición (la única que requiere PIN, `EN_APROBACION → PUBLICADO`) se cubre exclusivamente por `POST /:id/sign`.

Las transiciones `_ → BORRADOR` SHALL registrar una entrada de audit trail con la acción específica del caso, nunca `ESTADO_CAMBIADO`, y el motivo (si existe) SHALL guardarse en el campo `Motivo` de `DocumentoAuditTrail` — nunca en `ValorAnterior`:
- `EN_REVISION → BORRADOR` con `motivo` (rechazo del revisor, `docRole` con `CanReject`) → `Accion: RECHAZADO_EN_REVISION`.
- `EN_APROBACION → BORRADOR` (rechazo del aprobador, `docRole` con `CanReject`) → `Accion: RECHAZADO_EN_APROBACION`.
- `EN_REVISION → BORRADOR` sin `motivo` (cancelación del Jefe de Calidad, `docRole` con `CanEdit`) → `Accion: REVISION_CANCELADA`, sin `Motivo`.

En las tres entradas, `EstadoAnterior` y `EstadoNuevo` SHALL seguir llenándose igual que antes. El resto de transiciones (enviar a revisión, aprobar revisión, iniciar/cancelar revisión periódica) SHALL seguir registrando `ESTADO_CAMBIADO` sin cambios.

#### Scenario: Rechazo con motivo y notificación al autor
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: BORRADOR, motivo: "..." (20+ caracteres), notificarAutor: true }` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `200` con `estado: BORRADOR` y dispara una notificación best-effort al autor

#### Scenario: Motivo insuficiente en rechazo
- **WHEN** se envía `motivo` con menos de 20 caracteres en una transición a `BORRADOR` marcada como rechazo
- **THEN** el sistema responde `422`

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
