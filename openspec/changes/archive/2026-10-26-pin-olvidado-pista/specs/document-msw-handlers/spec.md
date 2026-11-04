## ADDED Requirements

### Requirement: Mock de firma de documento devuelve PIN_INCORRECTO
El handler MSW `POST /api/documents/:id/sign` SHALL responder 401 con `errorCode: "PIN_INCORRECTO"` cuando el PIN enviado no coincide con el PIN mock del usuario, igual que el backend real.

#### Scenario: PIN incorrecto en el mock
- **WHEN** con MSW activo un aprobador firma con un PIN distinto del suyo
- **THEN** el handler responde 401 con `errorCode: "PIN_INCORRECTO"`
