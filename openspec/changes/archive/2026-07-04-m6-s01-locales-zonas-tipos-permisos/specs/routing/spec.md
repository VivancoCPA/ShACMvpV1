## ADDED Requirements

### Requirement: Ruta /admin/locales registrada con RoleGuard para roles con acceso de consulta a Locales/Zonas
El sistema SHALL registrar la ruta `/admin/locales` en el router con `<RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']}>` — el mismo conjunto de roles para los que `puedeConsultarLocales` retorna `true`. Cualquier otro rol autenticado SHALL ser redirigido a `/no-autorizado` al intentar acceder. La visibilidad de las acciones de crear/editar/desactivar dentro de la página SHALL controlarse con `puedeAdministrarLocales(usuario)`, no con el guard de ruta.

#### Scenario: Usuario ADMINISTRADOR_SISTEMA accede a /admin/locales sin redirección
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_SISTEMA` navega a `/admin/locales`
- **THEN** la página de administración de Locales se renderiza sin redirección a `/no-autorizado`

#### Scenario: Usuario JEFE_CALIDAD_SYST accede a /admin/locales en modo consulta
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/admin/locales`
- **THEN** la página se renderiza sin redirección, pero las acciones de crear/editar/desactivar no son visibles

#### Scenario: Usuario SUPERVISOR es redirigido desde /admin/locales
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/admin/locales`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Usuario no autenticado es redirigido a login desde /admin/locales
- **WHEN** un usuario no autenticado navega a `/admin/locales`
- **THEN** es redirigido a `/login` con `replace: true`

---

### Requirement: Ruta /admin/locales/:id registrada para el detalle de un Local con sus Zonas
El sistema SHALL registrar la ruta `/admin/locales/:id` en el router bajo el mismo `<RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']}>` que `/admin/locales`. La ruta SHALL renderizar la vista de detalle del Local identificado por `:id`, incluyendo el listado de sus Zonas. El parámetro `:id` SHALL estar disponible via `useParams()` dentro de la página. Las acciones de administración (crear/editar/desactivar Zona, editar/desactivar el Local) SHALL controlarse con `puedeAdministrarLocales(usuario)` dentro de la página, no en el guard de ruta.

#### Scenario: Usuario ADMINISTRADOR_SISTEMA accede al detalle de un Local
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_SISTEMA` navega a `/admin/locales/loc-001`
- **THEN** la página de detalle se renderiza con el id `loc-001` disponible via `useParams()`, sin redirección, y con las acciones de administración visibles

#### Scenario: Usuario JEFE_CALIDAD_SYST accede al detalle de un Local en modo consulta
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/admin/locales/loc-001`
- **THEN** la página se renderiza sin redirección, mostrando las Zonas del Local pero sin acciones de administración visibles

#### Scenario: Usuario OPERARIO es redirigido desde /admin/locales/:id
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/admin/locales/loc-001`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Usuario no autenticado es redirigido a login desde /admin/locales/:id
- **WHEN** un usuario no autenticado navega a `/admin/locales/loc-001`
- **THEN** es redirigido a `/login` con `replace: true`
