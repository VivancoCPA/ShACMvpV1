## REMOVED Requirements

### Requirement: Sin mutaciones de Locales/Zonas en este alcance
**Reason**: Este cambio (`be-crud-locales-zonas`) construye el CRUD administrativo completo de Locales y Zonas, reemplazando el solo-lectura anterior.
**Migration**: Ver los requirements `ADDED` de este mismo delta — creación, edición, desactivación, reactivación y upload de plano PNG ya están implementados y disponibles.

## ADDED Requirements

### Requirement: Creación de Local con límite de cupo activo (RN-LOC-001)
El sistema SHALL exponer `POST /api/locales`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, aceptando `Content-Type: application/json` o `multipart/form-data` (este último cuando incluye el archivo `planoUrl`). SHALL rechazar la creación si la empresa activa ya tiene 5 Locales activos.

#### Scenario: Creación exitosa sin plano (JSON)
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `POST /api/locales` como JSON con `{ nombre, direccion }` y la empresa activa tiene menos de 5 Locales activos
- **THEN** el sistema responde `201` con el Local creado, `activo: true`, `codigo` autogenerado (`LOC-NNN`), `empresaId` tomado de la sesión

#### Scenario: Creación exitosa con plano (multipart)
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `POST /api/locales` como `multipart/form-data` con `nombre`, `direccion` y un archivo `planoUrl` PNG válido de menos de 2MB
- **THEN** el sistema responde `201` con `planoPngUrl` apuntando al archivo almacenado

#### Scenario: Cupo de 5 Locales activos alcanzado
- **WHEN** la empresa activa ya tiene 5 Locales activos y se envía `POST /api/locales`
- **THEN** el sistema responde `400` sin crear el registro

#### Scenario: El cupo es por empresa, no global
- **WHEN** otra empresa distinta ya tiene 5 Locales activos, pero la empresa activa de la sesión tiene menos de 5
- **THEN** `POST /api/locales` responde `201` normalmente — el cupo de la otra empresa no afecta

### Requirement: Validación de plano PNG (RN-LOC-003)
El sistema SHALL validar, en creación y edición de Local, que el archivo `planoUrl` (cuando se envía) tenga `Content-Type: image/png` exacto y tamaño menor o igual a 2MB, antes de aceptarlo.

#### Scenario: Archivo con tipo incorrecto
- **WHEN** el archivo `planoUrl` enviado no tiene `Content-Type: image/png`
- **THEN** el sistema responde `400` sin crear/actualizar el registro

#### Scenario: Archivo que excede el tamaño máximo
- **WHEN** el archivo `planoUrl` enviado supera 2MB
- **THEN** el sistema responde `400` sin crear/actualizar el registro

#### Scenario: Archivo válido reemplaza el plano existente en edición
- **WHEN** `PATCH /api/locales/:id` se envía como multipart con un nuevo `planoUrl` PNG válido sobre un Local que ya tenía un plano
- **THEN** el sistema responde `200` con `planoPngUrl` apuntando al archivo nuevo

### Requirement: Edición de Local
El sistema SHALL exponer `PATCH /api/locales/:id`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, actualizando `nombre`/`direccion` (parcial) y, si el request es multipart con archivo nuevo, `planoPngUrl` (sujeto a RN-LOC-003). `empresaId` SHALL NOT ser modificable por este endpoint bajo ninguna circunstancia.

#### Scenario: Edición exitosa de campos de texto
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `PATCH /api/locales/:id` con `{ nombre?, direccion? }` sobre un Local de su empresa activa
- **THEN** el sistema responde `200` con el Local actualizado

#### Scenario: Local inexistente o de otra empresa
- **WHEN** `PATCH /api/locales/:id` se envía con un `id` que no existe en la empresa activa
- **THEN** el sistema responde `404`

#### Scenario: Intento de modificar empresaId es ignorado
- **WHEN** el body de `PATCH /api/locales/:id` incluye un campo `empresaId` distinto al de la empresa activa de la sesión
- **THEN** el sistema ignora ese campo — el Local conserva su `empresaId` original

### Requirement: Desactivación de Local con validación de Incidentes (RN-LOC-002)
El sistema SHALL exponer `PATCH /api/locales/:id/desactivar`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`. SHALL contar, dentro de la misma empresa del Local, cuántos Incidentes referencian ese `LocalId` y están en estado `ABIERTO` o `EN_INVESTIGACION`. Si el conteo es mayor a cero, SHALL responder `409` sin desactivar; si es cero, SHALL marcar `activo: false` y responder `200`.

#### Scenario: Desactivación bloqueada por Incidente activo
- **WHEN** un Local tiene al menos un Incidente en estado `ABIERTO` o `EN_INVESTIGACION` asociado
- **THEN** `PATCH /api/locales/:id/desactivar` responde `409` sin desactivar

#### Scenario: Desactivación exitosa sin Incidentes bloqueantes
- **WHEN** un Local no tiene ningún Incidente en `ABIERTO`/`EN_INVESTIGACION` asociado (puede tener Incidentes en otros estados)
- **THEN** el sistema responde `200` con `activo: false`

### Requirement: Reactivación de Local revalida el cupo (RN-LOC-001)
El sistema SHALL exponer `PATCH /api/locales/:id/reactivar`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`. SHALL rechazar la reactivación si la empresa activa ya tiene 5 Locales activos (el cupo aplica también a reactivación, no solo a creación).

#### Scenario: Reactivación bloqueada por cupo
- **WHEN** la empresa activa ya tiene 5 Locales activos y se intenta reactivar un sexto Local inactivo
- **THEN** el sistema responde `400` sin reactivar

#### Scenario: Reactivación exitosa bajo el cupo
- **WHEN** la empresa activa tiene menos de 5 Locales activos
- **THEN** `PATCH /api/locales/:id/reactivar` responde `200` con `activo: true`

### Requirement: Creación de Zona sin límite de cantidad (RN-ZON-003)
El sistema SHALL exponer `POST /api/locales/:id/zonas`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, creando una Zona asociada al Local de la ruta. `EmpresaId` de la Zona SHALL heredarse del Local, nunca del body. No SHALL aplicar ningún límite de cantidad de Zonas por Local.

#### Scenario: Creación exitosa
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `POST /api/locales/:id/zonas` con `{ nombre, descripcion? }` sobre un Local existente en su empresa activa
- **THEN** el sistema responde `201` con la Zona creada, `codigo` autogenerado (`ZON-NNN`), `localId` igual al de la ruta, `empresaId` igual al del Local

#### Scenario: Local de la ruta inexistente o de otra empresa
- **WHEN** `POST /api/locales/:id/zonas` se envía con un `:id` de Local que no existe en la empresa activa
- **THEN** el sistema responde `404`, sin crear la Zona

#### Scenario: Sin límite de cantidad
- **WHEN** un Local ya tiene un número arbitrariamente alto de Zonas
- **THEN** `POST /api/locales/:id/zonas` sigue respondiendo `201`

### Requirement: Edición de Zona
El sistema SHALL exponer `PATCH /api/zonas/:id`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, actualizando `nombre`/`descripcion` (parcial) de una Zona de la empresa activa.

#### Scenario: Edición exitosa
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `PATCH /api/zonas/:id` con `{ nombre?, descripcion? }` sobre una Zona existente en su empresa activa
- **THEN** el sistema responde `200` con la Zona actualizada

#### Scenario: Zona inexistente o de otra empresa
- **WHEN** `PATCH /api/zonas/:id` se envía con un `id` que no existe en la empresa activa
- **THEN** el sistema responde `404`

### Requirement: Desactivación de Zona con validación de Incidentes (RN-ZON-002)
El sistema SHALL exponer `PATCH /api/zonas/:id/desactivar`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`. SHALL contar, dentro de la misma empresa de la Zona, cuántos Incidentes referencian ese `ZonaId` y están en estado `ABIERTO`, `EN_INVESTIGACION` o `EN_EJECUCION` (superset del conjunto bloqueante de Local — agrega `EN_EJECUCION`). Si el conteo es mayor a cero, SHALL responder `409` sin desactivar; si es cero, SHALL marcar `activo: false` y responder `200`.

#### Scenario: Desactivación bloqueada por Incidente en ejecución
- **WHEN** una Zona tiene al menos un Incidente en estado `EN_EJECUCION` asociado (estado que NO bloquea a Local, pero SÍ a Zona)
- **THEN** `PATCH /api/zonas/:id/desactivar` responde `409` sin desactivar

#### Scenario: Desactivación exitosa sin Incidentes bloqueantes
- **WHEN** una Zona no tiene ningún Incidente en `ABIERTO`/`EN_INVESTIGACION`/`EN_EJECUCION` asociado
- **THEN** el sistema responde `200` con `activo: false`

### Requirement: Reactivación de Zona
El sistema SHALL exponer `PATCH /api/zonas/:id/reactivar`, restringido a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST`, marcando `activo: true` sin ninguna validación de cupo.

#### Scenario: Reactivación exitosa
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` envía `PATCH /api/zonas/:id/reactivar` sobre una Zona inactiva de su empresa
- **THEN** el sistema responde `200` con `activo: true`

### Requirement: Códigos correlativos atómicos de Local y Zona
El sistema SHALL generar `Local.Codigo` (`LOC-NNN`) y `Zona.Codigo` (`ZON-NNN`) mediante un contador atómico por empresa (reutilizando `EmpresaSecuencia`), no mediante conteo de filas existentes. `Codigo` SHALL ser único dentro de `(EmpresaId, Codigo)`.

#### Scenario: Creación concurrente de Locales no genera códigos duplicados
- **WHEN** dos requests de `POST /api/locales` para la misma empresa se procesan concurrentemente
- **THEN** cada Local resultante recibe un `Codigo` distinto, sin colisión

### Requirement: Mutaciones de Local/Zona restringidas a ADMINISTRADOR_SISTEMA y JEFE_CALIDAD_SYST
El sistema SHALL rechazar toda mutación de Local o Zona (`POST /api/locales`, `PATCH /api/locales/:id`, `PATCH /api/locales/:id/desactivar`, `PATCH /api/locales/:id/reactivar`, `POST /api/locales/:id/zonas`, `PATCH /api/zonas/:id`, `PATCH /api/zonas/:id/desactivar`, `PATCH /api/zonas/:id/reactivar`) para cualquier usuario autenticado cuyo rol efectivo no sea `ADMINISTRADOR_SISTEMA` ni `JEFE_CALIDAD_SYST` (decisión de Toño, 2026-08-24 — ambos roles pueden administrar, ninguno reemplaza al otro).

#### Scenario: Rol sin permiso de administración intenta crear un Local
- **WHEN** un usuario autenticado con rol distinto de `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST` (p. ej. `OPERARIO`) envía `POST /api/locales`
- **THEN** el sistema responde `403`, sin crear el registro

#### Scenario: JEFE_CALIDAD_SYST puede administrar Locales y Zonas
- **WHEN** un usuario `JEFE_CALIDAD_SYST` envía cualquiera de las mutaciones de Local o Zona listadas arriba
- **THEN** el sistema procesa la mutación igual que si el usuario fuera `ADMINISTRADOR_SISTEMA`

#### Scenario: Los endpoints de lectura no cambian su restricción de rol
- **WHEN** cualquier usuario autenticado (independientemente de su rol) solicita `GET /api/locales` o `GET /api/locales/:localId/zonas`
- **THEN** el sistema responde `200` igual que antes de este cambio — la restricción de rol aplica únicamente a las mutaciones
