## ADDED Requirements

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
