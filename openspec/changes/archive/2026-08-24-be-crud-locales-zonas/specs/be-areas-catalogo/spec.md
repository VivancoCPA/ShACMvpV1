## REMOVED Requirements

### Requirement: Sin mutaciones de Áreas en este alcance
**Reason**: Este cambio (`be-crud-locales-zonas`) construye el CRUD administrativo completo de Áreas, reemplazando el solo-lectura anterior.
**Migration**: Ver los requirements `ADDED` de este mismo delta — creación, edición, desactivación (con validación de referencias cruzadas) y reactivación de Área ya están implementadas y disponibles.

## ADDED Requirements

### Requirement: Creación de Área (RN-ARE-002)
El sistema SHALL exponer `POST /api/areas`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, creando un Área con `activo: true` en la empresa activa de la sesión. No SHALL aplicar ningún límite de cantidad de Áreas activas (a diferencia de Local).

#### Scenario: Creación exitosa
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `POST /api/areas` con `{ nombre, descripcion? }` válidos
- **THEN** el sistema responde `201` con el Área creada, `activo: true`, `empresaId` tomado de la sesión (nunca del body)

#### Scenario: Sin límite de cantidad
- **WHEN** la empresa activa ya tiene un número arbitrariamente alto de Áreas activas
- **THEN** `POST /api/areas` sigue respondiendo `201` — no existe ninguna validación de cupo máximo para Área

### Requirement: Unicidad de nombre de Área dentro de la empresa (RN-ARE-004)
El sistema SHALL validar, en creación y edición, que `nombre` (comparado case-insensitive, sin espacios al inicio/fin) no colisione con otra Área de la misma empresa activa. En edición, la comparación SHALL excluir el propio registro.

#### Scenario: Nombre duplicado en creación
- **WHEN** `POST /api/areas` envía un `nombre` que ya existe (case-insensitive) en otra Área de la misma empresa
- **THEN** el sistema responde `409` sin crear el registro

#### Scenario: Nombre duplicado en edición
- **WHEN** `PATCH /api/areas/:id` cambia `nombre` a un valor que ya existe en otra Área de la misma empresa
- **THEN** el sistema responde `409` sin aplicar el cambio

#### Scenario: Edición sin cambiar el nombre no dispara la validación contra sí misma
- **WHEN** `PATCH /api/areas/:id` envía el mismo `nombre` que el Área ya tiene
- **THEN** el sistema responde `200`, sin considerarlo una colisión consigo misma

### Requirement: Edición de Área
El sistema SHALL exponer `PATCH /api/areas/:id`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, actualizando parcialmente `nombre`/`descripcion` de un Área de la empresa activa.

#### Scenario: Edición exitosa
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `PATCH /api/areas/:id` con `{ nombre?, descripcion? }` sobre un Área existente en su empresa activa
- **THEN** el sistema responde `200` con el Área actualizada

#### Scenario: Área inexistente o de otra empresa
- **WHEN** `PATCH /api/areas/:id` se envía con un `id` que no existe en la empresa activa (no existe en absoluto, o pertenece a otra empresa)
- **THEN** el sistema responde `404`, sin distinguir entre ambos casos

### Requirement: Desactivación de Área con validación de referencias cruzadas (RN-ARE-001)
El sistema SHALL exponer `PATCH /api/areas/:id/desactivar`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`. Antes de desactivar, SHALL contar, dentro de la misma empresa del Área, cuántos Quality Events, No Conformidades e Incidentes referencian ese `AreaId` y están en un estado no-terminal:
- Quality Event no-terminal: `ABIERTO, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE, EN_VERIFICACION`
- No Conformidad no-terminal: `ABIERTA, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE`
- Incidente no-terminal: `ABIERTO, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE`

Si el total es mayor a cero, SHALL responder `409` sin desactivar, con el desglose `{ conteo: { qe, nc, incidentes, total } }`. Si es cero, SHALL marcar `activo: false` y responder `200`.

#### Scenario: Desactivación bloqueada por QE activo
- **WHEN** un Área tiene al menos un Quality Event en estado no-terminal referenciándola (misma empresa)
- **THEN** `PATCH /api/areas/:id/desactivar` responde `409` con `conteo.qe >= 1` y `conteo.total >= 1`, y el Área permanece `activo: true`

#### Scenario: Desactivación bloqueada combinando varios dominios
- **WHEN** un Área tiene registros no-terminales en más de un dominio (p. ej. 1 NC y 2 Incidentes)
- **THEN** el sistema responde `409` con `conteo` reflejando cada dominio por separado y `conteo.total` igual a la suma

#### Scenario: Desactivación exitosa sin referencias activas
- **WHEN** un Área no tiene ningún QE/NC/Incidente en estado no-terminal referenciándola
- **THEN** el sistema responde `200` con `activo: false`

#### Scenario: Aislamiento multi-tenant en el conteo de bloqueo
- **WHEN** existe un Quality Event en estado no-terminal con el mismo código `AreaId` pero perteneciente a otra empresa
- **THEN** ese Quality Event NO SHALL contarse en `conteo.qe` — el conteo se filtra también por `EmpresaId` del Área, no solo por `AreaId`

### Requirement: Reactivación de Área
El sistema SHALL exponer `PATCH /api/areas/:id/reactivar`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, marcando `activo: true` sin ninguna validación de cupo (a diferencia de Local, ver `be-locales-zonas-lectura`).

#### Scenario: Reactivación exitosa
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `PATCH /api/areas/:id/reactivar` sobre un Área inactiva de su empresa
- **THEN** el sistema responde `200` con `activo: true`, sin ninguna validación adicional

### Requirement: Mutaciones de Área restringidas a ADMINISTRADOR_SISTEMA y JEFE_CALIDAD_SYST
El sistema SHALL rechazar `POST /api/areas`, `PATCH /api/areas/:id`, `PATCH /api/areas/:id/desactivar` y `PATCH /api/areas/:id/reactivar` para cualquier usuario autenticado cuyo rol efectivo no sea `ADMINISTRADOR_SISTEMA` ni `JEFE_CALIDAD_SYST` (decisión de Toño, 2026-08-24 — ambos roles pueden administrar, ninguno reemplaza al otro).

#### Scenario: Rol sin permiso de administración intenta crear un Área
- **WHEN** un usuario autenticado con rol distinto de `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST` (p. ej. `OPERARIO`) envía `POST /api/areas`
- **THEN** el sistema responde `403`, sin crear el registro

#### Scenario: JEFE_CALIDAD_SYST puede administrar Áreas
- **WHEN** un usuario `JEFE_CALIDAD_SYST` envía `POST /api/areas`, `PATCH /api/areas/:id`, `PATCH /api/areas/:id/desactivar` o `PATCH /api/areas/:id/reactivar`
- **THEN** el sistema procesa la mutación igual que si el usuario fuera `ADMINISTRADOR_SISTEMA`

#### Scenario: Los endpoints de lectura no cambian su restricción de rol
- **WHEN** cualquier usuario autenticado (independientemente de su rol) solicita `GET /api/areas` o `GET /api/areas/:id`
- **THEN** el sistema responde `200` igual que antes de este cambio — la restricción de rol aplica únicamente a las mutaciones
