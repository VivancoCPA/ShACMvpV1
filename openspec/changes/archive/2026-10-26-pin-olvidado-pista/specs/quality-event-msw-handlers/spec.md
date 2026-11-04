## ADDED Requirements

### Requirement: Mock de firma de cierre devuelve PIN_INCORRECTO
El handler MSW `PATCH /api/quality-events/:id/firmar-cierre` SHALL responder 401 con `errorCode: "PIN_INCORRECTO"` cuando el PIN enviado no coincide con el PIN mock del firmante, igual que el backend real.

#### Scenario: PIN incorrecto en el mock de cierre
- **WHEN** con MSW activo el firmante envía un PIN distinto del suyo
- **THEN** el handler responde 401 con `errorCode: "PIN_INCORRECTO"`
