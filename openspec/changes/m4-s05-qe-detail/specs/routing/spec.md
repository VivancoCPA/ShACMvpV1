## ADDED Requirements

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
