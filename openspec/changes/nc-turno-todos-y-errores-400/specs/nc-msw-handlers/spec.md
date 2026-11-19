## ADDED Requirements

### Requirement: Handlers de NC validan enums como el backend real
`POST /api/nonconformities` y `PATCH /api/nonconformities/:id` SHALL validar los campos enumerados presentes en el body (`turno` ∈ `TODOS|DIA|TARDE|NOCHE`, `dominio`, `origen`, `tipo`, `severidad`) y responder **400** con `success: false` y `message` `"Valor inválido en el campo '<campo>'."` ante un valor desconocido, sin crear ni modificar la NC.

#### Scenario: Turno TODOS aceptado en el mock
- **WHEN** el frontend envía `POST /api/nonconformities` con `turno: 'TODOS'` y el resto del body válido
- **THEN** el handler responde 201 y la NC creada tiene `turno: 'TODOS'`

#### Scenario: Turno desconocido en el mock
- **WHEN** el frontend envía `POST /api/nonconformities` con `turno: 'XYZ'`
- **THEN** el handler responde 400 con `message: "Valor inválido en el campo 'turno'."` y no agrega la NC al store
