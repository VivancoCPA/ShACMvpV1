## ADDED Requirements

### Requirement: Listado de usuarios scoped por empresa activa, con excepción para SUPERADMIN
El sistema SHALL exponer `GET /api/users`, restringido a `ADMINISTRADOR_EMPRESA` salvo la excepción de `SUPERADMIN` descrita abajo. Para un actor distinto de `SUPERADMIN`, SHALL exigir empresa activa en la sesión (`401 "Sesión sin empresa activa"` si no hay) y SHALL filtrar el listado a usuarios con al menos una fila `UsuarioEmpresa` en esa empresa (sin importar `Estado`). Para un actor `SUPERADMIN`, SHALL devolver todos los usuarios del sistema sin filtro de empresa. SHALL soportar filtros opcionales de query `?rol=` (sobre el rol efectivo en la empresa activa) y `?activo=` (sobre `ShacUser.Activo`).

#### Scenario: Listado exitoso scoped a la empresa activa
- **WHEN** un `ADMINISTRADOR_EMPRESA` con empresa activa envía `GET /api/users`
- **THEN** el sistema responde `200` con únicamente los usuarios que tienen una fila `UsuarioEmpresa` en esa empresa activa

#### Scenario: Sin empresa activa
- **WHEN** un actor distinto de `SUPERADMIN` sin empresa activa en su sesión envía `GET /api/users`
- **THEN** el sistema responde `401 "Sesión sin empresa activa"`

#### Scenario: SUPERADMIN ve todos los usuarios sin filtro de empresa
- **WHEN** un `SUPERADMIN` (sesión sin empresa activa por diseño) envía `GET /api/users`
- **THEN** el sistema responde `200` con los usuarios de todas las empresas, sin exigir empresa activa

#### Scenario: Filtro por rol
- **WHEN** se envía `GET /api/users?rol=SUPERVISOR`
- **THEN** la respuesta incluye únicamente usuarios cuyo rol efectivo en la empresa activa (o global, no aplica a SUPERADMIN) es `SUPERVISOR`

#### Scenario: Filtro por activo
- **WHEN** se envía `GET /api/users?activo=true`
- **THEN** la respuesta incluye únicamente usuarios con `ShacUser.Activo === true`

### Requirement: Rol por usuario reflejado desde UsuarioEmpresa, nunca desde un campo global
Cada usuario devuelto por `GET /api/users` SHALL mostrar como `Rol` el valor de `UsuarioEmpresa.Rol` correspondiente a `(usuarioId, empresaActivaDelActor)`, resuelto vía una única consulta (evitando N+1) — nunca un campo de rol global en `ShacUser` (que no existe). Cuando el actor es `SUPERADMIN` (sin empresa activa), `Rol` SHALL viajar `null`.

#### Scenario: Mismo usuario, rol distinto en cada empresa
- **WHEN** un usuario tiene `UsuarioEmpresa.Rol = SUPERVISOR` en la Empresa A y `Rol = JEFE_CALIDAD_SYST` en la Empresa B
- **THEN** `GET /api/users` con empresa activa = Empresa A muestra `Rol: SUPERVISOR` para ese usuario, y con empresa activa = Empresa B muestra `Rol: JEFE_CALIDAD_SYST` — nunca el mismo valor en ambos casos por error de lectura de un campo compartido

#### Scenario: SUPERADMIN sin rol determinado
- **WHEN** un `SUPERADMIN` envía `GET /api/users`
- **THEN** cada usuario de la respuesta viaja con `Rol: null`, sin importar cuántas empresas y roles distintos tenga asignados

### Requirement: Alta de usuario (RN-USR-005)
El sistema SHALL exponer `POST /api/users`, restringido a `ADMINISTRADOR_EMPRESA`, requiriendo empresa activa (`401` si no hay). SHALL crear un `ShacUser` con `Activo: true` y, en la misma operación, una fila `UsuarioEmpresa` (`Estado: ACTIVO`, `Rol` = el recibido o `OPERARIO` por defecto) en la empresa activa del actor. SHALL generar una contraseña temporal alfanumérica de 8 caracteres y retornarla en `temporaryPassword`, una única vez.

#### Scenario: Alta exitosa
- **WHEN** un `ADMINISTRADOR_EMPRESA` con empresa activa envía `POST /api/users` con `{ nombre, apellido, email, rol?, areaId?, areaIds?, avatarBase64? }` válidos
- **THEN** el sistema responde `201` con el usuario creado, `activo: true`, y `temporaryPassword` con la contraseña generada

#### Scenario: Rol por defecto
- **WHEN** `POST /api/users` se envía sin el campo `rol`
- **THEN** el usuario se crea con rol `OPERARIO` en la fila `UsuarioEmpresa` de la empresa activa

#### Scenario: Usuario recién creado puede loguear de inmediato
- **WHEN** se completa el alta de un usuario
- **THEN** existe una fila `UsuarioEmpresa` con `Estado: ACTIVO` para ese usuario en la empresa activa del creador, de modo que `POST /api/auth/login` no lo rechaza por "sin empresa asignada"

#### Scenario: SUPERVISOR sin áreas asignadas es rechazado
- **WHEN** `POST /api/users` envía `rol: SUPERVISOR` sin `areaId` o sin `areaIds` (o `areaIds` vacío)
- **THEN** el sistema responde `400` sin crear el usuario

#### Scenario: Rol SUPERADMIN no es asignable desde este flujo
- **WHEN** `POST /api/users` envía `rol: SUPERADMIN`
- **THEN** el sistema responde `400` — este flujo nunca crea usuarios con `EsSuperadminMultiempresa: true` ni rol `SUPERADMIN`

### Requirement: Email duplicado en alta — dos variantes de 409 (RN-USR-005, RN-EMP-006)
`POST /api/users` SHALL validar unicidad de `email`. Si el email pertenece a un usuario que ya tiene una fila `UsuarioEmpresa` en la empresa activa del actor, SHALL responder `409 "El email ya está en uso"`. Si el email pertenece a un usuario que existe pero únicamente en otra(s) empresa(s), SHALL responder `409` con un mensaje que explique el motivo y dirija a la vía correcta (asignación cross-empresa por `SUPERADMIN`), sin crear ni modificar ningún registro.

#### Scenario: Email duplicado dentro de la misma empresa
- **WHEN** `POST /api/users` envía un `email` que ya pertenece a un usuario con fila `UsuarioEmpresa` en la empresa activa del actor
- **THEN** el sistema responde `409 "El email ya está en uso"` y ningún usuario nuevo se crea

#### Scenario: Email ya registrado únicamente en otra empresa
- **WHEN** `POST /api/users` envía un `email` que pertenece a un usuario existente sin ninguna fila `UsuarioEmpresa` en la empresa activa del actor (solo en otra empresa)
- **THEN** el sistema responde `409` con un mensaje que indica que el usuario ya existe en otra empresa y que la asignación cross-empresa requiere a un `SUPERADMIN`, sin crear ni modificar ningún registro

### Requirement: Edición de usuario, rol aislado por empresa (RN-USR-006, RN-EMP-002)
El sistema SHALL exponer `PATCH /api/users/:id`, restringido a `ADMINISTRADOR_EMPRESA`. SHALL responder `401` si el actor no tiene empresa activa, y `404` si el usuario indicado no tiene fila `UsuarioEmpresa` en esa empresa activa. SHALL actualizar parcialmente `nombre`, `apellido`, `email` (validando unicidad excluyendo al propio usuario), `areaId`, `areaIds` y `avatarUrl` sobre `ShacUser`. Si el body incluye `rol`, SHALL actualizar **únicamente** la fila `UsuarioEmpresa` de `(usuarioId, empresaActivaDelActor)` — nunca un campo de `ShacUser`, que no tiene rol. SHALL nunca modificar `Activo` ni el password desde este endpoint.

#### Scenario: Edición exitosa de datos básicos
- **WHEN** un `ADMINISTRADOR_EMPRESA` envía `PATCH /api/users/:id` con `{ nombre?, apellido?, email?, areaId?, areaIds?, avatarBase64? }` sobre un usuario de su empresa activa
- **THEN** el sistema responde `200` con el usuario actualizado

#### Scenario: Cambio de rol no se filtra entre empresas
- **WHEN** un `ADMINISTRADOR_EMPRESA` de la Empresa A edita `rol` de un usuario que también pertenece a la Empresa B
- **THEN** solo la fila `UsuarioEmpresa` de `(usuario, Empresa A)` cambia de rol; la fila de `(usuario, Empresa B)` conserva su rol anterior sin modificación

#### Scenario: Usuario fuera de la empresa activa
- **WHEN** `PATCH /api/users/:id` se envía con un `id` que no tiene fila `UsuarioEmpresa` en la empresa activa del actor (no existe, o pertenece solo a otra empresa)
- **THEN** el sistema responde `404`, sin distinguir entre ambos casos

#### Scenario: Email duplicado en edición
- **WHEN** `PATCH /api/users/:id` cambia `email` a un valor que ya usa otro `ShacUser`
- **THEN** el sistema responde `409 "El email ya está en uso"` sin aplicar ningún cambio

### Requirement: Baja y reactivación de usuario sin condición de bloqueo (RN-USR-001, RN-USR-003)
El sistema SHALL exponer `PATCH /api/users/:id/toggle-active`, restringido a `ADMINISTRADOR_EMPRESA`, con el mismo guard de empresa activa (`401`/`404`) que la edición. SHALL alternar `ShacUser.Activo` (`true` ↔ `false`) sin ninguna validación de referencias activas — a diferencia de Área/Local/Zona, esta operación SHALL siempre tener éxito. SHALL no eliminar el registro ni modificar ningún otro campo, incluyendo el password.

#### Scenario: Baja exitosa sin condición de bloqueo
- **WHEN** un `ADMINISTRADOR_EMPRESA` envía `PATCH /api/users/:id/toggle-active` sobre un usuario activo de su empresa, sin importar cuántos QE/NC/Incidentes/AC tenga asignados
- **THEN** el sistema responde `200` con `activo: false`

#### Scenario: Reactivación conserva el password
- **WHEN** se reactiva un usuario previamente dado de baja
- **THEN** el usuario queda `activo: true` y su contraseña es la misma que tenía antes de la baja

#### Scenario: Usuario inactivo no puede loguear
- **WHEN** un usuario con `activo: false` intenta `POST /api/auth/login`
- **THEN** el login es rechazado con un mensaje distinto de "credenciales inválidas" (comportamiento ya existente de `LoginHandler`, sin cambios en este alcance)

### Requirement: Reset de contraseña por administrador (RN-USR-004)
El sistema SHALL exponer `POST /api/users/:id/reset-password`, restringido a `ADMINISTRADOR_EMPRESA`, con el mismo guard de empresa activa (`401`/`404`) que la edición. SHALL generar una nueva contraseña temporal alfanumérica de 8 caracteres, aplicarla al usuario mediante el mecanismo de Identity, y retornarla en `{ temporaryPassword }` — una única vez, nunca persistida en texto plano en ningún otro lugar. SHALL ser una operación distinta de `ResetPin` (que resetea `PinHash`, la firma de Quality Event, no el password de login).

#### Scenario: Reset exitoso
- **WHEN** un `ADMINISTRADOR_EMPRESA` envía `POST /api/users/:id/reset-password` sobre un usuario de su empresa activa
- **THEN** el sistema responde `200` con `{ temporaryPassword }`, y el usuario puede loguear con esa nueva contraseña

#### Scenario: No afecta el PIN de firma
- **WHEN** se resetea la contraseña de un usuario que ya tiene un PIN configurado (`PinHash` no nulo)
- **THEN** `PinHash` permanece sin cambios — el reset de contraseña nunca toca el PIN de firma

### Requirement: Mutaciones y listado restringidos a ADMINISTRADOR_EMPRESA
El sistema SHALL rechazar `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `PATCH /api/users/:id/toggle-active` y `POST /api/users/:id/reset-password` para cualquier usuario autenticado cuyo rol efectivo no sea `ADMINISTRADOR_EMPRESA`, salvo la excepción de `SUPERADMIN` en `GET /api/users` (ver requirement de listado).

#### Scenario: Rol sin permiso intenta administrar usuarios
- **WHEN** un usuario autenticado con rol distinto de `ADMINISTRADOR_EMPRESA` (p. ej. `JEFE_CALIDAD_SYST` u `OPERARIO`) envía cualquiera de los 5 endpoints (fuera de la excepción de listado para `SUPERADMIN`)
- **THEN** el sistema responde `403`, sin aplicar ningún cambio

### Requirement: SUPERADMIN no puede usar las operaciones por-id de este módulo
Dado que un `SUPERADMIN` nunca tiene empresa activa en su sesión (`SwitchEmpresaHandler` rechaza explícitamente que cambie de empresa), `POST /api/users`, `PATCH /api/users/:id`, `PATCH /api/users/:id/toggle-active` y `POST /api/users/:id/reset-password` SHALL responder siempre `401 "Sesión sin empresa activa"` para un actor `SUPERADMIN`, por construcción — sin necesitar una restricción de rol adicional para excluirlo (las 4 operaciones ya están restringidas a `ADMINISTRADOR_EMPRESA`, que un `SUPERADMIN` tampoco posee).

#### Scenario: SUPERADMIN intenta dar de alta un usuario
- **WHEN** un `SUPERADMIN` envía `POST /api/users`
- **THEN** el sistema responde `403` (rol no autorizado) antes de siquiera evaluar la empresa activa — igual resultado práctico (operación rechazada) que si se evaluara el guard de empresa activa primero
