## Context

Verificación independiente (Cowork, 2026-08-20) contra el código real del backend .NET confirmó dos gaps de `be-quality-events`, ya archivado y confirmado por Toño:

1. `ShacUser.AreaId: Guid?` / `ShacUser.AreaIds: List<Guid>` (`Infrastructure/Identity/ShacUser.cs`) no calzan con `Area.Id: string` (formato `"area-XXX"`, catálogo de M9/be-areas-catalogo) ni con `QualityEvent.AreaId`/`Incidente.AreaId`/`NoConformidad.AreaId`, todos `string`. `EditarReporteInicialQEHandler.HandleAsync` (RN-QE-014) hace `actor?.AreaIds.Any(a => a.ToString() == qe.AreaId)`, que nunca puede ser `true` — el `Guid.ToString()` jamás coincide con `"area-XXX"`. Confirmado también contra el frontend real (`auth.types.ts`, `userManagement.types.ts`, `auth.fixtures.ts`): `areaId`/`areaIds` siempre fueron `string`/`string[]` ahí, nunca GUIDs — el tipo del backend fue un error de la primera sesión de scaffolding de Auth, previa a que existiera el catálogo de Áreas.
2. `FirmarCierreQECommand(UserRole Rol, string Pin)` — `Pin` nunca se valida contra nada en `FirmarCierreQEHandler`. No existe infraestructura de PIN por usuario en ningún lugar del proyecto: ni un campo en `ShacUser`, ni pantalla de configuración en el frontend (`ProfilePage`/`UserFormModal`), ni verificación real en `firmarCierre.schema.ts` (solo valida formato `z.string().length(4)`). Hay que diseñarla desde cero.

Ambos fixes tocan `ShacUser`/Auth, así que van en un solo `openspec/changes/` — separarlos habría significado dos migraciones EF Core sobre la misma tabla en cambios distintos sin ninguna ventaja real (ninguno de los dos depende del otro funcionalmente, pero ambos son "bajo riesgo, mismo archivo").

## Goals / Non-Goals

**Goals:**
- `ShacUser.AreaId`/`AreaIds` en `string`/`List<string>`, calzando con `Area.Id` y con RN-QE-014 funcionando de verdad.
- Infraestructura de PIN de firma: autogestión (configurar/cambiar) y reset por administrador, con validación real en `FirmarCierreQEHandler`.

**Non-Goals:**
- No se agrega FK real Área↔Usuario (mismo criterio que `Incidente.AreaId`: sin FK enforcement todavía).
- No se conecta el PIN a ningún flujo fuera de la firma de cierre de QE (no hay evidencia de otro consumidor).
- No se implementa recuperación de PIN por email/SMS — el reset por admin cubre el caso de olvido.
- No se agrega lockout/rate-limiting por intentos fallidos de PIN — mismo nivel de protección que `ChangePasswordHandler` tiene hoy contra `CurrentPassword` incorrecta (ninguno). Si se decide necesario, es un cambio aparte que aplicaría a ambos flujos por igual.
- No se toca el frontend: no existe pantalla de configuración de PIN hoy y agregarla queda fuera de alcance de este cambio (solo backend, según instrucción explícita de Cowork).

## Decisions

### D1 — `AreaId`/`AreaIds`: cambio de tipo, no solo de columna
`ShacUser.AreaId` pasa a `string?`, `ShacUser.AreaIds` a `List<string>`. `UserDto` (`Features/Auth/AuthDtos.cs`) se actualiza igual, porque `UserDto.From` los copia directo desde `ShacUser`. No se toca `Area.Id` (ya es `string`, correcto) ni `Incidente.AreaId`/`NoConformidad.AreaId`/`QualityEvent.AreaId` (ya son `string`).

### D2 — Migración: drop + recreate de columnas, no `ALTER COLUMN TYPE`
Postgres no tiene cast implícito ni de asignación de `uuid`/`uuid[]` a `text`/`text[]` — un `ALTER COLUMN ... TYPE text` plano falla sin una cláusula `USING`. Como los valores GUID actuales (si existieran en algún ambiente sembrado) nunca correspondieron a ningún `Area.Id` real — el chequeo de RN-QE-014 nunca funcionó, así que ningún dato productivo depende de esos valores —, la migración hace `DropColumn` + `AddColumn` con el tipo nuevo (`text` / `text[]`), en vez de intentar preservar/castear valores que de todos modos no tienen sentido. Alternativa descartada: `ALTER COLUMN ... TYPE text USING area_id::text` — técnicamente posible para `AreaId` (un GUID sí serializa a texto), pero no resuelve nada útil porque el string resultante (`"3fa85f64-..."`) tampoco matchea ningún `Area.Id` real; simplemente arrastra basura. Drop+recreate es más simple y deja el estado post-migración limpio (`AreaId: null`, `AreaIds: []]` para todo usuario existente, que es exactamente el estado correcto para un campo que nunca tuvo un valor válido).

### D3 — RN-QE-014: simplificación de la comparación
`EditarReporteInicialQEHandler` pasa de `actor?.AreaIds.Any(a => a.ToString() == qe.AreaId) == true` a `actor?.AreaIds.Contains(qe.AreaId) == true`. Se borra el comentario de "gap conocido" (líneas 36-40 actuales), ya no aplica.

### D4 — PIN: campo propio hasheado, reutilizando `IPasswordHasher<ShacUser>`
`ShacUser.PinHash: string?` (null = sin PIN configurado). Se reutiliza `IPasswordHasher<ShacUser>` — ya registrado por ASP.NET Identity y es el mismo mecanismo que usa internamente `UserManager` para `PasswordHash` — en vez de introducir un hasher nuevo (bcrypt, etc.). Es una tabla/columna nueva de una sola propiedad, no amerita una abstracción propia.

### D5 — Autogestión: un solo endpoint para "configurar" y "cambiar"
`POST /api/auth/set-pin` con body `{ password, pin }` sirve tanto para la primera configuración como para un cambio posterior — no hay distinción de "modo" porque, a diferencia de un cambio de contraseña, no existe un PIN anterior que pedir como confirmación la primera vez; la contraseña actual cumple ese rol de reautenticación en ambos casos por igual. Alternativa descartada: separar en `POST /set-pin` (primera vez) / `POST /change-pin` (con PIN anterior) — más superficie de API para una distinción que no cambia la lógica de negocio ni la respuesta.
- Validación: `pin` debe matchear `^\d{4}$` (mismo criterio de formato que `firmarCierre.schema.ts` del frontend).
- Handler: reautentica con `userManager.CheckPasswordAsync(user, command.Password)` (mismo patrón que `ChangePasswordHandler`), y si es válida, `user.PinHash = hasher.HashPassword(user, command.Pin)`.

### D6 — Reset por admin: mismo patrón de autorización que `ActualizarAsignacion`/`AsignarUsuarioEmpresa`
El único patrón existente en el proyecto para "un admin actúa sobre otro usuario" es `RequireAuthorization(p => p.RequireRole(nameof(UserRole.SUPERADMIN)))` bajo `/api/empresas/{id:guid}/usuarios/{usuarioId:guid}` (`ActualizarAsignacionEndpoint`, `AsignarUsuarioEmpresaEndpoint`). Se replica ese mismo patrón en vez de introducir `ADMINISTRADOR_SISTEMA` como gate nuevo: `PATCH /api/empresas/{empresaId:guid}/usuarios/{usuarioId:guid}/reset-pin`, exclusivo de `SUPERADMIN`, verificando además que exista una fila `UsuarioEmpresa` para `(usuarioId, empresaId)` (mismo scoping que las otras acciones de ese namespace). Deja `PinHash = null` — el usuario configura uno nuevo la próxima vez que firme un cierre, mismo espíritu que un reset de password que fuerza elegir una nueva sin que el admin la conozca.
- Se descarta gatear con `ADMINISTRADOR_SISTEMA` (el rol que sí tiene ese alcance en el modelo RBAC del frontend, ver CLAUDE.md) porque ese rol y sus endpoints de gestión de usuarios (M6) **no existen todavía en este backend** — no hay ningún precedente real que replicar ahí. Cuando M6 se implemente en el backend, este endpoint es candidato a moverse/duplicarse bajo esa superficie; por ahora sigue el único patrón de autorización "admin sobre otro usuario" que sí existe.

### D7 — Validación de PIN en `FirmarCierreQEHandler`
Antes de aceptar cualquiera de las dos firmas (no solo la primera), el handler:
1. Busca al actor (`db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct)`, mismo patrón ya usado en `EditarReporteInicialQEHandler`).
2. Si `actor.PinHash is null` → `BusinessRuleException("Debés configurar tu PIN de firma antes de firmar un cierre (POST /api/auth/set-pin)")`.
3. Si `hasher.VerifyHashedPassword(actor, actor.PinHash, command.Pin)` no es `Success`/`SuccessRehashNeeded` → `UnauthorizedBusinessException("PIN incorrecto")`.
4. Recién después de esa validación continúa con la lógica existente de primera/segunda firma.

## Risks / Trade-offs

- [El drop+recreate de `AreaId`/`AreaIds` pierde cualquier valor sembrado manualmente en un ambiente de desarrollo] → aceptable: esos valores nunca fueron válidos (ningún `Area.Id` real es un GUID), y no hay ambiente productivo todavía.
- [Sin lockout por intentos fallidos de PIN, alguien con la sesión JWT de otro usuario podría intentar fuerza bruta sobre 4 dígitos] → mismo nivel de exposición que ya existe hoy para `ChangePasswordHandler`/`CurrentPassword`; no es una regresión introducida por este cambio, y agregar lockout es una mejora transversal fuera de alcance aquí (ver Non-Goals).
- [Cambiar `UserDto.AreaId`/`AreaIds` de `Guid?`/`List<Guid>` a `string?`/`List<string>` es un cambio de contrato JSON **BREAKING**] → sin impacto real conocido: el frontend real ya trata esos campos como `string`/`string[]` (nunca los parseó como GUID), así que el contrato "documentado" implícitamente ya esperaba este tipo.

## Migration Plan

1. Migración EF Core (`dotnet ef migrations add FixShacUserAreaIdTypesAndAddPinHash`): `DropColumn("area_id")` + `AddColumn<string>("area_id")`, `DropColumn("area_ids")` + `AddColumn<List<string>>("area_ids")` (mapeado a `text[]`), y `AddColumn<string>("pin_hash", nullable: true)`.
2. Sin rollback especial más allá del `Down()` estándar generado por EF Core — no hay dato productivo en juego (ver Risks).
3. Tests: actualizar `QualityEventsCierreEndpointTests` para configurar un PIN real (`POST /api/auth/set-pin`) antes de firmar, y agregar los casos nuevos de PIN incorrecto/no configurado. Agregar un test a la suite de RN-QE-014 (probablemente `QualityEventsEditarReporteInicialEndpointTests` o equivalente) para "Supervisor con el área correcta en `AreaIds` puede editar el reporte inicial".

## Open Questions

Ninguna — las decisiones de mecanismo, autogestión vs. admin, y patrón de autorización ya fueron tomadas por Toño o resueltas por precedente directo en el código (D6).
