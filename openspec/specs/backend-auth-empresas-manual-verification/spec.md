# backend-auth-empresas-manual-verification

## Purpose

Verificación manual, contra una instancia real del backend .NET y Postgres real (sin mocks), de que los endpoints de autenticación (`/api/auth/*`) y de gestión de empresas (`/api/empresas*`) se comportan exactamente como documenta `docs/SHAC-Contrato-API.md`, cubriendo las combinaciones de tipo de usuario (mono-empresa, multi-empresa, superadmin), estados de sesión, y las reglas de negocio de asignación empresa-usuario (incluyendo la cascada RN-EMP-005).

## Requirements

### Requirement: POST /api/auth/login conforms to the documented contract across all session-state permutations
El endpoint `POST /api/auth/login` SHALL comportarse, contra una instancia real del backend y Postgres real, exactamente como documenta `docs/SHAC-Contrato-API.md` para cada combinación de tipo de usuario (mono-empresa, multi-empresa, superadmin), credenciales, estado `activo`, y presencia/ausencia de `empresaId` en el body.

#### Scenario: Login válido de usuario mono-empresa
- **WHEN** un usuario activo asignado a una sola empresa envía credenciales válidas sin `empresaId`
- **THEN** la respuesta es 200, incluye `accessToken`, `empresaActivaId` coincide con la única empresa asignada, y `user.rol` es el rol correcto de esa asignación

#### Scenario: Login válido de usuario multi-empresa sin empresaId requiere selección
- **WHEN** un usuario activo con dos o más empresas asignadas envía credenciales válidas sin `empresaId`
- **THEN** la respuesta es 200 con `requiresEmpresaSelection: true` y `empresasDisponibles` lista exactamente las empresas asignadas a ese usuario

#### Scenario: Segunda llamada con empresaId completa el login con el rol efectivo de esa empresa
- **WHEN** el mismo usuario multi-empresa llama de nuevo a `POST /api/auth/login` con las mismas credenciales y un `empresaId` de los listados en `empresasDisponibles`
- **THEN** la respuesta es 200 con login completo (`accessToken` presente) y `user.rol` es el rol efectivo del usuario específicamente en esa empresa (verificado con un usuario que tenga rol distinto en cada empresa asignada)

#### Scenario: Login de superadmin no pide selección de empresa
- **WHEN** un usuario con `esSuperadminMultiempresa: true` envía credenciales válidas
- **THEN** la respuesta es 200, `rol: 'SUPERADMIN'`, `empresaActivaId: null`, y no se pide selección de empresa

#### Scenario: Credenciales inválidas
- **WHEN** se envía un password incorrecto para un usuario existente
- **THEN** la respuesta es 401 con mensaje "Credenciales inválidas"

#### Scenario: Usuario deshabilitado
- **WHEN** un usuario con `activo: false` envía credenciales correctas
- **THEN** la respuesta es 403 (no 401), con un mensaje distinto al de credenciales inválidas

#### Scenario: Usuario sin ninguna empresa activa asignada
- **WHEN** un usuario activo sin ninguna asignación `UsuarioEmpresa` en estado `ACTIVO` envía credenciales correctas
- **THEN** la respuesta es 403

#### Scenario: empresaId que no corresponde al usuario
- **WHEN** un usuario multi-empresa envía credenciales correctas junto con un `empresaId` que no está entre sus empresas asignadas
- **THEN** la respuesta es 403

### Requirement: POST /api/auth/logout es idempotente sin validar sesión
El endpoint `POST /api/auth/logout` SHALL responder 200 tanto con un token válido como sin token o con un token inválido, sin exponer diferencias observables entre ambos casos.

#### Scenario: Logout con token válido
- **WHEN** se llama con un `accessToken` válido en el header `Authorization`
- **THEN** la respuesta es 200

#### Scenario: Logout sin token o con token inválido
- **WHEN** se llama sin header `Authorization` o con un token inválido/expirado
- **THEN** la respuesta es igualmente 200

### Requirement: POST /api/auth/refresh emite un token nuevo con el rol recalculado
El endpoint `POST /api/auth/refresh` SHALL emitir un `accessToken` nuevo con `user.rol` recalculado a partir del estado actual del usuario cuando el refresh token es válido, y SHALL rechazar tokens inválidos o expirados con 401.

#### Scenario: Refresh con token válido
- **WHEN** se llama con un refresh token válido
- **THEN** la respuesta es 200 con un nuevo `accessToken` y `user.rol` recalculado correctamente para la empresa activa

#### Scenario: Refresh con token inválido o expirado
- **WHEN** se llama con un refresh token inválido o expirado
- **THEN** la respuesta es 401 con mensaje "Sesión expirada"

### Requirement: POST /api/auth/switch-empresa cambia la empresa activa solo dentro de las asignaciones válidas del usuario
El endpoint `POST /api/auth/switch-empresa` SHALL actualizar `empresaActivaId` y recalcular `user.rol` únicamente cuando el `empresaId` solicitado pertenece a una asignación activa del usuario autenticado, SHALL rechazar la operación para usuarios `esSuperadminMultiempresa`, y SHALL validar la forma del request y del token.

#### Scenario: Usuario multi-empresa cambia a otra empresa asignada
- **WHEN** un usuario multi-empresa autenticado envía `empresaId` de otra de sus empresas asignadas
- **THEN** la respuesta es 200, `empresaActivaId` queda actualizado, y `user.rol` se recalcula para la nueva empresa

#### Scenario: Body sin empresaId
- **WHEN** se llama sin `empresaId` en el body
- **THEN** la respuesta es 400

#### Scenario: Token inválido
- **WHEN** se llama con un token inválido
- **THEN** la respuesta es 401

#### Scenario: Superadmin intenta cambiar de empresa
- **WHEN** un usuario `esSuperadminMultiempresa: true` llama al endpoint con cualquier `empresaId`
- **THEN** la respuesta es 403 ("Superadmin no cambia de empresa")

#### Scenario: empresaId no asignado al usuario
- **WHEN** un usuario autenticado envía un `empresaId` que no está entre sus empresas asignadas
- **THEN** la respuesta es 403

### Requirement: POST /api/auth/forgot-password no revela si el email existe
El endpoint `POST /api/auth/forgot-password` SHALL responder 200 de forma indistinguible tanto si el email pertenece a un usuario existente como si no.

#### Scenario: Email existente
- **WHEN** se envía un email que sí pertenece a un usuario registrado
- **THEN** la respuesta es 200 con body `null`

#### Scenario: Email inexistente
- **WHEN** se envía un email que no pertenece a ningún usuario
- **THEN** la respuesta es igualmente 200 con body `null`, sin diferencia observable respecto al caso anterior

### Requirement: POST /api/auth/reset-password valida el token de reseteo
El endpoint `POST /api/auth/reset-password` SHALL completar el reseteo cuando el token es válido, y SHALL rechazar con 400 y el mensaje documentado cuando el token es inválido o expirado.

#### Scenario: Token válido
- **WHEN** se envía un token de reseteo válido junto con una nueva contraseña
- **THEN** la respuesta es 200

#### Scenario: Token inválido o expirado
- **WHEN** se envía un token inválido o expirado
- **THEN** la respuesta es 400 con body `{success:false, message:'Token inválido o expirado'}`

### Requirement: POST /api/auth/change-password valida la contraseña actual del usuario autenticado
El endpoint `POST /api/auth/change-password` SHALL completar el cambio cuando `currentPassword` coincide con la contraseña actual del usuario autenticado, y SHALL rechazar con 401 cuando no coincide.

#### Scenario: currentPassword correcto
- **WHEN** un usuario autenticado envía su `currentPassword` correcto junto con la nueva contraseña
- **THEN** la respuesta es 200 con body `null`

#### Scenario: currentPassword incorrecto
- **WHEN** un usuario autenticado envía un `currentPassword` incorrecto
- **THEN** la respuesta es 401

### Requirement: GET /api/empresas está restringido a SUPERADMIN
El endpoint `GET /api/empresas` SHALL devolver la lista completa de empresas únicamente a usuarios `SUPERADMIN` autenticados, y SHALL rechazar cualquier otro caso.

#### Scenario: SUPERADMIN lista todas las empresas
- **WHEN** un usuario `SUPERADMIN` autenticado llama al endpoint
- **THEN** la respuesta es 200 con la lista completa de empresas existentes

#### Scenario: Usuario no-SUPERADMIN
- **WHEN** un usuario autenticado con rol distinto de `SUPERADMIN` llama al endpoint
- **THEN** la respuesta es 403

#### Scenario: Sin sesión
- **WHEN** se llama sin header `Authorization` o con un token inválido
- **THEN** la respuesta es 401

### Requirement: POST /api/empresas crea una empresa activa por defecto
El endpoint `POST /api/empresas` SHALL crear una empresa con `estado: 'ACTIVA'` por defecto cuando `razonSocial` y `ruc` son válidos, y SHALL documentar explícitamente el status code real devuelto cuando `ruc` está duplicado.

#### Scenario: Creación válida
- **WHEN** se envía `razonSocial` y `ruc` válidos y no duplicados
- **THEN** la respuesta es 201 con `estado: 'ACTIVA'`

#### Scenario: RUC duplicado
- **WHEN** se envía un `ruc` que ya pertenece a otra empresa existente
- **THEN** se registra el status code real devuelto por el backend (el contrato no lo especifica explícitamente) y se documenta como hallazgo si no coincide con una expectativa razonable (409 o 400)

### Requirement: PATCH /api/empresas/:id aplica cambios parciales y ejecuta la cascada RN-EMP-005 al desactivar
El endpoint `PATCH /api/empresas/:id` SHALL aplicar cambios parciales sin afectar campos no incluidos en el body, y SHALL, al transicionar `estado` de `'ACTIVA'` a `'INACTIVA'`, desactivar en la misma operación transaccional todas las filas `UsuarioEmpresa` en estado `ACTIVO` asociadas a esa empresa (RN-EMP-005).

#### Scenario: Editar razonSocial sin tocar estado
- **WHEN** se envía un PATCH con solo `razonSocial` nuevo
- **THEN** la respuesta es 200 y el cambio queda reflejado, sin alterar `estado`

#### Scenario: Desactivar una empresa con usuarios asignados activos dispara la cascada
- **WHEN** se envía un PATCH cambiando `estado` de `'ACTIVA'` a `'INACTIVA'` sobre una empresa que tiene una o más filas `UsuarioEmpresa` en estado `ACTIVO`
- **THEN** la respuesta es 200, y un `GET /api/empresas/:id/usuarios` posterior confirma que todas esas filas quedaron en `INACTIVO`

#### Scenario: Empresa inexistente
- **WHEN** se envía un PATCH a un `:id` que no existe
- **THEN** la respuesta es 404

### Requirement: GET /api/empresas/:id/usuarios lista asignaciones enriquecidas con datos del usuario
El endpoint `GET /api/empresas/:id/usuarios` SHALL devolver todas las filas `UsuarioEmpresa` de la empresa (activas e inactivas), cada una enriquecida con nombre, apellido y email del usuario asociado.

#### Scenario: Empresa con usuarios activos e inactivos
- **WHEN** se consulta una empresa que tiene asignaciones tanto `ACTIVO` como `INACTIVO`
- **THEN** la respuesta es 200 e incluye ambos estados, cada fila con nombre/apellido/email del usuario

#### Scenario: Empresa inexistente
- **WHEN** se consulta un `:id` que no existe
- **THEN** la respuesta es 404

### Requirement: POST /api/empresas/:id/usuarios crea o reactiva la asignación según exista una fila previa
El endpoint `POST /api/empresas/:id/usuarios` SHALL crear una nueva fila `UsuarioEmpresa` cuando el usuario no tenía ninguna asignación previa en esa empresa, y SHALL reactivar y actualizar el rol de la fila existente (en vez de crear una duplicada) cuando el usuario ya tenía una fila en estado `INACTIVO` en esa empresa.

#### Scenario: Usuario sin fila previa en la empresa
- **WHEN** se asigna un usuario que no tiene ninguna fila `UsuarioEmpresa` previa en esa empresa
- **THEN** la respuesta es 201 con una nueva fila `UsuarioEmpresa`

#### Scenario: Usuario con fila previa INACTIVO reactiva en vez de duplicar
- **WHEN** se asigna un usuario que ya tenía una fila `INACTIVO` en esa empresa (por ejemplo, resultado de una desactivación en cascada RN-EMP-005)
- **THEN** la respuesta refleja la fila reactivada con el rol actualizado, y un `GET /api/empresas/:id/usuarios` posterior confirma que no existen dos filas para el mismo par usuario/empresa

#### Scenario: usuarioId inexistente
- **WHEN** se envía un `usuarioId` que no corresponde a ningún usuario existente
- **THEN** la respuesta es 404

### Requirement: PATCH /api/empresas/:id/usuarios/:usuarioId cambia el estado de una asignación puntual
El endpoint `PATCH /api/empresas/:id/usuarios/:usuarioId` SHALL cambiar el `estado` de una fila `UsuarioEmpresa` específica sin afectar el `estado` de la empresa ni de otras asignaciones, en ambas direcciones (activar/desactivar), y SHALL responder 404 cuando el par `:id`/`:usuarioId` no corresponde a ninguna fila.

#### Scenario: Desactivar una asignación puntual
- **WHEN** se envía un PATCH cambiando `estado` de `'ACTIVO'` a `'INACTIVO'` para un par empresa/usuario específico
- **THEN** la respuesta es 200 y solo esa fila cambia de estado

#### Scenario: Reactivar una asignación puntual
- **WHEN** se envía un PATCH cambiando `estado` de `'INACTIVO'` a `'ACTIVO'` para ese mismo par
- **THEN** la respuesta es 200

#### Scenario: Par empresa/usuario inexistente
- **WHEN** `:id` y/o `:usuarioId` no coinciden con ninguna fila `UsuarioEmpresa` existente
- **THEN** la respuesta es 404
