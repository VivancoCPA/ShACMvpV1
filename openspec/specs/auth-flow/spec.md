# Spec: auth-flow

## Purpose

Define the authentication pages (Login, ForgotPassword, ResetPassword), the dev-mode role selector, the password strength indicator, shared password validation rules, and the MSW handlers for all auth endpoints.

---

## Requirements

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

---

### Requirement: Selector de rol mock visible solo en modo desarrollo MSW
El sistema SHALL mostrar un selector de rol en `LoginPage` únicamente cuando `VITE_ENABLE_MSW === 'true'`. Al seleccionar un rol, el formulario SHALL pre-rellenarse con el email y contraseña del fixture correspondiente.

#### Scenario: Selector visible en modo MSW
- **WHEN** `VITE_ENABLE_MSW === 'true'` y el usuario accede a `/login`
- **THEN** aparece un selector con los 6 roles disponibles con label "Modo desarrollo — seleccionar rol"

#### Scenario: Selección de rol pre-rellena credenciales
- **WHEN** el usuario selecciona el rol `JEFE_CALIDAD_SYST` en el selector de desarrollo
- **THEN** el campo email se rellena con `jefe.calidad@shac.pe`
- **THEN** el campo password se rellena con `Shac2025!`

#### Scenario: Selector no visible en producción
- **WHEN** `VITE_ENABLE_MSW !== 'true'`
- **THEN** el selector de rol no aparece en el DOM

---

### Requirement: ForgotPasswordPage envía solicitud de reset de contraseña
El sistema SHALL mostrar un formulario con campo de email. Tras el submit exitoso SHALL ocultar el formulario y mostrar un mensaje genérico de confirmación que no revele si el email existe en el sistema.

#### Scenario: Envío exitoso muestra mensaje genérico
- **WHEN** el usuario ingresa cualquier email y presiona submit
- **THEN** el formulario se oculta
- **THEN** se muestra el mensaje: "Si el email existe en el sistema, recibirás un enlace en los próximos minutos"

#### Scenario: Error de red muestra toast de error
- **WHEN** la petición al servidor falla por error de red
- **THEN** aparece un `toast.error` con mensaje de error de red

#### Scenario: Botón deshabilitado durante petición
- **WHEN** la petición está en curso
- **THEN** el botón de submit está deshabilitado con spinner inline

#### Scenario: Link de volver navega a login
- **WHEN** el usuario hace click en "volver al login"
- **THEN** el usuario es redirigido a `/login`

---

### Requirement: ResetPasswordPage permite establecer nueva contraseña con token
El sistema SHALL leer el `?token=` de los search params. Si el token está ausente SHALL redirigir a `/login` con `toast.error`. El formulario SHALL tener campos de nueva contraseña y confirmar contraseña con validación Zod.

#### Scenario: Token ausente redirige a login
- **WHEN** el usuario accede a `/reset-password` sin parámetro `?token=`
- **THEN** aparece un `toast.error` indicando que el enlace no es válido
- **THEN** el usuario es redirigido a `/login`

#### Scenario: Reset exitoso navega a login
- **WHEN** el usuario completa el formulario con contraseñas válidas y coincidentes
- **THEN** `POST /auth/reset-password` es llamado con `{ token, password }`
- **THEN** aparece un `toast.success`
- **THEN** el usuario es redirigido a `/login`

#### Scenario: Token inválido muestra toast de error
- **WHEN** el servidor responde con error (token expirado o inválido)
- **THEN** aparece un `toast.error` con el mensaje del servidor

#### Scenario: Contraseñas que no coinciden bloquean el submit
- **WHEN** `password !== confirmPassword`
- **THEN** aparece el error de validación Zod en el campo `confirmPassword`
- **THEN** el formulario no se envía

---

### Requirement: Indicador visual de fortaleza de contraseña en ResetPasswordPage
El sistema SHALL mostrar una barra de 4 segmentos debajo del campo de contraseña que se colorea progresivamente según el número de reglas de `PASSWORD_RULES` que se cumplen.

#### Scenario: Sin reglas cumplidas — barra vacía
- **WHEN** el campo de contraseña está vacío
- **THEN** los 4 segmentos están sin color (gris)

#### Scenario: 1 regla cumplida — nivel débil
- **WHEN** el password cumple exactamente 1 regla de `PASSWORD_RULES`
- **THEN** 1 segmento se colorea en rojo (`error`)

#### Scenario: 2 reglas cumplidas — nivel regular
- **WHEN** el password cumple exactamente 2 reglas
- **THEN** 2 segmentos se colorean en amber (`warning`)

#### Scenario: 3 reglas cumplidas — nivel bueno
- **WHEN** el password cumple exactamente 3 reglas
- **THEN** 3 segmentos se colorean en teal (`teal`)

#### Scenario: 4 o más reglas cumplidas — nivel fuerte
- **WHEN** el password cumple las 4 reglas de `PASSWORD_RULES`
- **THEN** los 4 segmentos se colorean en verde (`success`)

---

### Requirement: Schemas de validación de contraseña aplicados consistentemente
El sistema SHALL definir `PASSWORD_RULES` como constante exportable y aplicar sus reglas en todos los schemas Zod que incluyan campos de contraseña.

#### Scenario: Contraseña sin mayúscula falla validación
- **WHEN** el schema Zod valida `password = "shac2025!"`
- **THEN** el error de validación indica que se requiere al menos una mayúscula

#### Scenario: Contraseña válida pasa validación
- **WHEN** el schema Zod valida `password = "Shac2025!"`
- **THEN** la validación pasa sin errores

---

### Requirement: MSW auth handlers interceptan todos los endpoints de autenticación
El sistema SHALL tener handlers MSW para `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `POST /auth/forgot-password` y `POST /auth/reset-password`.

#### Scenario: Login con credenciales válidas retorna token y usuario
- **WHEN** MSW recibe `POST /auth/login` con email y password de un fixture
- **THEN** responde con `{ data: { accessToken, user }, success: true }`

#### Scenario: Login con credenciales inválidas retorna 401
- **WHEN** MSW recibe `POST /auth/login` con credenciales no presentes en fixtures
- **THEN** responde con status 401 y `{ success: false, message: 'Credenciales inválidas' }`

#### Scenario: Reset con token válido retorna 200
- **WHEN** MSW recibe `POST /auth/reset-password` con `token === 'mock-reset-token'`
- **THEN** responde con `{ success: true }`

#### Scenario: Reset con token inválido retorna 400
- **WHEN** MSW recibe `POST /auth/reset-password` con cualquier otro token
- **THEN** responde con status 400 y `{ success: false, message: 'Token inválido o expirado' }`

#### Scenario: Forgot-password siempre retorna 200
- **WHEN** MSW recibe `POST /auth/forgot-password` con cualquier email
- **THEN** responde con status 200 (no revela si el email existe)

---

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
