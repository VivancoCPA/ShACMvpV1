## ADDED Requirements

### Requirement: Store mutable compartido de usuarios
`src/mocks/fixtures/auth.fixtures.ts` SHALL exportar una función `getUsersStore(): MockUser[]` que retorna el mismo array mutable usado por el handler de login. Tanto `auth.handlers.ts` (login) como `users.handlers.ts` (CRUD de administración) SHALL operar sobre este store compartido, nunca sobre una copia importada estáticamente — siguiendo el mismo patrón ya establecido para stores cross-dominio en MSW (p.ej. `getIncidentsStore()`).

#### Scenario: Baja de usuario desde el CRUD bloquea login inmediatamente
- **WHEN** un admin da de baja a un usuario vía `PATCH /api/users/:id/toggle-active` y, sin recargar el mock, ese usuario intenta loguear
- **THEN** el login es rechazado por el handler de login, porque ambos handlers leen el mismo store mutable

### Requirement: Handler MSW de login rechaza usuarios inactivos (RN-USR-002)
`POST /api/auth/login` en `src/mocks/handlers/auth.handlers.ts` SHALL verificar `activo` del usuario encontrado por email antes de validar la contraseña. Si `activo === false`, el handler SHALL responder con un error cuyo mensaje sea explícitamente distinto de "credenciales inválidas" (p.ej. "Usuario deshabilitado, contacte al administrador"), simulando latencia de 400ms como el resto de handlers.

#### Scenario: Usuario inactivo no puede loguear
- **WHEN** se envía `POST /api/auth/login` con las credenciales correctas de un usuario cuyo `activo === false`
- **THEN** la respuesta es un error con mensaje "Usuario deshabilitado, contacte al administrador" (o equivalente localizado), distinto del mensaje de credenciales inválidas

#### Scenario: Usuario activo con credenciales correctas loguea normalmente
- **WHEN** se envía `POST /api/auth/login` con las credenciales correctas de un usuario cuyo `activo === true`
- **THEN** el login es exitoso y retorna `accessToken`

### Requirement: Handlers MSW de listado y filtros de usuarios
`src/mocks/handlers/users.handlers.ts` SHALL registrar `GET /api/users`, soportando filtros opcionales por `rol` y `activo` vía query params, y devolviendo la lista completa de usuarios (sin excluir campo `password` — dato interno del mock, no expuesto en producción real) envuelta en `ApiResponse<User[]>`. Latencia simulada: 400ms.

#### Scenario: Listado sin filtros retorna todos los usuarios
- **WHEN** se envía `GET /api/users`
- **THEN** la respuesta incluye todos los usuarios del store, activos e inactivos

#### Scenario: Filtro por rol retorna solo usuarios de ese rol
- **WHEN** se envía `GET /api/users?rol=SUPERVISOR`
- **THEN** la respuesta incluye únicamente usuarios con `rol === 'SUPERVISOR'`

#### Scenario: Filtro por estado retorna solo usuarios activos
- **WHEN** se envía `GET /api/users?activo=true`
- **THEN** la respuesta incluye únicamente usuarios con `activo === true`

### Requirement: Handler MSW de alta de usuario (RN-USR-005)
`POST /api/users` SHALL crear un nuevo usuario en el store con `activo: true`, generar una contraseña temporal alfanumérica de 8 caracteres, asignarla como `password` del nuevo registro, y retornarla en el campo `temporaryPassword` de la respuesta (nunca persistida en texto plano visible fuera de esta respuesta única). El handler SHALL validar unicidad de email (ver `user-management-schemas`) antes de crear el registro.

#### Scenario: Alta exitosa retorna la contraseña temporal
- **WHEN** se envía `POST /api/users` con datos válidos y email no duplicado
- **THEN** la respuesta incluye `temporaryPassword` de 8 caracteres alfanuméricos, y el nuevo usuario aparece en `GET /api/users` con `activo: true`

#### Scenario: Alta con email duplicado es rechazada
- **WHEN** se envía `POST /api/users` con un `email` ya existente en el store
- **THEN** la respuesta es `409` y ningún usuario nuevo se agrega al store

### Requirement: Handler MSW de edición de usuario (RN-USR-006)
`PATCH /api/users/:id` SHALL actualizar `email`, `rol`, `area`, `areasAsignadas` y `avatarUrl` (si se envía) del usuario indicado, sin tocar `password` ni `activo`. El handler SHALL validar unicidad de `email` excluyendo al propio usuario editado.

#### Scenario: Edición exitosa actualiza los campos permitidos
- **WHEN** se envía `PATCH /api/users/:id` con un nuevo `rol` y `area`
- **THEN** `GET /api/users` refleja los nuevos valores para ese usuario, y su `password`/`activo` permanecen sin cambios

#### Scenario: Edición no invalida referencias históricas de otros dominios
- **WHEN** se edita el `rol` de un usuario que aparece como `responsableInvestigacionId` en un Quality Event existente
- **THEN** el QE existente conserva esa referencia sin error ni revalidación

### Requirement: Handler MSW de baja/reactivación de usuario (RN-USR-001, RN-USR-003)
`PATCH /api/users/:id/toggle-active` SHALL alternar el campo `activo` del usuario indicado (`true` → `false` o `false` → `true`) sin eliminar el registro del store y sin modificar ningún otro campo, incluyendo `password`. Esta operación SHALL siempre tener éxito (no existe condición de bloqueo, a diferencia de la desactivación de Locales/Zonas).

#### Scenario: Dar de baja no elimina el registro
- **WHEN** se envía `PATCH /api/users/:id/toggle-active` sobre un usuario `activo: true`
- **THEN** el usuario sigue apareciendo en `GET /api/users` con `activo: false`, y su `id` permanece igual

#### Scenario: Reactivar restaura acceso sin resetear contraseña
- **WHEN** se envía `PATCH /api/users/:id/toggle-active` sobre un usuario `activo: false` que fue dado de baja previamente
- **THEN** el usuario queda `activo: true` y su `password` es la misma que tenía antes de la baja

### Requirement: Handler MSW de reset de contraseña por admin (RN-USR-004)
`POST /api/users/:id/reset-password` SHALL generar una nueva contraseña temporal alfanumérica de 8 caracteres, sobrescribir el `password` del usuario en el store, y retornarla en el campo `temporaryPassword` de la respuesta.

#### Scenario: Reset exitoso permite login inmediato con la nueva contraseña
- **WHEN** se envía `POST /api/users/:id/reset-password` sobre un usuario existente, y luego ese usuario intenta loguear con el `temporaryPassword` recibido
- **THEN** el login es exitoso

#### Scenario: Contraseña anterior deja de funcionar tras el reset
- **WHEN** se envía `POST /api/users/:id/reset-password` sobre un usuario existente, y luego ese usuario intenta loguear con su contraseña anterior
- **THEN** el login falla por credenciales inválidas
