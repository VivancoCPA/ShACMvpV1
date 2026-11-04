## ADDED Requirements

### Requirement: La sesión original se rastrea a través de las rotaciones
Cada refresh token SHALL registrar `SesionIniciadaEn` y `UltimaActividadEn`:
- en el login, ambos toman el instante actual;
- en cada rotación de `/api/auth/refresh`, el token nuevo SHALL heredar los dos valores del token anterior;
- `/api/auth/switch-empresa` SHALL NOT modificarlos.

#### Scenario: La rotación conserva el inicio de sesión
- **WHEN** un usuario hace login y después llama dos veces a `/api/auth/refresh`
- **THEN** el refresh token vigente tiene el mismo `SesionIniciadaEn` que el emitido en el login

### Requirement: `/api/auth/refresh` hace cumplir la política de sesión
Antes de emitir tokens, `/api/auth/refresh` SHALL resolver la política de la empresa activa del token y comprobar, en este orden:
1. Si `ahora − SesionIniciadaEn` supera `sesionMaximaHoras`, revoca el token y responde 401 con `errorCode: "SESION_MAXIMA_ALCANZADA"`.
2. Si `ahora − UltimaActividadEn` supera `inactividadMinutos`, revoca el token y responde 401 con `errorCode: "SESION_INACTIVA"`.

`/api/auth/refresh` SHALL NOT actualizar `UltimaActividadEn`.

#### Scenario: Inactividad vencida
- **WHEN** el refresh token vigente tiene `UltimaActividadEn` anterior a `ahora − inactividadMinutos`
- **THEN** la respuesta es 401 con `errorCode: "SESION_INACTIVA"` y el token queda con `RevokedAt` no nulo

#### Scenario: Sesión máxima vencida pese a actividad reciente
- **WHEN** el refresh token tiene `SesionIniciadaEn` anterior a `ahora − sesionMaximaHoras` y `UltimaActividadEn` de hace 1 minuto
- **THEN** la respuesta es 401 con `errorCode: "SESION_MAXIMA_ALCANZADA"` y el token queda revocado

#### Scenario: El refresh por polling no extiende la sesión
- **WHEN** se llama a `/api/auth/refresh` repetidamente sin llamar a `/api/auth/actividad`
- **THEN** `UltimaActividadEn` del token vigente sigue siendo el del login

### Requirement: Registro explícito de actividad real
`POST /api/auth/actividad` SHALL identificar la sesión por la cookie del refresh token y aplicar las mismas comprobaciones que `/api/auth/refresh`. Si las pasa, actualiza `UltimaActividadEn = ahora` en el token vigente y devuelve `{ inactividadMinutos, sesionMaximaHoras, sesionIniciadaEn, ultimaActividadEn }`. Sin una cookie válida responde 401 "Sesión expirada". Ninguna otra petición (polling de notificaciones, contador de pendientes, SignalR) SHALL actualizar `UltimaActividadEn`.

#### Scenario: Actividad registrada
- **WHEN** un usuario autenticado llama a `POST /api/auth/actividad` dentro de su ventana de inactividad
- **THEN** la respuesta es 200 y `UltimaActividadEn` del token pasa a ser aproximadamente el instante actual

#### Scenario: Polling de notificaciones no cuenta
- **WHEN** el usuario llama a `GET /api/notifications` varias veces
- **THEN** `UltimaActividadEn` del refresh token no cambia

### Requirement: Consulta de la política efectiva de la sesión
`GET /api/auth/politica-sesion` SHALL estar disponible para cualquier usuario autenticado y devolver `{ inactividadMinutos, sesionMaximaHoras, sesionIniciadaEn, ultimaActividadEn }`. La política es la de la empresa activa, o la global para SUPERADMIN. `sesionIniciadaEn`/`ultimaActividadEn` SHALL ser nulos si la petición no trae una cookie de refresh válida.

#### Scenario: Usuario con empresa configurada
- **WHEN** un OPERARIO de una empresa con `inactividadMinutos: 5` consulta la política
- **THEN** recibe `inactividadMinutos: 5`

### Requirement: Access token de vida corta
El access token JWT SHALL emitirse con una vigencia de 5 minutos, igual al piso absoluto de inactividad. Así una sesión cerrada en el servidor deja de operar en, como máximo, esa vigencia. La conexión SignalR SHALL reconectar obteniendo un token vigente.

#### Scenario: Vigencia del token emitido
- **WHEN** un usuario hace login
- **THEN** el claim `exp` del access token es aproximadamente 5 minutos posterior a `iat`/emisión

### Requirement: El cambio de empresa aplica la política de la empresa nueva
Tras `POST /api/auth/switch-empresa`, las comprobaciones de `/refresh` y `/actividad` SHALL usar la política de la nueva empresa activa sin reiniciar `SesionIniciadaEn`.

#### Scenario: Cambio a una empresa con inactividad más corta
- **WHEN** un usuario cambia a una empresa con `inactividadMinutos: 5` y su última actividad fue hace 10 minutos
- **THEN** el siguiente `/api/auth/refresh` responde 401 `SESION_INACTIVA`

### Requirement: Registro de cierres por política
Cada revocación por `SESION_INACTIVA` o `SESION_MAXIMA_ALCANZADA` SHALL registrarse en el log de autenticación del servidor con el motivo, el usuario, la empresa, `SesionIniciadaEn` y `UltimaActividadEn`.

#### Scenario: Cierre por inactividad registrado
- **WHEN** `/api/auth/refresh` revoca un token por inactividad
- **THEN** se emite una entrada de log de nivel Information con el motivo `SESION_INACTIVA` y el id del usuario
