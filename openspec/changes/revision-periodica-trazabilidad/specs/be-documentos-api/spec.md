## MODIFIED Requirements

### Requirement: Cambio de estado sin firma
El sistema SHALL exponer `PATCH /api/documents/:id/status` con `{ estado, motivo?, notificarAutor? }`, validando la transición contra la máquina de estados y los permisos del `docRole` del actor. SHALL usarse para toda transición que no requiera PIN: enviar a revisión, aprobar revisión, cancelar revisión, rechazar (`EN_REVISION → BORRADOR` o `EN_APROBACION → BORRADOR`, con `motivo` mínimo 20 caracteres cuando se usa como rechazo), iniciar/cancelar revisión periódica. El sistema SHALL NOT exponer un endpoint `POST /:id/status` separado con firma obligatoria — esa transición (la única que requiere PIN, `EN_APROBACION → PUBLICADO`) se cubre exclusivamente por `POST /:id/sign`.

La transición `PUBLICADO → EN_REVISION_PERIODICA` SHALL registrarse en el audit trail con su propia acción `REVISION_PERIODICA_INICIADA` (no el `ESTADO_CAMBIADO` genérico), con un `Motivo` calculado server-side — el `motivo` que venga en el body SHALL ignorarse para esta transición específica:
- `"Revisión sin fecha programada"` si el documento no tiene `FechaRevisionProxima`.
- `"Revisión programada (fecha dd/mm/aaaa)"` si quedan 30 días corridos o menos hasta `FechaRevisionProxima` (calculados contra "hoy" en `America/Lima`), incluyendo una fecha ya vencida.
- `"Revisión anticipada (programada para dd/mm/aaaa)"` si quedan más de 30 días.

#### Scenario: Rechazo con motivo y notificación al autor
- **WHEN** un `JEFE_CALIDAD_SYST` envía `PATCH /:id/status` con `{ estado: BORRADOR, motivo: "..." (20+ caracteres), notificarAutor: true }` sobre un documento en `EN_REVISION`
- **THEN** el sistema responde `200` con `estado: BORRADOR` y dispara una notificación best-effort al autor

#### Scenario: Motivo insuficiente en rechazo
- **WHEN** se envía `motivo` con menos de 20 caracteres en una transición a `BORRADOR` marcada como rechazo
- **THEN** el sistema responde `422`

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
