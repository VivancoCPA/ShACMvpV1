## MODIFIED Requirements

### Requirement: MSW replica el asistente IA y las funcionalidades
MSW SHALL manejar dos endpoints:
- `GET /api/config/funcionalidades`, que devuelve `{ asistenteIA: true, asistenteIASimulado: false }`;
- `POST /api/quality-events/:id/asistente-ia`, que lee `body.metodo` y, después de `delay(800)`, devuelve una sugerencia fija de ejemplo en español: con `ISHIKAWA`, causa de 100 a 500 caracteres, las 6 categorías del Ishikawa y 2 o 3 acciones; con `5_PORQUES`, causa, 5 porqués y 2 o 3 acciones, como hasta ahora. Sin método usa `qe.metodoAnalisis` y, si no está definido, `5_PORQUES`, igual que el backend. Agrega `ASISTENTE_IA_CONSULTADO` (`generadoPorIA: true`, `valorNuevo = "<modelo> · <metodo>"`) al audit trail del QE y no modifica sus campos. Un `metodo` con otro valor responde 400.

El handler de `asistente-ia` SHALL responder 404 si el QE no existe o es de otra empresa. Un toggle exportado desde los fixtures (`setAsistenteIAMockFalla(true)`) SHALL hacer que responda 503 con `errorCode = IA_NO_DISPONIBLE` y el mensaje del servidor. El PATCH genérico SHALL marcar `generadoPorIA` o agregar el sufijo según `origenIA` para `causaRaizDefinitiva`, `cincoPorques` e `ishikawa`, igual que el backend.

#### Scenario: Sugerencia mock
- **WHEN** con MSW activo se llama al endpoint de un QE existente sin método ni `metodoAnalisis` guardado
- **THEN** responde 200 con la sugerencia fija de 5 Porqués después de ~800 ms

#### Scenario: Sugerencia mock de Ishikawa
- **WHEN** se llama con `{ metodo: 'ISHIKAWA' }`
- **THEN** responde 200 con `ishikawa` de 6 categorías distintas y sin `cincoPorques`

#### Scenario: Toggle de falla
- **WHEN** `setAsistenteIAMockFalla(true)` está activo
- **THEN** el handler responde 503 con `errorCode = IA_NO_DISPONIBLE`

#### Scenario: PATCH con origenIA.ishikawa
- **WHEN** se guarda `ishikawa` con `origenIA.ishikawa = 'IA'`
- **THEN** la entrada `CAMPO_EDITADO` de `ishikawa` tiene `generadoPorIA: true`
