## ADDED Requirements

### Requirement: PIN incorrecto en firma de documento identificado con errorCode
Cuando `POST /api/documents/:id/sign` recibe un `pin` que no coincide con el `PinHash` del actor, el sistema SHALL responder 401 con `errorCode: "PIN_INCORRECTO"` en el envelope de error (`UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO")`) y SHALL NOT cambiar el estado del documento. El status SHALL seguir siendo 401.

#### Scenario: Firma con PIN incorrecto
- **WHEN** el aprobador asignado, con PIN configurado, firma un documento `EN_APROBACION` con un PIN distinto del suyo
- **THEN** el sistema responde 401 con `errorCode: "PIN_INCORRECTO"` y el documento sigue en `EN_APROBACION`
