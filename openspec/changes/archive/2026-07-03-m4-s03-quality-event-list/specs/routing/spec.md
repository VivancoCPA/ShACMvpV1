## MODIFIED Requirements

### Requirement: Rutas de módulos pendientes muestran placeholder
El sistema SHALL renderizar un placeholder con mensaje "Próximamente" para las rutas de módulos no implementados en el MVP actual. La ruta `/quality-events` DEJA DE ser un placeholder: es reemplazada por la ruta real definida en el requisito `Ruta /quality-events registrada con RoleGuard para todos los roles autenticados`.

#### Scenario: Rutas pendientes muestran estado de construcción
- **WHEN** el usuario navega a `/dashboard`
- **THEN** se renderiza una pantalla de placeholder con indicación de que el módulo está en desarrollo

---

## ADDED Requirements

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
