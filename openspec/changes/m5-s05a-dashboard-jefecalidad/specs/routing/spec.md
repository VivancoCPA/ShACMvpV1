## MODIFIED Requirements

### Requirement: Rutas de módulos pendientes muestran placeholder
El sistema SHALL renderizar un placeholder con mensaje "Próximamente" para las rutas de módulos no implementados en el MVP actual. La ruta `/quality-events` DEJA DE ser un placeholder: es reemplazada por la ruta real definida en el requisito `Ruta /quality-events registrada con RoleGuard para todos los roles autenticados`. La ruta `/dashboard` SHALL renderizar `DashboardPage`, que a su vez muestra la vista real `OperarioDashboard` cuando el usuario autenticado tiene rol `OPERARIO`, la vista real `SupervisorDashboard` cuando tiene rol `SUPERVISOR`, y la vista real `JefeCalidadDashboard` cuando tiene rol `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`; para los 2 roles restantes (`AUDITOR_INTERNO`, `ALTA_DIRECCION`) SHALL seguir renderizando el placeholder "Próximamente" hasta sus specs correspondientes (S06-S07). La ruta `/dashboard` queda protegida por el `RoleGuard` definido en el requisito `Ruta /dashboard registrada con RoleGuard para los 6 roles de dominio` de este mismo spec.

#### Scenario: Rutas pendientes muestran estado de construcción
- **WHEN** un usuario autenticado con rol `AUDITOR_INTERNO` navega a `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

#### Scenario: OPERARIO ya no ve el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/dashboard`
- **THEN** se renderiza `OperarioDashboard`, no el placeholder "Próximamente"

#### Scenario: SUPERVISOR ya no ve el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/dashboard`
- **THEN** se renderiza `SupervisorDashboard`, no el placeholder "Próximamente"

#### Scenario: JEFE_CALIDAD_SYST ya no ve el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/dashboard`
- **THEN** se renderiza `JefeCalidadDashboard`, no el placeholder "Próximamente"

#### Scenario: JEFE_CONTROL_DOCUMENTARIO ya no ve el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `JEFE_CONTROL_DOCUMENTARIO` navega a `/dashboard`
- **THEN** se renderiza `JefeCalidadDashboard`, no el placeholder "Próximamente"

#### Scenario: ALTA_DIRECCION sigue viendo el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `ALTA_DIRECCION` navega a `/dashboard`
- **THEN** se renderiza el placeholder "Próximamente", no un dashboard real
