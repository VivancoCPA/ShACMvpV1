# Spec: routing

## Purpose

Define the React Router v6 structure with public and protected routes, the RoleGuard component, placeholder routes for pending modules, and the `/no-autorizado` page.

---

## Requirements

### Requirement: Router define rutas públicas y protegidas con separación clara
El sistema SHALL usar `createBrowserRouter` de React Router v6 con rutas públicas (sin autenticación) y rutas protegidas bajo `AppShell` que requieren autenticación.

#### Scenario: Ruta raíz redirige a documentos
- **WHEN** el usuario autenticado navega a `/`
- **THEN** es redirigido automáticamente a `/documentos`

#### Scenario: Rutas públicas accesibles sin autenticación
- **WHEN** un usuario no autenticado navega a `/login`, `/forgot-password` o `/reset-password`
- **THEN** la página se renderiza sin redirección

#### Scenario: Ruta no encontrada muestra NotFoundPage
- **WHEN** el usuario navega a cualquier ruta que no existe (e.g., `/ruta-inexistente`)
- **THEN** se renderiza `NotFoundPage` con status 404

---

### Requirement: RoleGuard protege rutas según autenticación y rol
El `RoleGuard` SHALL verificar en render-time si el usuario está autenticado y si su rol está entre los roles permitidos. No SHALL usar `useEffect` para hacer la verificación.

#### Scenario: Usuario no autenticado es redirigido a login
- **WHEN** un usuario no autenticado intenta acceder a cualquier ruta bajo `AppShell`
- **THEN** es redirigido a `/login` con `replace: true`

#### Scenario: Usuario con rol insuficiente es redirigido a no-autorizado
- **WHEN** el usuario tiene rol `OPERARIO` e intenta acceder a `/usuarios`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Usuario con rol válido accede normalmente
- **WHEN** el usuario tiene rol `JEFE_CALIDAD_SYST` e intenta acceder a `/usuarios`
- **THEN** la ruta se renderiza con `<Outlet />`

#### Scenario: Ruta sin restricción de rol solo requiere autenticación
- **WHEN** el usuario está autenticado con cualquier rol e intenta acceder a `/documentos`
- **THEN** la ruta se renderiza sin verificación de rol específico

---

### Requirement: Rutas de módulos pendientes muestran placeholder
El sistema SHALL renderizar un placeholder con mensaje "Próximamente" para las rutas de módulos no implementados en el MVP actual.

#### Scenario: Rutas pendientes muestran estado de construcción
- **WHEN** el usuario navega a `/no-conformidades`, `/incidentes`, `/quality-events`, `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

---

### Requirement: Ruta `/no-autorizado` muestra página de acceso denegado
El sistema SHALL tener una ruta `/no-autorizado` que renderice `UnauthorizedPage` accesible para cualquier usuario autenticado.

#### Scenario: Página de no autorizado es visible para usuarios autenticados
- **WHEN** un usuario autenticado es redirigido a `/no-autorizado`
- **THEN** `UnauthorizedPage` se renderiza con mensaje de acceso denegado y link para volver
