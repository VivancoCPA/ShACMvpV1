# routing

## MODIFIED Requirements

### Requirement: Rutas de módulos pendientes muestran placeholder
El sistema SHALL renderizar un placeholder con mensaje "Próximamente" para las rutas de módulos no implementados en el MVP actual.

#### Scenario: Rutas pendientes muestran estado de construcción
- **WHEN** el usuario navega a `/incidentes`, `/quality-events`, `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

---

## ADDED Requirements

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

#### Scenario: Ruta raíz redirige a /nonconformities o /documents
- **WHEN** el usuario autenticado navega a `/`
- **THEN** es redirigido automáticamente a `/documents` (sin cambio en el redirect por defecto)
