# Spec: routing

## Purpose

Define the React Router v6 structure with public and protected routes, the RoleGuard component, placeholder routes for pending modules, and the `/no-autorizado` page.

---

## Requirements

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
El sistema SHALL renderizar un placeholder con mensaje "Próximamente" para las rutas de módulos no implementados en el MVP actual. La ruta `/quality-events` DEJA DE ser un placeholder: es reemplazada por la ruta real definida en el requisito `Ruta /quality-events registrada con RoleGuard para todos los roles autenticados`. La ruta `/dashboard` SHALL renderizar `DashboardPage`, que a su vez muestra la vista real `OperarioDashboard` cuando el usuario autenticado tiene rol `OPERARIO`, y la vista real `SupervisorDashboard` cuando tiene rol `SUPERVISOR`; para los otros 4 roles de dominio (`JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`) SHALL seguir renderizando el placeholder "Próximamente" hasta sus specs correspondientes (S05-S07). La ruta `/dashboard` queda protegida por el `RoleGuard` definido en el requisito `Ruta /dashboard registrada con RoleGuard para los 6 roles de dominio` de este mismo spec.

#### Scenario: Rutas pendientes muestran estado de construcción
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

#### Scenario: OPERARIO ya no ve el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/dashboard`
- **THEN** se renderiza `OperarioDashboard`, no el placeholder "Próximamente"

#### Scenario: SUPERVISOR ya no ve el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/dashboard`
- **THEN** se renderiza `SupervisorDashboard`, no el placeholder "Próximamente"

---

### Requirement: Ruta /dashboard registrada con RoleGuard para los 6 roles de dominio
El sistema SHALL registrar la ruta `/dashboard` en el router con `<RoleGuard requiredRoles={['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']}>`. El rol `ADMINISTRADOR_SISTEMA` SHALL ser redirigido a `/no-autorizado` al intentar acceder a `/dashboard`, dado que es un rol de sistema puro sin acceso a ningún módulo operativo (M1-M5).

#### Scenario: Usuario OPERARIO accede a /dashboard sin redirección
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/dashboard`
- **THEN** la ruta se renderiza sin redirección a `/no-autorizado`

#### Scenario: Usuario SUPERVISOR accede a /dashboard sin redirección
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/dashboard`
- **THEN** la ruta se renderiza sin redirección

#### Scenario: Usuario JEFE_CALIDAD_SYST accede a /dashboard sin redirección
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/dashboard`
- **THEN** la ruta se renderiza sin redirección

#### Scenario: Usuario JEFE_CONTROL_DOCUMENTARIO accede a /dashboard sin redirección
- **WHEN** un usuario autenticado con rol `JEFE_CONTROL_DOCUMENTARIO` navega a `/dashboard`
- **THEN** la ruta se renderiza sin redirección

#### Scenario: Usuario AUDITOR_INTERNO accede a /dashboard sin redirección
- **WHEN** un usuario autenticado con rol `AUDITOR_INTERNO` navega a `/dashboard`
- **THEN** la ruta se renderiza sin redirección

#### Scenario: Usuario ALTA_DIRECCION accede a /dashboard sin redirección
- **WHEN** un usuario autenticado con rol `ALTA_DIRECCION` navega a `/dashboard`
- **THEN** la ruta se renderiza sin redirección

#### Scenario: Usuario ADMINISTRADOR_SISTEMA es redirigido desde /dashboard
- **WHEN** un usuario autenticado con rol `ADMINISTRADOR_SISTEMA` navega a `/dashboard`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Usuario no autenticado es redirigido a login desde /dashboard
- **WHEN** un usuario no autenticado navega a `/dashboard`
- **THEN** es redirigido a `/login` con `replace: true`

---

### Requirement: Ruta /nonconformities registrada con RoleGuard para todos los roles autenticados
El sistema SHALL registrar la ruta `/nonconformities` en el router con `<RoleGuard>` que permita el acceso a todos los roles autenticados (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`). La ruta SHALL renderizar `NonconformityListPage` de `src/features/nonconformities/pages/NonconformityListPage.tsx`. El filtrado de NCs por rol OPERARIO SHALL aplicarse en el handler MSW, no en el guard de ruta.

#### Scenario: Usuario OPERARIO accede a /nonconformities sin redirección
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/nonconformities`
- **THEN** `NonconformityListPage` se renderiza sin redirección a `/no-autorizado`

#### Scenario: Usuario JEFE_CALIDAD_SYST accede a /nonconformities sin redirección
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/nonconformities`
- **THEN** `NonconformityListPage` se renderiza sin redirección

#### Scenario: Usuario no autenticado es redirigido a login desde /nonconformities
- **WHEN** un usuario no autenticado navega a `/nonconformities`
- **THEN** es redirigido a `/login` con `replace: true`

---

### Requirement: Ruta `/no-autorizado` muestra página de acceso denegado
El sistema SHALL tener una ruta `/no-autorizado` que renderice `UnauthorizedPage` accesible para cualquier usuario autenticado.

#### Scenario: Página de no autorizado es visible para usuarios autenticados
- **WHEN** un usuario autenticado es redirigido a `/no-autorizado`
- **THEN** `UnauthorizedPage` se renderiza con mensaje de acceso denegado y link para volver

---

### Requirement: Ruta /nonconformities/:id registrada para NonconformityDetailPage
El sistema SHALL registrar la ruta `/nonconformities/:id` en el router con `<RoleGuard>` que permita el acceso a todos los roles autenticados. La ruta SHALL renderizar `NonconformityDetailPage` de `src/features/nonconformities/pages/NonconformityDetailPage.tsx`. El parámetro `:id` SHALL estar disponible via `useParams()` dentro de la página.

#### Scenario: Usuario autenticado con cualquier rol accede al detalle de NC
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/nonconformities/nc-001`
- **THEN** `NonconformityDetailPage` se renderiza con el id `nc-001` disponible via `useParams()`

#### Scenario: Ruta inexistente dentro de nonconformities cae al NotFoundPage
- **WHEN** un usuario navega a `/nonconformities/` sin un id válido
- **THEN** se renderiza `NotFoundPage` o se redirige a `/nonconformities`

---

### Requirement: Ruta /nonconformities/new registrada con RoleGuard para roles con permiso de creación
El sistema SHALL registrar la ruta `/nonconformities/new` en el router con `<RoleGuard requiredRoles={['SUPERVISOR', 'JEFE_CALIDAD_SYST']}>`. La ruta SHALL renderizar `NonconformityNewPage` de `src/features/nonconformities/pages/NonconformityNewPage.tsx` o el formulario de creación directamente.

#### Scenario: Usuario SUPERVISOR accede a /nonconformities/new
- **WHEN** un usuario con rol `SUPERVISOR` navega a `/nonconformities/new`
- **THEN** el formulario de creación de NC se renderiza sin redirección

#### Scenario: Usuario OPERARIO es redirigido desde /nonconformities/new
- **WHEN** un usuario con rol `OPERARIO` navega a `/nonconformities/new`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: La ruta /nonconformities/new no colisiona con /nonconformities/:id
- **WHEN** el router evalúa la URL `/nonconformities/new`
- **THEN** coincide con la ruta estática `/nonconformities/new` y no con el patrón dinámico `/nonconformities/:id`

---

### Requirement: Ruta /incidents registrada con RoleGuard para roles autorizados de M3
El sistema SHALL registrar la ruta `/incidents` en el router con `<RoleGuard requiredRoles={['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO', 'ALTA_DIRECCION']}>`. La ruta SHALL renderizar `IncidentListPage` de `src/features/incidents/pages/IncidentListPage.tsx`. El rol `JEFE_CONTROL_DOCUMENTARIO` SHALL ser redirigido a `/no-autorizado` al intentar acceder a esta ruta.

#### Scenario: Usuario OPERARIO accede a /incidents sin redirección
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/incidents`
- **THEN** `IncidentListPage` se renderiza sin redirección a `/no-autorizado`

#### Scenario: Usuario JEFE_CALIDAD_SYST accede a /incidents sin redirección
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/incidents`
- **THEN** `IncidentListPage` se renderiza sin redirección

#### Scenario: Usuario JEFE_CONTROL_DOCUMENTARIO es redirigido desde /incidents
- **WHEN** un usuario autenticado con rol `JEFE_CONTROL_DOCUMENTARIO` navega a `/incidents`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: Usuario no autenticado es redirigido a login desde /incidents
- **WHEN** un usuario no autenticado navega a `/incidents`
- **THEN** es redirigido a `/login` con `replace: true`

---

### Requirement: Ruta /quality-events registrada con RoleGuard para todos los roles autenticados
El sistema SHALL registrar la ruta `/quality-events` en el router con `<RoleGuard>` que permita el acceso a todos los roles autenticados (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`). La ruta SHALL renderizar `QualityEventListPage` de `src/features/quality-events/pages/QualityEventListPage.tsx`. El control de visibilidad del botón "Nuevo QE" SHALL aplicarse dentro del componente, no en el guard de ruta.

#### Scenario: Todos los roles autenticados pueden acceder a /quality-events
- **WHEN** un usuario autenticado con cualquier rol navega a `/quality-events`
- **THEN** `QualityEventListPage` se renderiza sin redirección

#### Scenario: Usuario no autenticado es redirigido a login desde /quality-events
- **WHEN** un usuario no autenticado navega a `/quality-events`
- **THEN** es redirigido a `/login` por el `RoleGuard`

#### Scenario: /quality-events ya no muestra el placeholder de "Próximamente"
- **WHEN** un usuario autenticado navega a `/quality-events`
- **THEN** se renderiza `QualityEventListPage` con la tabla paginada, no el componente de placeholder

---

### Requirement: Ruta /quality-events/nuevo registrada con RoleGuard para roles de creación de QE
El sistema SHALL registrar la ruta `/quality-events/nuevo` en el router como ruta estática hija del segmento `quality-events`, con `<RoleGuard requiredRoles={['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST']}>`. La ruta SHALL renderizar `QualityEventForm` de `src/features/quality-events/pages/QualityEventForm.tsx`. La ruta `/quality-events/nuevo` SHALL registrarse antes de cualquier patrón dinámico `/quality-events/:id` para que `nuevo` no sea tratado como un parámetro dinámico.

#### Scenario: Usuario OPERARIO accede a /quality-events/nuevo sin redirección
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/quality-events/nuevo`
- **THEN** `QualityEventForm` se renderiza sin redirección a `/no-autorizado`

#### Scenario: Usuario SUPERVISOR accede a /quality-events/nuevo sin redirección
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/quality-events/nuevo`
- **THEN** `QualityEventForm` se renderiza sin redirección

#### Scenario: Usuario JEFE_CALIDAD_SYST accede a /quality-events/nuevo sin redirección
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/quality-events/nuevo`
- **THEN** `QualityEventForm` se renderiza sin redirección

#### Scenario: Usuario AUDITOR_INTERNO es redirigido desde /quality-events/nuevo
- **WHEN** un usuario autenticado con rol `AUDITOR_INTERNO` navega a `/quality-events/nuevo`
- **THEN** es redirigido a `/no-autorizado`

#### Scenario: La ruta /quality-events/nuevo no colisiona con /quality-events/:id
- **WHEN** el router evalúa la URL `/quality-events/nuevo`
- **THEN** coincide con la ruta estática `/quality-events/nuevo` y no con el patrón dinámico `/quality-events/:id`

---

### Requirement: Ruta /quality-events/:id registrada para QualityEventDetail
El sistema SHALL registrar la ruta `/quality-events/:id` en el router como ruta hija dinámica del segmento `quality-events`, con `<RoleGuard>` que permita el acceso a todos los roles autenticados (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`). La ruta SHALL renderizar `QualityEventDetail` de `src/features/quality-events/pages/QualityEventDetail.tsx`. El parámetro `:id` SHALL estar disponible via `useParams()` dentro de la página. La ruta `/quality-events/:id` SHALL registrarse después de `/quality-events/nuevo` para que `nuevo` no sea tratado como un parámetro dinámico. La visibilidad de las acciones de edición dentro del detalle SHALL controlarse por sección, no por el guard de ruta.

#### Scenario: Todos los roles autenticados acceden al detalle de QE
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/quality-events/qe-2026-001`
- **THEN** `QualityEventDetail` se renderiza con el id `qe-2026-001` disponible via `useParams()`, sin redirección

#### Scenario: Usuario no autenticado es redirigido a login desde el detalle de QE
- **WHEN** un usuario no autenticado navega a `/quality-events/qe-2026-001`
- **THEN** es redirigido a `/login` con `replace: true`

#### Scenario: La ruta /quality-events/nuevo no colisiona con /quality-events/:id
- **WHEN** el router evalúa la URL `/quality-events/nuevo`
- **THEN** coincide con la ruta estática `/quality-events/nuevo` y no con el patrón dinámico `/quality-events/:id`

#### Scenario: Id inexistente muestra el estado 404 dentro de la página
- **WHEN** un usuario autenticado navega a `/quality-events/id-inexistente`
- **THEN** la ruta se renderiza (sin redirección de router) y `QualityEventDetail` maneja el 404 mostrando su propio estado de "no encontrado"

---

### Requirement: Rutas placeholder /incidents/nuevo e /incidents/:id registradas
El sistema SHALL registrar las rutas `/incidents/nuevo` e `/incidents/:id` en el router bajo el mismo `RoleGuard` que `/incidents`. Ambas rutas SHALL renderizar un componente placeholder mínimo con el texto "Próximamente" hasta que M3-S04 las implemente. La ruta `/incidents/nuevo` SHALL registrarse antes de `/incidents/:id` para evitar que el path `nuevo` sea tratado como un parámetro dinámico.

#### Scenario: Ruta /incidents/nuevo muestra placeholder
- **WHEN** un usuario autenticado navega a `/incidents/nuevo`
- **THEN** se renderiza un componente con indicación de "Próximamente" sin error

#### Scenario: Ruta /incidents/:id muestra placeholder
- **WHEN** un usuario autenticado navega a `/incidents/inc-001`
- **THEN** se renderiza un componente con indicación de "Próximamente" sin error

#### Scenario: La ruta /incidents/nuevo no colisiona con /incidents/:id
- **WHEN** el router evalúa la URL `/incidents/nuevo`
- **THEN** coincide con la ruta estática `/incidents/nuevo` y no con el patrón dinámico `/incidents/:id`

---

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

---

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
