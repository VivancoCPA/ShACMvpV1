# routing

## ADDED Requirements

### Requirement: Ruta /nonconformities/:id registrada para NonconformityDetailPage
El sistema SHALL registrar la ruta `/nonconformities/:id` en el router con `<RoleGuard>` que permita el acceso a todos los roles autenticados. La ruta SHALL renderizar `NonconformityDetailPage` de `src/features/nonconformities/pages/NonconformityDetailPage.tsx`. El parámetro `:id` SHALL estar disponible via `useParams()` dentro de la página.

#### Scenario: Usuario autenticado con cualquier rol accede al detalle de NC
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/nonconformities/nc-001`
- **THEN** `NonconformityDetailPage` se renderiza con el id `nc-001` disponible via `useParams()`

#### Scenario: Ruta inexistente dentro de nonconformities cae al NotFoundPage
- **WHEN** un usuario navega a `/nonconformities/` sin un id válido
- **THEN** se renderiza `NotFoundPage` o se redirige a `/nonconformities`

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
