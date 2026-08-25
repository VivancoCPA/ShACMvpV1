## Why

`ShcMvpEndPoint` no tiene hoy ningún endpoint de alta/edición/baja/reset de usuarios — la única vía para crear un `ShacUser` es `DevSeedExtensions` (exclusivo de Development, pensado como parche temporal: *"M6 (Usuarios) todavía no existe... Reemplazar/eliminar este seed cuando M6 tenga un flujo real de alta de administrador"*). El frontend (`shc-controldoc`) ya tiene el CRUD administrativo completo de M6 construido contra MSW (`user-management-msw`, `user-management-schemas`, `user-management-form`, `user-management-list-view`), con las reglas de negocio RN-USR-001 a RN-USR-007 ya definidas y probadas contra el mock — sin el backend real, ese CRUD no puede pasar de mock a producción. Este cambio construye la contraparte real en `.NET`.

## What Changes

- Nuevos endpoints administrativos de usuario, scoped a la empresa activa del actor:
  - `GET /api/users` — listado con filtros opcionales `?rol=` y `?activo=`.
  - `POST /api/users` — alta (RN-USR-005), crea `ShacUser` + fila `UsuarioEmpresa` en la empresa activa de quien crea, retorna `temporaryPassword` una sola vez.
  - `PATCH /api/users/:id` — edición (RN-USR-006) de datos del usuario; el `rol` (si viene) se escribe únicamente en la fila `UsuarioEmpresa` de la empresa activa del actor, nunca en `ShacUser`.
  - `PATCH /api/users/:id/toggle-active` — baja/reactivación (RN-USR-001, RN-USR-003), sin condición de bloqueo.
  - `POST /api/users/:id/reset-password` — reset de password por admin (RN-USR-004), distinto de `ResetPin` (que resetea `PinHash`, no el password de login).
- Nuevo generador de contraseña temporal (8 caracteres alfanuméricos, mayúsculas+minúsculas+dígitos) — no existe hoy un equivalente reutilizable en el backend.
- `Features/Auth/AuthDtos.UserDto` se reutiliza para las 4 respuestas que devuelven forma de usuario (list/create/update no tocan su forma; el DTO no se mueve de namespace en este cambio, solo se referencia desde `Features.Users`).
- No reemplaza `DevSeedExtensions.SeedDevelopmentSuperAdminAsync`: ningún endpoint de este módulo puede poner `EsSuperadminMultiempresa = true` (deliberadamente fuera de alcance — ver Non-Goals en design.md), así que el seed de SUPERADMIN sigue siendo el único bootstrap. `SeedDevelopmentQaTestUsersAsync` tampoco se retira (sirve a una pasada de pruebas manuales distinta, documentada aparte).

## Capabilities

### New Capabilities
- `be-users-api`: CRUD administrativo de usuarios en el backend real (listado scoped por empresa activa con excepción para `SUPERADMIN`, alta, edición, baja/reactivación, reset de contraseña por admin), implementando server-side las reglas RN-USR-001 a RN-USR-007 ya establecidas por el mock (`user-management-msw`).

### Modified Capabilities
_Ninguna._ No existe hoy un `be-users-api` (ni equivalente) que modificar — a diferencia de `be-crud-locales-zonas`, que amplió specs backend de solo-lectura ya existentes (`be-areas-catalogo`, `be-locales-zonas-lectura`), este es el primer spec backend de Usuarios.

## Impact

- **Código afectado**: `ShcMvpEndPoint/Features/Users/*` (nuevo — `ListarUsuarios`, `CrearUsuario`, `ActualizarUsuario`, `ToggleActivoUsuario`, `ResetPasswordUsuario`, cada uno con `Command/Endpoint/Handler(/Validator)`), un generador de contraseña temporal nuevo, `Extensions/EndpointExtensions.cs` (registro de los 5 endpoints nuevos).
- **Dependencias existentes reutilizadas sin cambios**: `UserDto`/`UserDto.From` (`Features/Auth/AuthDtos.cs`), `SessionResolver.GetRolEfectivoAsync`, `ClaimsPrincipalExtensions` (`GetEmpresaActivaId`, `GetUsuarioId`), `UserManager<ShacUser>` (Identity), `DapperConnectionFactory` (lectura), `ShacDbContext`/`UsuarioEmpresa` (escritura), excepciones de dominio existentes (`NotFoundException`, `ConflictException`, `UnauthorizedBusinessException`, `BadRequestBusinessException`).
- **No afectado / no tocar**: `Features/Empresas/AsignarUsuarioEmpresa` (alta cross-empresa de un usuario ya existente, `SUPERADMIN`-only, toma `UsuarioId` no email), `Features/Empresas/ActualizarAsignacion` (solo cambia `Estado` de la asignación, nunca `Rol`), `Features/Empresas/ListarUsuariosEmpresa` (`GET /api/empresas/:id/usuarios`, `SUPERADMIN`-only, lista usuarios de una empresa arbitraria), `Features/Empresas/ResetPin` / `Features/Auth/SetPin` (resetean `PinHash`, no el password de login), `Features/Auth/Login` (ya rechaza usuarios inactivos, sin cambios).
- **Fuera de alcance**: crear un usuario con `rol` `SUPERADMIN` o poner `EsSuperadminMultiempresa = true`; cualquier flujo de recuperación de password por email (sigue siendo un stub, ver `ForgotPasswordPage`/`ResetPasswordPage`); ejecutar `dotnet test` (a confirmar en `/opsx:apply` — este entorno sí tiene `dotnet 10.0.101` disponible, a diferencia de lo asumido originalmente).
