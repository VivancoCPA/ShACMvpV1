## ADDED Requirements

### Requirement: MockUser registra fecha de creación de cuenta y último acceso
`MockUser` (`auth.fixtures.ts`) SHALL incorporar `createdAt: string` (ISO 8601, obligatorio) como fecha de creación de cuenta con valor semilla fijo por usuario (no cambia en runtime), y `lastLogin?: string` (ISO 8601, opcional) como fecha/hora del último inicio de sesión exitoso. El handler MSW de login SHALL actualizar `lastLogin` del usuario correspondiente en `authFixtures` cada vez que ese usuario inicia sesión correctamente — no es un valor estático de fixture.

#### Scenario: Los 11 usuarios de auth.fixtures.ts tienen createdAt semilla
- **WHEN** se inspecciona `authFixtures`
- **THEN** cada uno de los 11 usuarios tiene un `createdAt` con fecha coherente, no todas iguales entre sí

#### Scenario: Login exitoso actualiza lastLogin
- **WHEN** MSW recibe `POST /auth/login` con credenciales válidas de un fixture
- **THEN** el `lastLogin` del usuario correspondiente en `authFixtures` se actualiza a la fecha/hora actual (ISO 8601) antes de retornar el usuario en la respuesta

#### Scenario: Usuario que nunca inició sesión en el mock no tiene lastLogin
- **WHEN** se inspecciona `authFixtures` para un usuario que no ha iniciado sesión desde que se agregó el campo
- **THEN** su `lastLogin` es `undefined`
