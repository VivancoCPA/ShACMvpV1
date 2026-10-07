## MODIFIED Requirements

### Requirement: Firma y publicación (RN-DOC-004)
El sistema SHALL exponer `POST /api/documents/:id/sign` con `{ pin }`, permitido solo desde `EN_APROBACION` y solo si el actor es el `docRole APROBADOR` asignado (`AprobadorId == actor.Id`) — verificación de identidad que el mock no realizaba. SHALL validar `pin` contra `ShacUser.PinHash` del actor vía `IPasswordHasher<ShacUser>`: `BusinessRuleException` con `RuleCode: "PIN_NO_CONFIGURADO"` si el actor no tiene PIN configurado, `UnauthorizedBusinessException` si el PIN no coincide. Al firmar exitosamente, el sistema SHALL: fijar `Estado: PUBLICADO`; obsoletizar automáticamente la versión previa `PUBLICADO` del mismo `Codigo`, si existe (RN-DOC-001); fijar `ArchivoOriginalBloqueado: true`; generar y persistir el PDF de distribución.

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
- **THEN** el sistema responde `422` con `errorCode: "PIN_NO_CONFIGURADO"` en el envelope de error, sin cambiar el estado del documento
