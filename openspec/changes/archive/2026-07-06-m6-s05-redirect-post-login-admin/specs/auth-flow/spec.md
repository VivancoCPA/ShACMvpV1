## MODIFIED Requirements

### Requirement: LoginPage permite autenticarse con email y contraseña
El sistema SHALL mostrar una página de login centrada con campos de email y contraseña. Al autenticarse exitosamente, el usuario SHALL ser redirigido al destino por defecto de su rol calculado por `getDefaultRouteForRole(rol)`: `/admin/locales` si el rol es `ADMINISTRADOR_SISTEMA`, `/documentos` para el resto de roles. Los errores del servidor SHALL mostrarse como `toast.error`.

#### Scenario: Login exitoso redirige a documentos
- **WHEN** el usuario ingresa credenciales válidas de un rol distinto de `ADMINISTRADOR_SISTEMA` y presiona el botón de submit
- **THEN** `authStore.login()` es llamado
- **THEN** el usuario es redirigido a `/documentos`

#### Scenario: Login exitoso de ADMINISTRADOR_SISTEMA redirige a /admin/locales
- **WHEN** el usuario ingresa las credenciales de `admin@shac.pe` (rol `ADMINISTRADOR_SISTEMA`) y presiona el botón de submit
- **THEN** `authStore.login()` es llamado
- **THEN** el usuario es redirigido a `/admin/locales`, no a `/documentos`

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
- **WHEN** un usuario con sesión activa (`isAuthenticated === true`), rol `ADMINISTRADOR_SISTEMA`, navega o permanece en `/login`
- **THEN** es redirigido a `/admin/locales`, no a `/documentos` ni a `/no-autorizado`

#### Scenario: Usuario ya autenticado de otro rol que visita /login mantiene el destino genérico
- **WHEN** un usuario con sesión activa (`isAuthenticated === true`), rol `JEFE_CALIDAD_SYST`, navega o permanece en `/login`
- **THEN** es redirigido a `/documentos`
