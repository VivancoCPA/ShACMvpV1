## ADDED Requirements

### Requirement: El interceptor no refresca la sesión ante credenciales incorrectas
El interceptor de respuesta de Axios (`lib/axios.ts`) SHALL rechazar directamente todo 401 cuyo `errorCode` sea `PIN_INCORRECTO` o `CONTRASENA_INCORRECTA` (`CREDENTIAL_ERROR_CODES`). En ese caso SHALL NOT llamar a `refreshToken()`, SHALL NOT reenviar la petición y SHALL NOT llamar a `endSession`. El refresh con reintento único ante un 401 sin `errorCode`, y el cierre por política (`SESION_INACTIVA` / `SESION_MAXIMA_ALCANZADA`), SHALL seguir funcionando igual.

#### Scenario: PIN incorrecto no dispara refresh
- **WHEN** una petición autenticada recibe 401 con `errorCode: "PIN_INCORRECTO"`
- **THEN** la promesa se rechaza con ese error, `refreshToken()` no se llama y la petición se envió una sola vez

#### Scenario: Contraseña incorrecta no dispara refresh
- **WHEN** `POST /api/auth/set-pin` recibe 401 con `errorCode: "CONTRASENA_INCORRECTA"`
- **THEN** la promesa se rechaza, `refreshToken()` no se llama, la petición se envió una sola vez y la sesión sigue activa

#### Scenario: 401 sin código sigue refrescando
- **WHEN** una petición autenticada recibe 401 sin `errorCode`
- **THEN** el interceptor llama a `refreshToken()` y reenvía la petición una vez con el token nuevo
