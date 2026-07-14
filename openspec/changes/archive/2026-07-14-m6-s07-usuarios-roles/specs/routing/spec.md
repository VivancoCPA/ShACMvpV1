## MODIFIED Requirements

### Requirement: RoleGuard protege rutas según autenticación y rol
El `RoleGuard` SHALL verificar en render-time si el usuario está autenticado y si su rol está entre los roles permitidos. No SHALL usar `useEffect` para hacer la verificación. La ruta `/usuarios` SHALL estar protegida por `RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA']}` — acceso exclusivo de ese rol, reemplazando el guard anterior (`['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION']`).

#### Scenario: Usuario no autenticado es redirigido a login
- **WHEN** un usuario no autenticado intenta acceder a cualquier ruta bajo `AppShell`
- **THEN** es redirigido a `/login` con `replace: true`

#### Scenario: Usuario con rol insuficiente es redirigido a no-autorizado
- **WHEN** el usuario tiene rol `OPERARIO` e intenta acceder a `/usuarios`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: JEFE_CALIDAD_SYST y ALTA_DIRECCION pierden acceso a /usuarios
- **WHEN** el usuario tiene rol `JEFE_CALIDAD_SYST` o `ALTA_DIRECCION` e intenta acceder a `/usuarios`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Único rol válido accede normalmente a /usuarios
- **WHEN** el usuario tiene rol `ADMINISTRADOR_SISTEMA` e intenta acceder a `/usuarios`
- **THEN** la ruta se renderiza con `<Outlet />`

#### Scenario: Ruta sin restricción de rol solo requiere autenticación
- **WHEN** el usuario está autenticado con cualquier rol e intenta acceder a `/documentos`
- **THEN** la ruta se renderiza sin verificación de rol específico
