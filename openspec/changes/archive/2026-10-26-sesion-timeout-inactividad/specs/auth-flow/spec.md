## MODIFIED Requirements

### Requirement: MSW auth handlers interceptan todos los endpoints de autenticación
El sistema SHALL tener handlers MSW para `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `POST /auth/switch-empresa`, `POST /auth/forgot-password` y `POST /auth/reset-password`. `POST /auth/login` SHALL resolver la empresa activa y el rol efectivo del usuario contra `UsuarioEmpresa` según las reglas de `empresa-session` (autoselección con una sola empresa asignada, o `requiresEmpresaSelection` con más de una). `POST /auth/refresh` SHALL leer el `empresaActivaId` persistido para restaurar el rol efectivo correcto. Además SHALL existir handlers para `POST /auth/actividad` y `GET /auth/politica-sesion`; el login SHALL registrar `sesionIniciadaEn`/`ultimaActividadEn` de la sesión mock, cada rotación de refresh SHALL heredarlos, y `POST /auth/refresh` y `POST /auth/actividad` SHALL responder 401 con `errorCode: 'SESION_MAXIMA_ALCANZADA'` o `'SESION_INACTIVA'` aplicando la misma política efectiva (empresa → global, con ajuste a límites) que el backend real.

#### Scenario: Login con credenciales válidas de usuario mono-empresa retorna token, usuario y empresa
- **WHEN** MSW recibe `POST /auth/login` con email y password de un fixture asignado a una sola empresa
- **THEN** responde con `{ data: { accessToken, user, empresaActivaId, empresasDisponibles }, success: true }`

#### Scenario: Login con credenciales válidas de usuario multi-empresa sin empresaId retorna selección pendiente
- **WHEN** MSW recibe `POST /auth/login` con email y password de `user-supervisor-001` sin `empresaId` en el body
- **THEN** responde con `{ data: { requiresEmpresaSelection: true, empresasDisponibles }, success: true }`, sin `accessToken` ni `user`

#### Scenario: Login con credenciales inválidas retorna 401
- **WHEN** MSW recibe `POST /auth/login` con credenciales no presentes en fixtures
- **THEN** responde con status 401 y `{ success: false, message: 'Credenciales inválidas' }`

#### Scenario: Refresh restaura el rol efectivo de la empresa activa persistida
- **WHEN** MSW recibe `POST /auth/refresh` con un refresh token válido y el header de empresa activa correspondiente a `empresa-002` para `user-supervisor-001`
- **THEN** responde con `user.rol: 'JEFE_CALIDAD_SYST'` y `empresaActivaId: 'empresa-002'`

#### Scenario: Switch-empresa exitoso retorna nueva sesión completa
- **WHEN** MSW recibe `POST /auth/switch-empresa` con `{ empresaId: 'empresa-002' }` y un Bearer token válido de `user-supervisor-001`
- **THEN** responde con `{ data: { accessToken, user, empresaActivaId: 'empresa-002', empresasDisponibles }, success: true }`

#### Scenario: Switch-empresa a una empresa no asignada retorna error
- **WHEN** MSW recibe `POST /auth/switch-empresa` con un `empresaId` sin fila `UsuarioEmpresa` activa para el usuario del token
- **THEN** responde con status de error y no modifica la sesión

#### Scenario: Reset con token válido retorna 200
- **WHEN** MSW recibe `POST /auth/reset-password` con `token === 'mock-reset-token'`
- **THEN** responde con `{ success: true }`

#### Scenario: Reset con token inválido retorna 400
- **WHEN** MSW recibe `POST /auth/reset-password` con cualquier otro token
- **THEN** responde con status 400 y `{ success: false, message: 'Token inválido o expirado' }`

#### Scenario: Forgot-password siempre retorna 200
- **WHEN** MSW recibe `POST /auth/forgot-password` con cualquier email
- **THEN** responde con status 200 (no revela si el email existe)

#### Scenario: Refresh mock con inactividad vencida
- **WHEN** MSW recibe `POST /auth/refresh` de una sesión mock cuya `ultimaActividadEn` es anterior a `ahora − inactividadMinutos` de su empresa activa
- **THEN** responde 401 con `{ success: false, errorCode: 'SESION_INACTIVA' }` e invalida esa sesión mock

#### Scenario: Actividad mock extiende la ventana
- **WHEN** MSW recibe `POST /auth/actividad` de una sesión mock vigente
- **THEN** actualiza su `ultimaActividadEn` y responde con la política efectiva y las marcas de tiempo de la sesión
