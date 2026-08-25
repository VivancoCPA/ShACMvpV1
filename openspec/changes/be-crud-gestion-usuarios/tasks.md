## 0. Confirmación previa

- [x] 0.1 D9 (design.md) confirmado por Toño 2026-08-24: `UserDto.Rol` viaja `null` para `SUPERADMIN` en `GET /api/users`.
- [x] 0.2 D10 (design.md) confirmado por Toño 2026-08-24: los 5 endpoints se restringen únicamente a `ADMINISTRADOR_EMPRESA` (sin ampliar a `JEFE_CALIDAD_SYST`/`ADMINISTRADOR_SISTEMA`).
- [x] 0.3 Verificar si este entorno de `/opsx:apply` tiene SDK .NET disponible (`dotnet --version`) — de ser así, correr build/test directamente en vez de delegar a Toño (ver Non-Goals de design.md). Confirmado: `dotnet 10.0.101` disponible.

## 1. Infraestructura compartida

- [x] 1.1 Crear `Features/Users/Shared/TemporaryPasswordGenerator.cs` — 8 caracteres de `A-Za-z0-9` vía `RandomNumberGenerator`, con reintento hasta satisfacer `RequireDigit`/`RequireUppercase`/`RequireLowercase` de la política de Identity (diseño D8).
- [x] 1.2 Confirmado (`ListarUsuariosEmpresaHandler`/`DashboardDataFetcher`): `asp_net_users` (`id`, `nombre`, `apellido`, `email`, `area_id`, `area_ids` — `text[]`/`string[]?` en Dapper —, `avatar_url`, `activo`, `created_at`, `last_login`, `es_superadmin_multiempresa`), `usuarios_empresa` (`usuario_id`, `empresa_id`, `rol`, `estado`, `fecha_asignacion`).

## 2. GET /api/users — listado

- [x] 2.1 `Features/Users/ListarUsuarios/{Endpoint,Handler,UsuarioListRow}.cs` — Dapper, `JOIN usuarios_empresa` filtrado por empresa activa (o sin join para `SUPERADMIN`), proyectando `rol` desde el join (diseño D3, evita N+1). Filtros opcionales `?rol=`/`?activo=`.
- [x] 2.2 Rama `SUPERADMIN`: sin filtro de empresa, `Rol` viaja `null` en cada fila (D9, confirmado).
- [x] 2.3 Rama no-`SUPERADMIN`: `401` si no hay empresa activa; filtro a usuarios con fila `UsuarioEmpresa` en esa empresa.
- [x] 2.4 Registrado con `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.ADMINISTRADOR_EMPRESA), nameof(UserRole.SUPERADMIN)))` — GET es la única excepción con `SUPERADMIN` (D10/D3); las otras 4 solo `ADMINISTRADOR_EMPRESA`.

## 3. POST /api/users — alta (RN-USR-005)

- [x] 3.1 `Features/Users/CrearUsuario/{Command,Endpoint,Handler,Validator}.cs` — guard manual `401` (empresa activa exigida en el endpoint, no `RequireEmpresaActivaFilter`, para que el mensaje coincida exactamente con `"Sesión sin empresa activa"` del mock), valida `nombre`/`apellido`/`email` no vacíos, `rol` opcional (default `OPERARIO`), excluye `SUPERADMIN` del enum aceptado, exige `areaId`+`areaIds` no vacío si `rol === SUPERVISOR` (diseño D4).
- [x] 3.2 Validación de `avatarBase64` (RN-USR-007): prefijo `data:image/jpeg;base64,` o `data:image/png;base64,`, tamaño decodificado ≤ 2MB → `400` si no cumple.
- [x] 3.3 Handler: valida unicidad de email en dos variantes (mismo `409` vs. `409` con mensaje de "contacta a un Superadmin" — diseño D4); crea `ShacUser` vía `userManager.CreateAsync(user, temporaryPassword)` + fila `UsuarioEmpresa` (`Estado: ACTIVO`) en la misma operación.
- [x] 3.4 Red de seguridad: si `CreateAsync` devuelve `IdentityError.Code == "DuplicateUserName"` pese al pre-check, traducir a `409 "El email ya está en uso"` (TOCTOU, diseño D4/Riesgos).
- [x] 3.5 Respuesta `201` aplanada (`CrearUsuarioResponse`: `UserDto` + `temporaryPassword` al mismo nivel, igual que `{ ...stripPassword(newUser), temporaryPassword }` del mock).
- [x] 3.6 Registrado con el mismo `.RequireRole(nameof(UserRole.ADMINISTRADOR_EMPRESA))` que 2.4.

## 4. PATCH /api/users/:id — edición (RN-USR-006, RN-EMP-002)

- [x] 4.1 `Features/Users/ActualizarUsuario/{Command,Endpoint,Handler,Validator}.cs` — guard `401` si no hay empresa activa, `404` si el usuario no tiene fila `UsuarioEmpresa` en ella (diseño D2).
- [x] 4.2 Actualiza parcialmente `nombre`/`apellido`/`email`/`areaId`/`areaIds`/`avatarUrl` en `ShacUser`; valida unicidad de `email` excluyendo al propio usuario (chequeo antes de mutar nada, para que un `409` no aplique ningún cambio parcial).
- [x] 4.3 Si el body incluye `rol`: actualizar únicamente la fila `UsuarioEmpresa` de `(usuarioId, empresaActivaDelActor)` — **nunca** un campo de `ShacUser` (diseño D5, bug ya documentado en el mock).
- [x] 4.4 Nunca tocar `Activo` ni el password desde este endpoint.
- [x] 4.5 Registrado con el mismo `.RequireRole(...)` que 2.4/3.6.

## 5. PATCH /api/users/:id/toggle-active (RN-USR-001, RN-USR-003)

- [x] 5.1 `Features/Users/ToggleActivoUsuario/{Endpoint,Handler}.cs` — mismo guard `401`/`404` que 4.1.
- [x] 5.2 Alternar `ShacUser.Activo` sin ninguna validación de bloqueo (diseño D6 — a diferencia de Área/Local/Zona). No tocar password ni otros campos.
- [x] 5.3 Registrado con el mismo `.RequireRole(...)`.

## 6. POST /api/users/:id/reset-password (RN-USR-004)

- [x] 6.1 `Features/Users/ResetPasswordUsuario/{Endpoint,Handler}.cs` — mismo guard `401`/`404`.
- [x] 6.2 Generar contraseña temporal (helper 1.1) y aplicarla vía `userManager.RemovePasswordAsync` + `userManager.AddPasswordAsync` (diseño D7).
- [x] 6.3 Responder `{ temporaryPassword }`; no tocar `PinHash` (distinto de `ResetPin`).
- [x] 6.4 Registrado con el mismo `.RequireRole(...)`.

## 7. Registro de endpoints

- [x] 7.1 Agregar sección "Users" en `Extensions/EndpointExtensions.cs` (`MapFeatureEndpoints` + `AddFeatureHandlers`), registrando los 5 endpoints nuevos, paralela a "Auth"/"Empresas"/"Areas".

## 8. Tests

- [x] 8.1 Tests de listado: scoping por empresa activa, `SUPERADMIN` ve todo el sistema sin filtro (`Rol: null`), filtros `?rol=`/`?activo=`, rol reflejado desde `UsuarioEmpresa` (mismo usuario con rol distinto en dos empresas → dos respuestas distintas). (`401` sin empresa activa no aplica a `ADMINISTRADOR_EMPRESA` — ver nota en 8.2.)
- [x] 8.2 Tests de alta: éxito, rol por defecto `OPERARIO`, fila `UsuarioEmpresa` creada permite login inmediato, `SUPERVISOR` sin áreas → `400`, `rol: SUPERADMIN` → `400`, email duplicado misma empresa → `409`, email duplicado otra empresa → `409` con mensaje distinto, avatar inválido (mime/tamaño) → `400`, `401` sin empresa activa (JWT firmado directamente vía `JwtTokenService` con rol `ADMINISTRADOR_EMPRESA` y `empresaActivaId: null` — el login real nunca resuelve ese estado para un rol no-`SUPERADMIN`, `SessionResolver` lo impide por construcción).
- [x] 8.3 Tests de edición: éxito, cambio de rol no se filtra entre empresas (test explícito del bug ya documentado), `404` cross-tenant, email duplicado → `409`, no toca `Activo` ni password, `401` sin empresa activa.
- [x] 8.4 Tests de baja/reactivación: éxito, reactivación conserva password, `404` cross-tenant, `401` sin empresa activa. (Sin caso de "referencias activas" — D6 no cuenta QE/NC/Incidente/AC, a diferencia de Área/Local/Zona; no hay nada que bloquear.)
- [x] 8.5 Tests de reset de contraseña: éxito (login con la nueva contraseña), no toca `PinHash`, `404` cross-tenant, `401` sin empresa activa.
- [x] 8.6 Tests de rol: `403` para cualquier rol distinto de `ADMINISTRADOR_EMPRESA` en los 5 endpoints; `SUPERADMIN` recibe `403` en `POST /api/users` (y por construcción en las otras 3 operaciones por-id, mismo `RequireRole`).
- [x] 8.7 Confirmado con la suite completa (`dotnet test`, 341/341): `Features/Empresas/{AsignarUsuarioEmpresa,ActualizarAsignacion,ListarUsuariosEmpresa,ResetPin}` y `Features/Auth/{Login,SetPin}` siguen pasando sin cambios de comportamiento.

## 9. Verificación

- [x] 9.1 `dotnet build` limpio (Domain/Infrastructure/Host/Tests).
- [x] 9.2 `dotnet test` ejecutado directamente en este entorno (ver 0.3): 341/341 pruebas correctas, incluidas las 35 nuevas de `Features/Users`.
- [x] 9.3 Implementación final consistente con D9 (`Rol: null` para `SUPERADMIN`) y D10 (`ADMINISTRADOR_EMPRESA` único rol autorizado) — confirmado en 0.1/0.2 y verificado explícitamente en los tests de 8.1/8.6.
