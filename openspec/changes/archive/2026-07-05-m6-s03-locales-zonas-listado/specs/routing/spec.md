## MODIFIED Requirements

### Requirement: Ruta /admin/locales/:id registrada para redirigir al listado de Locales
El sistema SHALL registrar la ruta `/admin/locales/:id` en el router bajo el mismo `<RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']}>` que `/admin/locales`. La ruta SHALL renderizar un redirect (`<Navigate to="/admin/locales" replace />`) hacia `/admin/locales`, en vez de una vista de detalle separada: el patrón de filas expandibles de `LocalList` (M6-S03) cubre la necesidad de ver un Local con sus Zonas sin una página de detalle dedicada. El guard de rol SHALL evaluarse antes del redirect, de modo que un usuario sin `puedeConsultarLocales` siga siendo redirigido a `/no-autorizado` (o a `/login` si no está autenticado) en vez de a `/admin/locales`.

#### Scenario: Usuario ADMINISTRADOR_SISTEMA es redirigido desde el detalle al listado
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_SISTEMA` navega a `/admin/locales/loc-001`
- **THEN** es redirigido a `/admin/locales` sin pasar por `/no-autorizado`

#### Scenario: Usuario JEFE_CALIDAD_SYST es redirigido desde el detalle al listado
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/admin/locales/loc-001`
- **THEN** es redirigido a `/admin/locales` sin pasar por `/no-autorizado`

#### Scenario: Usuario OPERARIO es redirigido a no-autorizado, no al listado
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/admin/locales/loc-001`
- **THEN** es redirigido a `/no-autorizado`, no a `/admin/locales`

#### Scenario: Usuario no autenticado es redirigido a login desde /admin/locales/:id
- **WHEN** un usuario no autenticado navega a `/admin/locales/loc-001`
- **THEN** es redirigido a `/login` con `replace: true`

## ADDED Requirements

### Requirement: Ruta /admin/locales/new registrada como placeholder para el formulario de creación de Local
El sistema SHALL registrar la ruta `/admin/locales/new` en el router bajo el mismo `<RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']}>` que `/admin/locales`, antes de que el router evalúe el patrón dinámico `/admin/locales/:id` para que `new` no sea tratado como un id. Hasta que M6-S04 implemente `LocalForm`, la ruta SHALL renderizar un componente placeholder con el texto "Próximamente".

#### Scenario: Ruta /admin/locales/new muestra placeholder
- **WHEN** un usuario autenticado con permiso de administración navega a `/admin/locales/new`
- **THEN** se renderiza un componente con indicación de "Próximamente" sin error

#### Scenario: La ruta /admin/locales/new no colisiona con /admin/locales/:id
- **WHEN** el router evalúa la URL `/admin/locales/new`
- **THEN** coincide con la ruta estática `/admin/locales/new` y no con el patrón dinámico `/admin/locales/:id`

---

### Requirement: Ruta /admin/locales/:localId/zonas/new registrada como placeholder para el formulario de creación de Zona
El sistema SHALL registrar la ruta `/admin/locales/:localId/zonas/new` en el router bajo el mismo `<RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']}>` que `/admin/locales`. Hasta que M6-S04 implemente `ZonaForm`, la ruta SHALL renderizar un componente placeholder con el texto "Próximamente". El parámetro `:localId` SHALL estar disponible via `useParams()`.

#### Scenario: Ruta de creación de zona muestra placeholder
- **WHEN** un usuario autenticado con permiso de administración navega a `/admin/locales/loc-001/zonas/new`
- **THEN** se renderiza un componente con indicación de "Próximamente", con `localId` igual a `loc-001` disponible via `useParams()`

#### Scenario: Usuario sin permiso de consulta es redirigido desde la ruta de creación de zona
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/admin/locales/loc-001/zonas/new`
- **THEN** es redirigido a `/no-autorizado`
