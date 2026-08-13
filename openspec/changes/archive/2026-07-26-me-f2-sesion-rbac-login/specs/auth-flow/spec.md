## MODIFIED Requirements

### Requirement: LoginPage permite autenticarse con email y contraseña
El sistema SHALL mostrar una página de login en layout de dos paneles (panel izquierdo con arte institucional genérico de SHAC, panel derecho con el formulario) con campos de email y contraseña. Si el usuario autenticado tiene más de una empresa asignada (ver capability `empresa-session`), el sistema SHALL mostrar un paso de selección de empresa antes de completar el login — el formulario de credenciales no se vuelve a pedir. Al autenticarse exitosamente (empresa resuelta, sea por autoselección o por selección explícita), el usuario SHALL ser redirigido al destino por defecto de su rol efectivo en esa empresa, calculado por `getDefaultRouteForRole(rol)`: `/admin/locales` si el rol es `ADMINISTRADOR_SISTEMA`, `/documentos` para el resto de roles. Los errores del servidor SHALL mostrarse como `toast.error`.

#### Scenario: Login exitoso de usuario de una sola empresa redirige a documentos
- **WHEN** el usuario ingresa credenciales válidas de un rol distinto de `ADMINISTRADOR_SISTEMA`, asignado a una sola empresa, y presiona el botón de submit
- **THEN** `authStore.login()` es llamado con la empresa autoseleccionada
- **THEN** el usuario es redirigido a `/documentos`

#### Scenario: Login exitoso de ADMINISTRADOR_SISTEMA redirige a /admin/locales
- **WHEN** el usuario ingresa las credenciales de `admin@shac.pe` (rol `ADMINISTRADOR_SISTEMA`) y presiona el botón de submit
- **THEN** `authStore.login()` es llamado
- **THEN** el usuario es redirigido a `/admin/locales`, no a `/documentos`

#### Scenario: Login de usuario multi-empresa redirige según el rol de la empresa elegida
- **WHEN** `user-supervisor-001` ingresa sus credenciales, elige `empresa-002` en el paso de selección de empresa, y confirma
- **THEN** `authStore.login()` es llamado con `user.rol: 'JEFE_CALIDAD_SYST'` y `empresaActivaId: 'empresa-002'`
- **THEN** el usuario es redirigido según el destino por defecto de `JEFE_CALIDAD_SYST`

#### Scenario: Login fallido muestra toast de error
- **WHEN** el usuario ingresa credenciales inválidas
- **THEN** aparece un `toast.error` con el mensaje del servidor
- **THEN** el usuario permanece en `/login`

#### Scenario: Botón deshabilitado durante petición en curso
- **WHEN** el formulario está siendo enviado
- **THEN** el botón de submit está deshabilitado y muestra un spinner inline

#### Scenario: Toggle mostrar/ocultar contraseña
- **WHEN** el usuario hace click en el ícono Eye/EyeOff junto al campo de contraseña
- **THEN** el campo alterna entre `type="password"` y `type="text"`

#### Scenario: Link a forgot-password navega correctamente
- **WHEN** el usuario hace click en el link "olvidé mi contraseña"
- **THEN** el usuario es redirigido a `/forgot-password`

#### Scenario: Usuario ya autenticado que visita /login es redirigido a su destino por defecto
- **WHEN** un usuario con sesión activa (`isAuthenticated === true`), rol efectivo `ADMINISTRADOR_SISTEMA` en su empresa activa, navega o permanece en `/login`
- **THEN** es redirigido a `/admin/locales`, no a `/documentos` ni a `/no-autorizado`

#### Scenario: Usuario ya autenticado de otro rol que visita /login mantiene el destino genérico
- **WHEN** un usuario con sesión activa (`isAuthenticated === true`), rol efectivo `JEFE_CALIDAD_SYST` en su empresa activa, navega o permanece en `/login`
- **THEN** es redirigido a `/documentos`

---

### Requirement: MSW auth handlers interceptan todos los endpoints de autenticación
El sistema SHALL tener handlers MSW para `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `POST /auth/switch-empresa`, `POST /auth/forgot-password` y `POST /auth/reset-password`. `POST /auth/login` SHALL resolver la empresa activa y el rol efectivo del usuario contra `UsuarioEmpresa` según las reglas de `empresa-session` (autoselección con una sola empresa asignada, o `requiresEmpresaSelection` con más de una). `POST /auth/refresh` SHALL leer el `empresaActivaId` persistido para restaurar el rol efectivo correcto.

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

## ADDED Requirements

### Requirement: Selección de empresa activa durante el login
Cuando el login requiere selección de empresa (`requiresEmpresaSelection: true`), el sistema SHALL mostrar una lista de las empresas disponibles del usuario (`razonSocial` de cada una) dentro del mismo panel de `LoginPage`, con la empresa usada en la sesión anterior (si existe, vía el valor persistido de `empresaActivaId`) preseleccionada como sugerencia — sin completar el login automáticamente con ella. El usuario SHALL confirmar explícitamente una opción para completar el login.

#### Scenario: Paso de selección lista las empresas disponibles
- **WHEN** `user-supervisor-001` completa el formulario de credenciales y el login responde `requiresEmpresaSelection: true`
- **THEN** la UI muestra "Minera Andina del Sur S.A.C." y "Terminal Portuario Ilo S.A.C." como opciones

#### Scenario: Empresa de la sesión anterior aparece preseleccionada
- **WHEN** el usuario había usado `empresa-002` en su última sesión (valor persistido) y vuelve a loguearse
- **THEN** la opción "Terminal Portuario Ilo S.A.C." aparece preseleccionada, pero el login no se completa hasta que el usuario confirma

#### Scenario: Confirmar una empresa distinta a la preseleccionada completa el login con esa elección
- **WHEN** el usuario cambia la selección a "Minera Andina del Sur S.A.C." y confirma
- **THEN** el login se completa con `empresaActivaId: 'empresa-001'`, no con la empresa preseleccionada por defecto

---

### Requirement: LoginPage usa layout de dos paneles con arte institucional genérico
El sistema SHALL renderizar `LoginPage` con un panel izquierdo de arte/branding institucional genérico de SHAC (no específico de ninguna empresa) y un panel derecho con el formulario de autenticación (y, cuando aplique, el paso de selección de empresa). El panel izquierdo SHALL permanecer genérico durante todo el flujo de login, incluso durante el paso de selección de empresa — la empresa recién elegida no cambia el arte del panel izquierdo en esta pantalla.

#### Scenario: Panel izquierdo visible en desktop
- **WHEN** el usuario accede a `/login` en un viewport de escritorio
- **THEN** el panel izquierdo con el arte institucional de SHAC es visible junto al panel derecho con el formulario

#### Scenario: Panel izquierdo no cambia durante la selección de empresa
- **WHEN** el login entra en el paso de selección de empresa
- **THEN** el panel izquierdo sigue mostrando el arte genérico de SHAC, sin logo de ninguna empresa específica
