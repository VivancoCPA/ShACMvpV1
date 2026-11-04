## ADDED Requirements

### Requirement: PIN incorrecto en firma de cierre identificado con errorCode
Cuando `PATCH /api/quality-events/:id/firmar-cierre` recibe un `pin` que no coincide con el `PinHash` del firmante, el sistema SHALL responder 401 con `errorCode: "PIN_INCORRECTO"` (`UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO")`) y SHALL NOT registrar la firma. El status SHALL seguir siendo 401.

#### Scenario: Firma de cierre con PIN incorrecto
- **WHEN** un usuario con `PinHash` configurado envía `PATCH /:id/firmar-cierre` con un `pin` que no coincide
- **THEN** el sistema responde 401 con `errorCode: "PIN_INCORRECTO"` y no registra la firma
