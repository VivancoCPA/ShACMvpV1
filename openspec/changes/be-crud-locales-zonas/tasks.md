## 1. Esquema y migración

- [x] 1.1 Agregar `entity.HasIndex(e => new { e.EmpresaId, e.Codigo }).IsUnique()` para `Local` y `Zona` en `ShacDbContext.OnModelCreating`.
- [x] 1.2 Migración `20260824152702_AddLocalZonaCodigoUniqueIndex` generada y aplicada directamente contra `shac_dev` (Postgres en `localhost:5435`) con `dotnet ef database update` — este entorno sí tiene SDK .NET + `dotnet-ef` + Docker, a diferencia del supuesto original de la propuesta.

## 2. Infraestructura compartida

- [x] 2.1 Crear `LocalZonaNumeroGenerator` (`Features/Locales/Shared/`), mismo mecanismo atómico que `NoConformidadNumeroGenerator` (`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` sobre `empresa_secuencias`), con `Tipo = "LOCAL"` / `"ZONA"` y `Anio` fijado a `0`. Formato de salida `LOC-{valor:D3}` / `ZON-{valor:D3}`.
- [x] 2.2 Crear un helper de generación de `Area.Id` para creaciones CRUD: `$"area-{Guid.NewGuid():N}"[..17]` (diseño D4).
- [x] 2.3 Agregar `app.UseStaticFiles()` a `Program.cs` (antes de `app.MapFeatureEndpoints()`); confirmar que `wwwroot/` existe o se crea en el primer upload.
- [x] 2.4 Crear un helper de validación de plano PNG reutilizable (`ContentType == "image/png"` exacto, `Length <= 2MB`) para usarlo en `CrearLocal`/`ActualizarLocal` (RN-LOC-003, mismo umbral que `validatePlano()` del mock).
- [x] 2.5 Crear un helper compartido de "leer y validar manualmente" para los dos endpoints multipart-o-JSON (`CrearLocal`/`ActualizarLocal`): detecta `request.HasFormContentType`, arma el `Command` desde form o JSON, invoca `IValidator<TCommand>` manualmente y devuelve el mismo shape `ApiResponse.Fail` de 400 que `ValidationFilter<T>` en caso de error (diseño D7).

## 3. Áreas — endpoints de escritura

- [x] 3.1 `Features/Areas/CrearArea/{Command,Endpoint,Handler,Validator}.cs` — `POST /api/areas`, `RequireRole(ADMINISTRADOR_SISTEMA)`, `RequireEmpresaActivaFilter`, valida unicidad de `nombre` case-insensitive (RN-ARE-004) → `409` si colisiona, sin límite de cantidad (RN-ARE-002), `Id` vía helper 2.2, `empresaId` del JWT.
- [x] 3.2 `Features/Areas/ActualizarArea/...` — `PATCH /api/areas/:id`, actualización parcial de `nombre`/`descripcion`, revalida unicidad si `nombre` cambia (excluyendo el propio registro), `404` si no existe en la empresa activa.
- [x] 3.3 `Features/Areas/DesactivarArea/...` — `PATCH /api/areas/:id/desactivar`, conteo cruzado QE/NC/Incidentes no-terminales scoped por `EmpresaId` del Área (diseño D5, sets de estados exactos por dominio) → `409` con `{ conteo: { qe, nc, incidentes, total } }` si bloquea, `200` con `activo: false` si no.
- [x] 3.4 `Features/Areas/ReactivarArea/...` — `PATCH /api/areas/:id/reactivar`, sin validación de cupo.
- [x] 3.5 Registrar los 4 endpoints con `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.ADMINISTRADOR_SISTEMA)))` (diseño D9) — nunca `.RequireAuthorization()` sin rol.

## 4. Locales — endpoints de escritura

- [x] 4.1 `Features/Locales/CrearLocal/{Command,Endpoint,Handler,Validator}.cs` — `POST /api/locales`, dual JSON/multipart (diseño D7), valida cupo de 5 activos por empresa (RN-LOC-001) → `400` si ya hay 5, valida plano si viene (helper 2.4) → `400` si inválido, `codigo` vía `LocalZonaNumeroGenerator`, `empresaId` del JWT.
- [x] 4.2 `Features/Locales/ActualizarLocal/...` — `PATCH /api/locales/:id`, dual JSON/multipart, actualiza `nombre`/`direccion` y reemplaza `planoPngUrl` si viene archivo nuevo válido, nunca permite tocar `empresaId`, `404` cross-tenant.
- [x] 4.3 `Features/Locales/DesactivarLocal/...` — `PATCH /api/locales/:id/desactivar`, conteo de Incidentes en `ABIERTO`/`EN_INVESTIGACION` scoped por `EmpresaId` del Local (RN-LOC-002, diseño D6) → `409` si bloquea.
- [x] 4.4 `Features/Locales/ReactivarLocal/...` — `PATCH /api/locales/:id/reactivar`, revalida cupo de 5 activos (RN-LOC-001 aplica también aquí) → `400` si ya hay 5.
- [x] 4.5 Implementar el almacenamiento del plano en disco (`wwwroot/uploads/planos/{empresaId}/{Guid}.png`, diseño D8), devolviendo `planoPngUrl` como URL relativa.
- [x] 4.6 Registrar los 4 endpoints con `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.ADMINISTRADOR_SISTEMA)))`.

## 5. Zonas — endpoints de escritura

- [x] 5.1 `Features/Locales/CrearZona/{Command,Endpoint,Handler,Validator}.cs` — `POST /api/locales/:id/zonas`, `404` si el Local de la ruta no existe en la empresa activa, `EmpresaId`/`LocalId` heredados del Local (nunca del body), sin límite de cantidad (RN-ZON-003), `codigo` vía `LocalZonaNumeroGenerator`.
- [x] 5.2 `Features/Zonas/ActualizarZona/...` — `PATCH /api/zonas/:id`, actualiza `nombre`/`descripcion`, `404` cross-tenant.
- [x] 5.3 `Features/Zonas/DesactivarZona/...` — `PATCH /api/zonas/:id/desactivar`, conteo de Incidentes en `ABIERTO`/`EN_INVESTIGACION`/`EN_EJECUCION` scoped por `EmpresaId` de la Zona (RN-ZON-002, diseño D6 — set distinto al de Local) → `409` si bloquea.
- [x] 5.4 `Features/Zonas/ReactivarZona/...` — `PATCH /api/zonas/:id/reactivar`, sin validación de cupo.
- [x] 5.5 Registrar los 5 endpoints (incluido `CrearZona`) con `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.ADMINISTRADOR_SISTEMA)))`.

## 6. Tests

- [x] 6.1 Tests de Áreas: creación exitosa, sin límite de cantidad, unicidad de nombre (creación y edición, incluyendo el caso "editar sin cambiar nombre"), edición 404 cross-tenant, desactivación bloqueada por cada dominio (QE/NC/Incidente) individualmente y combinados, desactivación exitosa, aislamiento multi-tenant del conteo de bloqueo, reactivación sin validación de cupo, 403 para roles distintos de `ADMINISTRADOR_SISTEMA` en cada mutación.
- [x] 6.2 Tests de Locales: creación JSON y multipart, cupo de 5 activos (creación y reactivación) por empresa (no global), validación de plano (tipo incorrecto, tamaño excedido, reemplazo en edición), edición no permite tocar `empresaId`, desactivación bloqueada/no bloqueada por Incidentes (`ABIERTO`/`EN_INVESTIGACION`), 404 cross-tenant, 403 para roles distintos de `ADMINISTRADOR_SISTEMA`.
- [x] 6.3 Tests de Zonas: creación sin límite, `404` si el Local de la ruta no existe en la empresa activa, edición, desactivación bloqueada específicamente por `EN_EJECUCION` (el estado que distingue el set de Zona del de Local), desactivación no bloqueada, reactivación sin cupo, 403 para roles distintos de `ADMINISTRADOR_SISTEMA`.
- [x] 6.4 Test de concurrencia (o al menos de no-colisión) para `LocalZonaNumeroGenerator`: dos creaciones consecutivas en la misma empresa generan códigos distintos.
- [x] 6.5 Confirmar que los endpoints de lectura existentes (`GET /api/areas`, `GET /api/areas/:id`, `GET /api/locales`, `GET /api/locales/:localId/zonas`) siguen pasando sin cambios de comportamiento.

## 7. Verificación

- [x] 7.1 (Revisado en ejecución) Este entorno sí tenía SDK .NET + `dotnet-ef` + Docker/Postgres — no fue necesario delegar a Toño. Migración `20260824152702_AddLocalZonaCodigoUniqueIndex` generada y aplicada directamente contra `shac_dev`.
- [x] 7.2 (Revisado en ejecución) `dotnet build` limpio (Domain/Infrastructure/Host/Tests) y `dotnet test` corrido directamente aquí: **301/301 tests pasando**, sin regresiones en los módulos previos (Incidentes, NC, QE, Dashboard, Auth, Empresas).
- [x] 7.3 Resuelto 2026-08-24: Toño confirmó agregar `JEFE_CALIDAD_SYST` junto a `ADMINISTRADOR_SISTEMA` (no reemplazarlo) en las 12 mutaciones. Actualizado `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.ADMINISTRADOR_SISTEMA), nameof(UserRole.JEFE_CALIDAD_SYST)))` en los 12 endpoints, tests de rol ajustados (403 ahora usa `OPERARIO`, se agregaron 5 tests `ComoJefeCalidadSyst` → `200`/`201`), design.md D9 y las specs delta actualizados. `dotnet test`: **306/306 pasando**.
