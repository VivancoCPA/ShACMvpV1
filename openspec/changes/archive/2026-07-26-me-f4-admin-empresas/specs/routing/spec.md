## MODIFIED Requirements

### Requirement: Router define rutas públicas y protegidas con separación clara
El sistema SHALL usar `createBrowserRouter` de React Router v6 con rutas públicas (sin autenticación) y rutas protegidas bajo `AppShell` que requieren autenticación. La ruta índice `/` SHALL redirigir al destino por defecto del rol del usuario autenticado, calculado por `getDefaultRouteForRole(rol)`: `/admin/empresas` si el rol es `SUPERADMIN`, `/admin/locales` si el rol es `ADMINISTRADOR_SISTEMA`, `/usuarios` si el rol es `ADMINISTRADOR_EMPRESA`, `/documentos` para el resto de roles. Este cálculo SHALL aplicarse tanto en login fresco como en la restauración de sesión vía bootstrap (hard-refresh, navegación directa por URL a `/`).

#### Scenario: Ruta raíz redirige a documentos para roles operativos
- **WHEN** un usuario autenticado con rol distinto de `ADMINISTRADOR_SISTEMA`, `ADMINISTRADOR_EMPRESA` y `SUPERADMIN` navega a `/`
- **THEN** es redirigido automáticamente a `/documentos`

#### Scenario: Ruta raíz redirige a /admin/locales para ADMINISTRADOR_SISTEMA
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_SISTEMA` navega a `/`
- **THEN** es redirigido automáticamente a `/admin/locales`, no a `/documentos`, `/usuarios` ni a `/no-autorizado`

#### Scenario: Ruta raíz redirige a /usuarios para ADMINISTRADOR_EMPRESA
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_EMPRESA` navega a `/`
- **THEN** es redirigido automáticamente a `/usuarios`

#### Scenario: Ruta raíz redirige a /admin/empresas para SUPERADMIN
- **WHEN** un usuario autenticado con rol `SUPERADMIN` navega a `/`
- **THEN** es redirigido automáticamente a `/admin/empresas`

#### Scenario: Hard-refresh de ADMINISTRADOR_SISTEMA en / aterriza en /admin/locales
- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` ya logueado hace un hard-refresh estando en `/` y `authStore.bootstrap()` restaura la sesión (`isAuthenticated = true`)
- **THEN** es redirigido a `/admin/locales` una vez resuelto el bootstrap, sin pasar por `/no-autorizado`

#### Scenario: Rutas públicas accesibles sin autenticación
- **WHEN** un usuario no autenticado navega a `/login`, `/forgot-password` o `/reset-password`
- **THEN** la página se renderiza sin redirección

#### Scenario: Ruta no encontrada muestra NotFoundPage
- **WHEN** el usuario navega a cualquier ruta que no existe (e.g., `/ruta-inexistente`)
- **THEN** se renderiza `NotFoundPage` con status 404

### Requirement: RoleGuard protege rutas según autenticación y rol
El `RoleGuard` SHALL verificar en render-time si el usuario está autenticado y si su rol está entre los roles permitidos. No SHALL usar `useEffect` para hacer la verificación. La ruta `/usuarios` SHALL estar protegida por `RoleGuard requiredRoles={['ADMINISTRADOR_EMPRESA']}` — acceso exclusivo de ese rol, reemplazando el guard anterior (`['ADMINISTRADOR_SISTEMA']`). `ADMINISTRADOR_SISTEMA` conserva sin cambios su acceso a `/admin/locales` y `/admin/areas`.

#### Scenario: Usuario no autenticado es redirigido a login
- **WHEN** un usuario no autenticado intenta acceder a cualquier ruta bajo `AppShell`
- **THEN** es redirigido a `/login` con `replace: true`

#### Scenario: Usuario con rol insuficiente es redirigido a no-autorizado
- **WHEN** el usuario tiene rol `OPERARIO` e intenta acceder a `/usuarios`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: ADMINISTRADOR_SISTEMA pierde acceso a /usuarios
- **WHEN** el usuario tiene rol `ADMINISTRADOR_SISTEMA` e intenta acceder a `/usuarios`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Único rol válido accede normalmente a /usuarios
- **WHEN** el usuario tiene rol `ADMINISTRADOR_EMPRESA` e intenta acceder a `/usuarios`
- **THEN** la ruta se renderiza con `<Outlet />`

#### Scenario: Ruta sin restricción de rol solo requiere autenticación
- **WHEN** el usuario está autenticado con cualquier rol e intenta acceder a `/documentos`
- **THEN** la ruta se renderiza sin verificación de rol específico

## ADDED Requirements

### Requirement: Ruta /admin/empresas registrada con RoleGuard exclusivo de SUPERADMIN
El sistema SHALL registrar la ruta `/admin/empresas` en el router con `<RoleGuard requiredRoles={['SUPERADMIN']}>`. La ruta SHALL renderizar `EmpresasAdminPage` de `src/features/empresas/pages/EmpresasAdminPage.tsx`.

#### Scenario: SUPERADMIN accede a /admin/empresas sin redirección
- **WHEN** un usuario autenticado con rol `SUPERADMIN` navega a `/admin/empresas`
- **THEN** `EmpresasAdminPage` se renderiza sin redirección a `/no-autorizado`

#### Scenario: Cualquier otro rol es redirigido desde /admin/empresas
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_SISTEMA` o `ADMINISTRADOR_EMPRESA` navega a `/admin/empresas`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Usuario no autenticado es redirigido a login desde /admin/empresas
- **WHEN** un usuario no autenticado navega a `/admin/empresas`
- **THEN** es redirigido a `/login` con `replace: true`

### Requirement: Ruta /admin/empresas/:id/usuarios registrada con RoleGuard exclusivo de SUPERADMIN
El sistema SHALL registrar la ruta `/admin/empresas/:id/usuarios` en el router bajo el mismo `<RoleGuard requiredRoles={['SUPERADMIN']}>` que `/admin/empresas`. La ruta SHALL renderizar `EmpresaUsuariosPage` de `src/features/empresas/pages/EmpresaUsuariosPage.tsx`. El parámetro `:id` SHALL estar disponible via `useParams()`.

#### Scenario: SUPERADMIN accede a la pantalla de asignación de una empresa
- **WHEN** un usuario autenticado con rol `SUPERADMIN` navega a `/admin/empresas/empresa-001/usuarios`
- **THEN** `EmpresaUsuariosPage` se renderiza con `id` igual a `empresa-001` disponible via `useParams()`, sin redirección

#### Scenario: ADMINISTRADOR_EMPRESA es redirigido desde la pantalla de asignación
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_EMPRESA` navega a `/admin/empresas/empresa-001/usuarios` por URL directa
- **THEN** es redirigido a `/no-autorizado`
