## MODIFIED Requirements

### Requirement: Handler MSW de edición de usuario (RN-USR-006)

`PATCH /api/users/:id` SHALL actualizar `email`, `rol`, `areaId`, `areaIds` y `avatarUrl` (si se envía) del usuario indicado, sin tocar `password` ni `activo`. El handler SHALL validar unicidad de `email` excluyendo al propio usuario editado.

#### Scenario: Edición exitosa actualiza los campos permitidos

- **WHEN** se envía `PATCH /api/users/:id` con un nuevo `rol` y `areaId`
- **THEN** `GET /api/users` refleja los nuevos valores para ese usuario, y su `password`/`activo` permanecen sin cambios

#### Scenario: Edición no invalida referencias históricas de otros dominios

- **WHEN** se edita el `rol` de un usuario que aparece como `responsableInvestigacionId` en un Quality Event existente
- **THEN** el QE existente conserva esa referencia sin error ni revalidación
