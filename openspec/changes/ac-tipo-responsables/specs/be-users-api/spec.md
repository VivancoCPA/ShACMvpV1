## ADDED Requirements

### Requirement: GET /api/users sigue restringido a administradores; selectores operativos usan endpoints dedicados
`GET /api/users` MUST seguir restringido a ADMINISTRADOR_EMPRESA y SUPERADMIN (403 para cualquier rol operativo). Los selectores de usuarios de módulos operativos SHALL usar `GET /api/users/candidatos?roles=…` (selección) o `GET /api/users/nombres` (display), y la selección de responsable de AC SHALL usar `GET /api/acciones-correctivas/candidatos-responsable`.

#### Scenario: JCA llama GET /api/users
- **WHEN** un JEFE_CALIDAD_SYST llama `GET /api/users`
- **THEN** la respuesta es 403
