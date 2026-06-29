## ADDED Requirements

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
