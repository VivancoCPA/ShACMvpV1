## ADDED Requirements

### Requirement: MSW replica el asistente IA y las funcionalidades
MSW SHALL manejar dos endpoints:
- `GET /api/config/funcionalidades`, que devuelve `{ asistenteIA: true, asistenteIASimulado: false }`;
- `POST /api/quality-events/:id/asistente-ia`, que después de `delay(800)` devuelve una sugerencia fija de ejemplo en español (causa de 100 a 500 caracteres, 5 porqués y 2 o 3 acciones), agrega `ASISTENTE_IA_CONSULTADO` (`generadoPorIA: true`) al audit trail del QE y no modifica sus campos.

El handler de `asistente-ia` SHALL responder 404 si el QE no existe o es de otra empresa. Un toggle exportado desde los fixtures (`setAsistenteIAMockFalla(true)`) SHALL hacer que responda 503 con `errorCode = IA_NO_DISPONIBLE` y el mensaje del servidor. El PATCH genérico SHALL marcar `generadoPorIA` o agregar el sufijo según `origenIA`, igual que el backend.

#### Scenario: Sugerencia mock
- **WHEN** con MSW activo se llama al endpoint de un QE existente
- **THEN** responde 200 con la sugerencia fija después de ~800 ms

#### Scenario: Toggle de falla
- **WHEN** `setAsistenteIAMockFalla(true)` está activo
- **THEN** el handler responde 503 con `errorCode = IA_NO_DISPONIBLE`
