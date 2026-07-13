## MODIFIED Requirements

### Requirement: Rutas de módulos pendientes muestran placeholder
El sistema SHALL renderizar un placeholder con mensaje "Próximamente" para las rutas de módulos no implementados en el MVP actual. La ruta `/quality-events` DEJA DE ser un placeholder: es reemplazada por la ruta real definida en el requisito `Ruta /quality-events registrada con RoleGuard para todos los roles autenticados`. La ruta `/dashboard` SHALL renderizar `DashboardPage`, que a su vez muestra la vista real `OperarioDashboard` únicamente cuando el usuario autenticado tiene rol `OPERARIO`; para los otros 5 roles de dominio (`SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`) SHALL seguir renderizando el placeholder "Próximamente" hasta sus specs correspondientes (S04-S07). La ruta `/dashboard` queda protegida por el `RoleGuard` definido en el requisito `Ruta /dashboard registrada con RoleGuard para los 6 roles de dominio` de este mismo spec.

#### Scenario: Rutas pendientes muestran estado de construcción
- **WHEN** un usuario autenticado con rol `SUPERVISOR` navega a `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

#### Scenario: OPERARIO ya no ve el placeholder en /dashboard
- **WHEN** un usuario autenticado con rol `OPERARIO` navega a `/dashboard`
- **THEN** se renderiza `OperarioDashboard`, no el placeholder "Próximamente"
