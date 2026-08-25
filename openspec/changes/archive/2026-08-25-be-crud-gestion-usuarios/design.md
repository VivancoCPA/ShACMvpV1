## Context

`ShcMvpEndPoint` (.NET 10, VSA + Minimal APIs, CQRS Dapper-para-lecturas/EF-Core-para-escrituras) no tiene hoy ningún endpoint de alta/edición/baja/reset de usuario — `ShacUser` (`Infrastructure/Identity/ShacUser.cs`) ya tiene todos los campos necesarios (`Nombre`, `Apellido`, `AreaId`, `AreaIds`, `AvatarUrl`, `Activo`, `CreatedAt`, `LastLogin`, `EsSuperadminMultiempresa`, `PinHash`), confirmado leyendo la entidad — este cambio no agrega columnas, solo endpoints. El rol vive en `UsuarioEmpresa.Rol` (`Domain/Entities/UsuarioEmpresa.cs`), scoped por empresa (índice único `(UsuarioId, EmpresaId)`), resuelto vía `SessionResolver.GetRolEfectivoAsync(usuarioId, empresaId, ct)`. `Features/Auth/AuthDtos.cs` ya expone `UserDto.From(ShacUser, UserRole? rolEfectivo)`, diseñado exactamente para este patrón rol-por-empresa — se reutiliza sin mover de namespace.

El frontend (`shc-controldoc`) tiene el CRUD completo de usuarios construido contra MSW — es la fuente de verdad del contrato HTTP, verificada leyendo íntegro `src/mocks/handlers/users.handlers.ts`, `src/features/users/schemas/{createUser,updateUser}.schema.ts` y las specs sincronizadas `user-management-msw`/`user-management-schemas` (RN-USR-001 a RN-USR-007 ya definidas ahí).

Módulos backend previos relevantes, todos bajo `Features/Empresas/` y **`SUPERADMIN`-only**, que este cambio no toca:
- `AsignarUsuarioEmpresa` (`POST /api/empresas/:id/usuarios`) — asigna un usuario **existente** (por `UsuarioId: Guid`, no por email) a otra empresa; si la fila `UsuarioEmpresa` ya existe la reactiva y actualiza `Rol` en vez de duplicar.
- `ActualizarAsignacion` (`PATCH /api/empresas/:id/usuarios/:usuarioId`) — solo cambia `Estado` de la asignación, nunca `Rol`.
- `ListarUsuariosEmpresa` (`GET /api/empresas/:id/usuarios`) — lista los usuarios de una empresa arbitraria por id de ruta (no de sesión).
- `ResetPin` (`PATCH /api/empresas/:id/usuarios/:usuarioId/reset-pin`) — pone `PinHash = null` (el usuario debe volver a configurarlo vía `SetPin`); **no genera ni devuelve un secreto** — no hay un patrón de "one-time secret" preexistente que replicar en este backend.

Todos los anteriores toman el id de empresa **de la ruta**, nunca de "empresa activa de la sesión" — tiene sentido porque son operaciones de `SUPERADMIN`, cuya sesión **nunca tiene empresa activa** (ver D2). Este módulo (`Features/Users/*`) es el flujo *same-empresa*: alta/edición/baja/reset dentro de la empresa activa de quien actúa, sin id de empresa en la ruta.

## Goals / Non-Goals

**Goals:**
- 5 endpoints (`GET/POST /api/users`, `PATCH /api/users/:id`, `PATCH /api/users/:id/toggle-active`, `POST /api/users/:id/reset-password`) con paridad de comportamiento contra `users.handlers.ts`.
- Reutilizar `UserDto`/`UserDto.From`, `SessionResolver.GetRolEfectivoAsync`, `ClaimsPrincipalExtensions`, `UserManager<ShacUser>` — cero abstracciones nuevas de sesión/rol.
- Generador de contraseña temporal (8 caracteres, alfanumérico) compatible con la política de Identity ya configurada.

**Non-Goals:**
- Reemplazar `DevSeedExtensions.SeedDevelopmentSuperAdminAsync` — ningún endpoint de este módulo puede crear un usuario con `EsSuperadminMultiempresa = true` ni asignar rol `SUPERADMIN`; el seed de bootstrap sigue siendo necesario. `SeedDevelopmentQaTestUsersAsync` tampoco se retira (pasada de pruebas manuales aparte).
- Tocar `AsignarUsuarioEmpresa`, `ActualizarAsignacion`, `ListarUsuariosEmpresa`, `ResetPin`, `SetPin` — quedan tal cual.
- Flujo de recuperación de password por email (`ForgotPasswordPage`/`ResetPasswordPage` siguen siendo un stub, fuera de alcance).
- Ejecutar `dotnet test` — a confirmar en `/opsx:apply`: este entorno tiene `dotnet 10.0.101` disponible (a diferencia del supuesto de la instrucción original), así que puede no hacer falta delegarlo a Toño; se decide en la fase de implementación, igual que ocurrió en `be-crud-locales-zonas` (tasks.md 7.1, revisado en ejecución).

## Decisions

### D1 — Estructura de Features
```
Features/Users/ListarUsuarios/{Endpoint,Handler}.cs                 (Dapper, sin Command/Validator — solo query params)
Features/Users/CrearUsuario/{Command,Endpoint,Handler,Validator}.cs
Features/Users/ActualizarUsuario/{Command,Endpoint,Handler,Validator}.cs
Features/Users/ToggleActivoUsuario/{Endpoint,Handler}.cs             (sin Command — no recibe body)
Features/Users/ResetPasswordUsuario/{Endpoint,Handler}.cs            (sin Command — no recibe body)
Features/Users/Shared/TemporaryPasswordGenerator.cs
```
Mismo patrón que `Features/Locales/*` (D1 de `be-crud-locales-zonas`): un directorio por acción, agrupado por ruta.

### D2 — Guard de empresa activa en operaciones por-id: `401` uniforme, sin excepción para `SUPERADMIN` (y por qué no hace falta decidirlo)
`ActualizarLocalEndpoint`/`DesactivarLocalEndpoint` (precedente de `be-crud-locales-zonas`) devuelven `404` cuando falta empresa activa, plegándolo en el caso "no encontrado". Este módulo **diverge deliberadamente**: replica `requireUsuarioDeEmpresaActiva` del mock, que devuelve `401 "Sesión sin empresa activa"` — distinto del `404` de "usuario no encontrado en esta empresa" — en las 4 operaciones por-id (`PATCH /api/users/:id`, `/toggle-active`, `POST .../reset-password`, y también la creación). Se implementa lanzando `UnauthorizedBusinessException("Sesión sin empresa activa")` (ya mapeada a 401 por `ApiExceptionHandler`) antes de cualquier lookup por id, y `NotFoundException("Usuario no encontrado")` solo cuando sí hay empresa activa pero el usuario objetivo no tiene fila `UsuarioEmpresa` en ella.

**Esto no es una decisión abierta para `SUPERADMIN`:** `SwitchEmpresaHandler` lanza `ForbiddenBusinessException("Superadmin no cambia de empresa")` si `user.EsSuperadminMultiempresa` — confirmado en código — y `SessionResolver.ResolveSessionAsync` siempre resuelve `EmpresaActivaId: null` para ese flag. Un `SUPERADMIN` **nunca** puede tener `empresaActivaId` en su sesión/JWT, así que estos 4 endpoints (que no llevan `:empresaId` en la ruta, a diferencia de los de `Features/Empresas/*`) responderán `401` a un `SUPERADMIN` siempre, por construcción — no por una restricción de rol añadida a mano. Coincide exactamente con el comportamiento del mock (`useAuthStore.getState().empresaActivaId` también es `null` para `SUPERADMIN`).

### D3 — `GET /api/users`: excepción real para `SUPERADMIN`, resuelta con Dapper en una sola query (evita N+1)
Replica el handler real: si el rol del actor (`ClaimsPrincipalExtensions.GetRolEfectivo()`, ya viene en el claim del JWT — no requiere round-trip) **no** es `SUPERADMIN`, exige empresa activa (`401` si falta) y filtra a usuarios con fila `UsuarioEmpresa` en esa empresa (cualquier `Estado`); si **es** `SUPERADMIN`, sin filtro de empresa, ve todos los usuarios del sistema.

Para el campo `Rol` del DTO: en vez de invocar `SessionResolver.GetRolEfectivoAsync` (EF Core) una vez por fila del listado (N+1 real bajo Dapper), la query Dapper hace `LEFT JOIN usuarios_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = @EmpresaActivaId AND ue.estado = 'ACTIVO'` directamente (mismo patrón de columnas que `ListarUsuariosEmpresaHandler`: tablas `asp_net_users`/`usuarios_empresa`, columnas `usuario_id`/`empresa_id`/`rol`/`estado` en snake_case vía `UseSnakeCaseNaming()`), proyectando `ue.rol` como el `Rol` del DTO. Cuando el actor es `SUPERADMIN` (`@EmpresaActivaId` no aplica), el join se omite y `Rol` viaja `null` para cada fila (ver D9 — punto a confirmar con Toño).

### D4 — `POST /api/users`: dos variantes de `409` por email duplicado
1. Ya existe un `ShacUser` con ese email **y** tiene fila `UsuarioEmpresa` en la empresa activa del actor → `409 "El email ya está en uso"`.
2. Ya existe un `ShacUser` con ese email pero **solo** en otra(s) empresa(s) → `409` con mensaje que dirige a la vía correcta: `"Este usuario ya está registrado en otra empresa. Para asignarlo también a esta empresa, contacta a un Superadmin."` (la vía real es `AsignarUsuarioEmpresa`, que toma `UsuarioId`, no email — un Superadmin necesitaría primero encontrar el id, p.ej. vía `ListarUsuariosEmpresa` de la otra empresa o un futuro buscador; no se resuelve automáticamente aquí).

El pre-check por email es una consulta antes del `insert` (TOCTOU bajo concurrencia); `RequireUniqueEmail = true` en Identity actúa como red de seguridad real — si `userManager.CreateAsync` devuelve `IdentityError.Code == "DuplicateUserName"` pese al pre-check, se traduce igual a `409 "El email ya está en uso"` en vez de dejar que se propague como error genérico.

`Rol` default `OPERARIO` si se omite (igual que el mock). El validador (FluentValidation) exige `nombre`/`apellido`/`email` no vacíos y, si `Rol == SUPERVISOR`, exige `AreaId` + `AreaIds` no vacío (RN-USR, mismo criterio que `createUser.schema.ts`). El enum de `Rol` aceptado excluye `SUPERADMIN` (es un flag global, nunca asignado desde este flujo) — los 8 roles restantes de `UserRole` sí son válidos, incluyendo `ADMINISTRADOR_EMPRESA` (confirmado en `Domain/Enums/UserRole.cs`, agregado en la fase Multiempresa).

**Avatar (RN-USR-007):** el mock no revalida `avatarBase64` server-side (confía en el Zod del formulario), pero este backend sí lo hace por defensa en profundidad, igual que ya se hace con el plano PNG de Local (RN-LOC-003): si `avatarBase64` viene, el validador exige que el prefijo sea `data:image/jpeg;base64,` o `data:image/png;base64,` y que el tamaño decodificado sea ≤ 2MB; si no cumple, `400`.

### D5 — `PATCH /api/users/:id`: el campo `rol` nunca toca `ShacUser`
Si el body incluye `rol`, el handler actualiza **únicamente** la fila `UsuarioEmpresa` de `(usuarioId, empresaActivaDelActor)` — nunca escribe en `ShacUser` (que no tiene campo de rol). Es el bug que el comentario del mock documenta explícitamente (cambiar el rol en Empresa 1 se reflejaba en Empresa 2) — cualquier generalización futura de "actualizar el usuario" debe mantener este campo separado del resto del `Command`. `nombre`/`apellido`/`email`/`areaId`/`areaIds`/`avatarUrl` sí son campos de `ShacUser` y se actualizan ahí (parcial, solo lo enviado). Unicidad de `email` se revalida excluyendo al propio usuario. Nunca toca `Activo` ni el password.

### D6 — `PATCH /api/users/:id/toggle-active`: sin validación de bloqueo
A diferencia de Área/Local/Zona (RN-ARE-001/RN-LOC-002/RN-ZON-002, que sí cuentan referencias activas antes de desactivar), dar de baja a un usuario siempre tiene éxito — no se reproduce ningún conteo de QE/NC/Incidentes/AC asignados. Alterna `Activo` únicamente; reactivar no toca el password.

### D7 — `POST /api/users/:id/reset-password`: mecanismo de Identity
No hay un patrón de "reset admin de contraseña" preexistente en el backend (`ResetPin` solo nulea el hash, no genera secreto — ver Context). Se implementa con `userManager.RemovePasswordAsync(user)` seguido de `userManager.AddPasswordAsync(user, temporaryPassword)` (evita el paso extra de generar/consumir un token de `GeneratePasswordResetTokenAsync`, innecesario para una acción admin-a-admin sin email de por medio). Respuesta `{ temporaryPassword }`, una sola vez, nunca persistida en texto plano.

### D8 — Generador de contraseña temporal
`TemporaryPasswordGenerator` (`Features/Users/Shared/`), 8 caracteres tomados de un alfabeto `A-Za-z0-9` (mismo charset que `generateTemporaryPassword()` del mock) mediante `RandomNumberGenerator` (no `Random`, para no depender de una fuente no criptográfica en un secreto de un solo uso). Compatible con la política real de Identity (`RequiredLength = 8`, `RequireNonAlphanumeric = false`; `RequireDigit`/`RequireUppercase`/`RequireLowercase` quedan en su default `true` — el alfabeto mixto ya los satisface, aunque con probabilidad no-cero de generar una cadena sin dígito o sin mayúscula en una sola pasada; el helper reintenta hasta que la cadena generada cumpla los tres requisitos, evitando un `CreateAsync`/`AddPasswordAsync` fallido por política).

### D10 — Restricción de rol en los 5 endpoints: `ADMINISTRADOR_EMPRESA` únicamente (corrige el supuesto de la instrucción original, confirmado por Toño 2026-08-24)
La instrucción original de Cowork asumía actores `ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA`/`JEFE_CALIDAD_SYST` para este módulo — verificado contra `shc-controldoc/src/router/routeAccess.ts` (única fuente de verdad de RBAC de rutas del frontend), la ruta `/usuarios` usa `ROUTE_ROLE_GROUPS.usersAdmin: ['ADMINISTRADOR_EMPRESA']` — **un solo rol**, no tres. No existe ningún archivo `features/users/permissions.ts` con una matriz más granular (a diferencia de `documents/permissions.ts` o `incidentPermissions.ts`) — el gate es exclusivamente el `RoleGuard` de la ruta.

Los 5 endpoints (`GET/POST /api/users`, `PATCH /api/users/:id`, `/toggle-active`, `POST .../reset-password`) SHALL restringirse a `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.ADMINISTRADOR_EMPRESA)))`, replicando exactamente el gate real del frontend — no el criterio ampliado (`ADMINISTRADOR_SISTEMA`/`JEFE_CALIDAD_SYST`) de la instrucción original, que no tiene respaldo en el código verificado. Nota: esto no contradice `CLAUDE.md` ("`ADMINISTRADOR_SISTEMA` scope: M6 (Admin CRUD Locales/Zonas)") — ese texto se refiere a `locationsAdmin` (`ADMINISTRADOR_SISTEMA` + `JEFE_CALIDAD_SYST`, ver `be-crud-locales-zonas`), un grupo de rutas distinto de `usersAdmin` dentro del mismo módulo M6.

**Confirmado por Toño, 2026-08-24**: mantener `ADMINISTRADOR_EMPRESA` como único rol autorizado en los 5 endpoints — sin ampliar a `JEFE_CALIDAD_SYST` ni `ADMINISTRADOR_SISTEMA`, a diferencia de la ampliación que sí se hizo para Locales/Zonas (D9 de `be-crud-locales-zonas`).

### D9 — `UserDto.Rol` para `SUPERADMIN` en el listado global (`GET /api/users`) — confirmado por Toño, 2026-08-24
Sin empresa activa, "el rol" no está bien definido para un usuario que puede tener rol distinto en cada empresa a la que pertenece. **Decisión confirmada**: `Rol` viaja `null` (ya es nullable) en vez de mostrar el rol de una empresa arbitraria. Alternativa descartada explícitamente: mostrar el rol de la primera empresa activa encontrada (arbitrario, induce a error).

## Risks / Trade-offs

- [Riesgo] TOCTOU en la validación de email único de `POST /api/users` (pre-check + insert no son atómicos) → Mitigación: D4, traducir `IdentityError.Code == "DuplicateUserName"` de `CreateAsync` a `409` como red de seguridad.
- [Riesgo] Confundir este módulo con los endpoints `SUPERADMIN`-only de `Features/Empresas/*` (mismo dominio de datos, `UsuarioEmpresa`) → Mitigación: D2 explica por construcción por qué `SUPERADMIN` nunca puede usar estos 4 endpoints por-id; comentario explícito en cada `Endpoint.cs` señalando la diferencia con `AsignarUsuarioEmpresa`/`ActualizarAsignacion`.
- [Riesgo] Generalizar `ActualizarUsuario` como un "PATCH genérico" en el futuro y perder la separación D5 entre `ShacUser` y `UsuarioEmpresa.Rol` → Mitigación: mismo criterio de D5 de `be-crud-locales-zonas` (nombrar sin ambigüedad, comentario explícito).
- [Riesgo] `RandomNumberGenerator` con reintento (D8) podría, en teoría, no converger — estadísticamente despreciable (alfabeto de 62 caracteres, 8 posiciones) → sin mitigación adicional necesaria.
- [Riesgo, no bloqueante] `UserDto` permanece en `Features.Auth` en vez de moverse a un namespace compartido — `Features.Users` lo referencia directamente. Es un detalle de organización, no de contrato; revisar solo si en el futuro `Features.Auth` empieza a depender de `Features.Users` (circularidad), lo cual no ocurre en este cambio.

## Migration Plan

Sin migración EF Core — `ShacUser`/`UsuarioEmpresa` ya tienen todas las columnas necesarias (confirmado, D1 de contexto). Pasos:
1. Implementar los 5 endpoints + generador de contraseña.
2. Registrar los 5 endpoints en `Extensions/EndpointExtensions.cs` (`MapFeatureEndpoints`), sección nueva "Users" (paralela a "Auth"/"Empresas"/"Areas").
3. `dotnet build` — confirmar que compila contra los 5 proyectos (Domain/Infrastructure/Host/Tests).
4. `dotnet test` si el entorno de `/opsx:apply` tiene SDK disponible (confirmado disponible en este entorno, `dotnet 10.0.101`); si no, Toño lo corre en su máquina y reporta el resultado textual, como en cambios previos.
5. Sin rollback especial — no hay datos de producción ni migración que revertir.

Ninguna — ambos puntos que requerían confirmación de Toño (D9: `UserDto.Rol = null` para `SUPERADMIN`; D10: `ADMINISTRADOR_EMPRESA` como único rol autorizado) quedaron resueltos el 2026-08-24, antes de iniciar `/opsx:apply`. El alcance de `SUPERADMIN` en las operaciones por-id (D2) tampoco requirió decisión de producto — queda resuelto por la arquitectura de sesión existente (`SwitchEmpresaHandler` prohíbe que `SUPERADMIN` tenga empresa activa).
