## MODIFIED Requirements

### Requirement: Router define rutas públicas y protegidas con separación clara
El sistema SHALL usar `createBrowserRouter` de React Router v6 con rutas públicas (sin autenticación) y rutas protegidas bajo `AppShell` que requieren autenticación. La ruta índice `/` SHALL redirigir al destino por defecto del rol del usuario autenticado, calculado por `getDefaultRouteForRole(rol)`: `/admin/locales` si el rol es `ADMINISTRADOR_SISTEMA`, `/documentos` para el resto de roles. Este cálculo SHALL aplicarse tanto en login fresco como en la restauración de sesión vía bootstrap (hard-refresh, navegación directa por URL a `/`).

#### Scenario: Ruta raíz redirige a documentos para roles operativos
- **WHEN** un usuario autenticado con rol distinto de `ADMINISTRADOR_SISTEMA` navega a `/`
- **THEN** es redirigido automáticamente a `/documentos`

#### Scenario: Ruta raíz redirige a /admin/locales para ADMINISTRADOR_SISTEMA
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_SISTEMA` navega a `/`
- **THEN** es redirigido automáticamente a `/admin/locales`, no a `/documentos` ni a `/no-autorizado`

#### Scenario: Hard-refresh de ADMINISTRADOR_SISTEMA en / aterriza en /admin/locales
- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` ya logueado hace un hard-refresh estando en `/` y `authStore.bootstrap()` restaura la sesión (`isAuthenticated = true`)
- **THEN** es redirigido a `/admin/locales` una vez resuelto el bootstrap, sin pasar por `/no-autorizado`

#### Scenario: Rutas públicas accesibles sin autenticación
- **WHEN** un usuario no autenticado navega a `/login`, `/forgot-password` o `/reset-password`
- **THEN** la página se renderiza sin redirección

#### Scenario: Ruta no encontrada muestra NotFoundPage
- **WHEN** el usuario navega a cualquier ruta que no existe (e.g., `/ruta-inexistente`)
- **THEN** se renderiza `NotFoundPage` con status 404
