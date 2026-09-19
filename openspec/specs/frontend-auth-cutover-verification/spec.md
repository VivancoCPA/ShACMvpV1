# frontend-auth-cutover-verification

## Purpose

Verificación manual en navegador de los flujos de Auth de `shc-controldoc` (login mono-empresa, login multi-empresa con selección de empresa, login de superadmin, refresh silencioso, logout, switch-empresa, forgot/reset-password, change-password) contra el backend .NET real + Postgres real, con `VITE_ENABLE_MSW=false` — sin cambio de comportamiento observable respecto a MSW. Equivalente de Auth a `frontend-catalogos-cutover-verification` (change `fe-be-cutover-catalogos`).

## Requirements

### Requirement: Los flujos de Auth del frontend funcionan de punta a punta contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar los mismos flujos de autenticación que hoy funcionan contra MSW, sin ningún cambio de comportamiento observable para el usuario (mismos toasts, mismas redirecciones, mismo paso de selección de empresa cuando aplica).

#### Scenario: Login de usuario mono-empresa contra el backend real

- **WHEN** un usuario activo asignado a una sola empresa (seed real de Postgres dev) ingresa credenciales válidas en `LoginPage` con `VITE_ENABLE_MSW=false`
- **THEN** la sesión se completa sin paso de selección de empresa, y el usuario es redirigido al destino por defecto de su rol efectivo

#### Scenario: Login de usuario multi-empresa contra el backend real

- **WHEN** un usuario con dos o más empresas asignadas (seed real) ingresa credenciales válidas sin haber elegido empresa aún
- **THEN** aparece el paso de selección de empresa con las razones sociales reales de Postgres
- **WHEN** el usuario confirma una de las empresas listadas
- **THEN** la sesión se completa con `empresaActivaId` y `user.rol` correspondientes al rol efectivo de esa empresa específica

#### Scenario: Login de superadmin contra el backend real

- **WHEN** el usuario `superadmin` sembrado por `DevSeed` (`appsettings.Development.json`) ingresa sus credenciales
- **THEN** la sesión se completa sin paso de selección de empresa, con `rol: 'SUPERADMIN'`

#### Scenario: Refresh silencioso al recargar la página mantiene la sesión

- **WHEN** un usuario con sesión activa recarga la página (`F5`) con `VITE_ENABLE_MSW=false`
- **THEN** `authStore.bootstrap()` restaura la sesión usando la cookie `httpOnly` real (`shac_refresh_token`), sin redirigir a `/login`

#### Scenario: Logout invalida la sesión contra el backend real

- **WHEN** un usuario con sesión activa hace logout
- **THEN** el `accessToken` se limpia del store, y una recarga posterior de la página no restaura la sesión (la cookie fue invalidada/eliminada por el backend)

#### Scenario: Switch-empresa contra el backend real recalcula el rol efectivo

- **WHEN** un usuario multi-empresa autenticado cambia de empresa activa desde la UI (no desde el login)
- **THEN** la sesión se actualiza con el nuevo `empresaActivaId` y el `rol` efectivo correspondiente a esa empresa, sin requerir un nuevo login

#### Scenario: Forgot-password y reset-password completan el flujo de stub documentado

- **WHEN** un usuario solicita reset de contraseña desde `ForgotPasswordPage` contra el backend real
- **THEN** el backend responde 200 de forma indistinguible exista o no el email (mismo comportamiento que MSW), y el token generado solo queda logueado server-side (sin envío de email real — comportamiento de stub ya documentado en `CLAUDE.md`, no un hallazgo nuevo)

#### Scenario: Change-password valida la contraseña actual contra el backend real

- **WHEN** un usuario autenticado cambia su contraseña desde `ProfilePage` con el `currentPassword` correcto
- **THEN** el cambio se completa con 200
- **WHEN** el `currentPassword` es incorrecto
- **THEN** la UI muestra el error correspondiente sin completar el cambio

### Requirement: `.env.production` no despliega con MSW activo

El sistema SHALL tener `VITE_ENABLE_MSW=false` en `shc-controldoc/.env.production`, con `VITE_API_BASE_URL` apuntando a una URL real del backend cuando exista, o documentado explícitamente como pendiente si el hosting de producción aún no está decidido.

#### Scenario: Build de producción no incluye el mock activo

- **WHEN** se inspecciona `shc-controldoc/.env.production` después de este change
- **THEN** `VITE_ENABLE_MSW` es `false`, no `true`
