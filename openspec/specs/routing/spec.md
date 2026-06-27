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
- **WHEN** el usuario navega a `/incidentes`, `/quality-events`, `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

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
