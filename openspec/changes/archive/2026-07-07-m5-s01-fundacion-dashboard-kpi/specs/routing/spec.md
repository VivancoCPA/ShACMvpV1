## MODIFIED Requirements

### Requirement: Rutas de módulos pendientes muestran placeholder
El sistema SHALL renderizar un placeholder con mensaje "Próximamente" para las rutas de módulos no implementados en el MVP actual. La ruta `/quality-events` DEJA DE ser un placeholder: es reemplazada por la ruta real definida en el requisito `Ruta /quality-events registrada con RoleGuard para todos los roles autenticados`. La ruta `/dashboard` SHALL seguir renderizando el placeholder "Próximamente" en este change (la UI real llega en S02-S08), pero DEJA DE carecer de guard de rol: queda protegida por el `RoleGuard` definido en el requisito `Ruta /dashboard registrada con RoleGuard para los 6 roles de dominio` de este mismo spec.

#### Scenario: Rutas pendientes muestran estado de construcción
- **WHEN** un usuario autenticado con un rol permitido navega a `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

---

## ADDED Requirements

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
