## ADDED Requirements

### Requirement: Contraseña incorrecta en set-pin identificada con errorCode
Cuando `POST /api/auth/set-pin` recibe una `password` que no coincide con la contraseña actual del usuario, el sistema SHALL responder 401 con `errorCode: "CONTRASENA_INCORRECTA"` (`UnauthorizedBusinessException("Contraseña actual incorrecta", "CONTRASENA_INCORRECTA")`) y SHALL NOT modificar `PinHash`.

#### Scenario: set-pin con contraseña actual incorrecta
- **WHEN** un usuario autenticado envía `POST /api/auth/set-pin` con una contraseña incorrecta
- **THEN** el sistema responde 401 con `errorCode: "CONTRASENA_INCORRECTA"` y `PinHash` no cambia
