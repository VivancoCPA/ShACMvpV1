## 1. Fix de tipos — ShacUser.AreaId/AreaIds

- [x] 1.1 Cambiar `ShacUser.AreaId` de `Guid?` a `string?` y `ShacUser.AreaIds` de `List<Guid>` a `List<string>` (`ShcMvpEndPoint.Infrastructure/Identity/ShacUser.cs`), actualizando los comentarios que documentan el propósito de esos campos.
- [x] 1.2 Actualizar `UserDto` y `UserDto.From` (`Features/Auth/AuthDtos.cs`) para que `AreaId`/`AreaIds` sean `string?`/`List<string>`.
- [x] 1.3 Grep exhaustivo de `.AreaId`/`.AreaIds` sobre `ShacUser`/`UserDto` en todo `ShcMvpEndPoint/` (incluyendo tests) para confirmar que `EditarReporteInicialQEHandler.cs` es el único otro consumidor real — documentar en el resumen final cualquier otro punto encontrado que no esté ya cubierto por esta lista.
- [x] 1.4 Simplificar la comparación en `EditarReporteInicialQEHandler.HandleAsync` (RN-QE-014) a `actor?.AreaIds.Contains(qe.AreaId) == true`, y borrar el comentario de "gap conocido" (líneas 36-40 actuales).

## 2. Migración EF Core

- [x] 2.1 Generar la migración `FixShacUserAreaIdTypesAndAddPinHash` (`dotnet ef migrations add`) con: `DropColumn`+`AddColumn<string>("area_id")`, `DropColumn`+`AddColumn<List<string>>("area_ids")` (mapea a `text[]`), y `AddColumn<string>("pin_hash", nullable: true)` — ver design.md D2/D4.
- [x] 2.2 Verificar el `Designer.cs`/`ModelSnapshot` generado: `area_id` como `text`, `area_ids` como `text[]`, `pin_hash` como `text` nullable.
- [x] 2.3 Correr la migración contra el entorno de test (Testcontainers) para confirmar que aplica sin error.

## 3. Infraestructura de PIN — modelo y autogestión

- [x] 3.1 Agregar `ShacUser.PinHash: string?` con un comentario breve explicando su propósito (PIN de firma de cierre de QE, distinto de `PasswordHash`).
- [x] 3.2 Crear `Features/Auth/SetPin/SetPinCommand.cs` (`record SetPinCommand(string Password, string Pin)`).
- [x] 3.3 Crear `Features/Auth/SetPin/SetPinValidator.cs` (FluentValidation): `Password` no vacío, `Pin` matchea `^\d{4}$`.
- [x] 3.4 Crear `Features/Auth/SetPin/SetPinHandler.cs`: reautentica con `userManager.CheckPasswordAsync` (mismo patrón que `ChangePasswordHandler`), y si es válida, `user.PinHash = hasher.HashPassword(user, command.Pin)` usando `IPasswordHasher<ShacUser>` inyectado.
- [x] 3.5 Crear `Features/Auth/SetPin/SetPinEndpoint.cs`: `POST /api/auth/set-pin`, `RequireAuthorization()`, mismo patrón de `ChangePasswordEndpoint` (filtro de validación, `ClaimsPrincipal` para el usuario actual).
- [x] 3.6 Registrar `SetPinEndpoint.Map(app)` en `Extensions/EndpointExtensions.cs`, junto a los demás endpoints de `/api/auth/*`.

## 4. Infraestructura de PIN — reset por administrador

- [x] 4.1 Crear `Features/Empresas/ResetPin/ResetPinHandler.cs`: valida que exista una fila `UsuarioEmpresa` para `(usuarioId, empresaId)` (404 si no), y limpia `PinHash = null` del `ShacUser` correspondiente.
- [x] 4.2 Crear `Features/Empresas/ResetPin/ResetPinEndpoint.cs`: `PATCH /api/empresas/{id:guid}/usuarios/{usuarioId:guid}/reset-pin`, `RequireAuthorization(p => p.RequireRole(nameof(UserRole.SUPERADMIN)))` (mismo gate que `ActualizarAsignacionEndpoint`).
- [x] 4.3 Registrar `ResetPinEndpoint.Map(app)` en `Extensions/EndpointExtensions.cs`, junto a los demás endpoints de `/api/empresas/*`.

## 5. Validación real del PIN en la firma de cierre

- [x] 5.1 Inyectar `IPasswordHasher<ShacUser>` en `FirmarCierreQEHandler` y buscar al actor (`db.Users.FirstOrDefaultAsync(u => u.Id == actorId, ct)`) antes de procesar cualquiera de las dos firmas.
- [x] 5.2 Si `actor.PinHash is null`, lanzar `BusinessRuleException` con mensaje claro indicando que debe configurar su PIN primero (`POST /api/auth/set-pin`).
- [x] 5.3 Si `hasher.VerifyHashedPassword(actor, actor.PinHash, command.Pin)` no es exitoso, lanzar `UnauthorizedBusinessException("PIN incorrecto")`.
- [x] 5.4 Actualizar el comentario en `FirmarCierreQECommand.cs` (líneas 5-6 actuales) que documentaba el gap conocido — ya no aplica.
- [x] 5.5 Aplicar la misma validación a ambas firmas (primera y segunda), no solo una.

## 6. Tests

- [x] 6.1 Agregar un test a la suite de RN-QE-014 (`QualityEventsEditarReporteInicialEndpointTests.cs` o el archivo equivalente que cubra ese endpoint) para "Supervisor con el área correcta en `AreaIds` puede editar el reporte inicial fuera de ser el reportante" — si existía un test previo que esperaba `false` por el bug, corregirlo para expresar el comportamiento correcto.
- [x] 6.2 Actualizar `QualityEventsCierreEndpointTests.cs`: en cada test que firma cierre (`FirmarCierre_FlujoCompleto_DosUsuariosDistintos_CompletaCierre`, `FirmarCierre_MismoUsuarioParaAmbasFirmas_Devuelve422`), configurar el PIN real de cada usuario firmante vía `POST /api/auth/set-pin` antes de firmar, en vez de depender de un PIN arbitrario no validado.
- [x] 6.3 Agregar test: firma con PIN incorrecto responde 401 sin registrar la firma.
- [x] 6.4 Agregar test: firma sin PIN configurado responde con el mensaje de negocio esperado (no 500).
- [x] 6.5 Agregar tests para `POST /api/auth/set-pin`: primera configuración exitosa, cambio de PIN exitoso, contraseña actual incorrecta (401), formato de PIN inválido (400).
- [x] 6.6 Agregar tests para `PATCH /api/empresas/{id}/usuarios/{usuarioId}/reset-pin`: reset exitoso por `SUPERADMIN` (y que el PIN anterior deja de servir), 403 para rol no autorizado, 404 si el usuario no tiene asignación en esa empresa.

## 7. Verificación final

- [x] 7.1 Correr `dotnet test` sobre toda la suite y confirmar que no hay regresiones fuera de los archivos tocados.
- [x] 7.2 Actualizar/generar el `SESSION-SUMMARY` correspondiente a este cambio, documentando el resultado de `dotnet test` para verificación independiente de Cowork.
