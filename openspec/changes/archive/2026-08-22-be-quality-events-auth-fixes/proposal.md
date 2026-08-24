## Why

Verificación independiente de `be-quality-events` (Cowork, `claude/SHAC-Verificacion-Quality-Events-2026-08-20.md`) dejó dos gaps de bajo riesgo pendientes de corrección: (1) `ShacUser.AreaId`/`AreaIds` están tipados como `Guid`/`List<Guid>` cuando `Area.Id` (y todo lo que lo referencia — `Incidente.AreaId`, `NoConformidad.AreaId`, `QualityEvent.AreaId`) es `string` con formato `"area-XXX"`, lo que hace que el chequeo de "¿es Supervisor del área?" en `EditarReporteInicialQEHandler` (RN-QE-014) nunca pueda dar match; y (2) `FirmarCierreQEHandler` acepta un `Pin` en el comando de firma dual de cierre pero nunca lo valida contra nada — no existe infraestructura de PIN de firma en ningún lugar del proyecto (ni backend ni frontend), así que hay que diseñarla desde cero, no portarla de un mock existente.

## What Changes

- Corregir el tipo de `ShacUser.AreaId` (`Guid?` → `string?`) y `ShacUser.AreaIds` (`List<Guid>` → `List<string>`), y el `UserDto` que se arma a partir de esos campos en `/api/auth/login`/`/refresh`/`/switch-empresa`. **BREAKING** para cualquier consumidor externo del contrato JSON de `UserDto.areaId`/`areaIds` que hoy asuma formato GUID (ninguno conocido en el frontend real, que ya trata esos campos como `string`/`string[]`).
- Migración EF Core que cambia la columna `area_id` de `uuid` a `text` y `area_ids` de `uuid[]` a `text[]` en la tabla de usuarios de Identity. No hay datos productivos que preservar (los valores GUID actuales nunca correspondieron a ningún `Area.Id` real, porque el chequeo nunca funcionó).
- Simplificar la comparación en `EditarReporteInicialQEHandler` (RN-QE-014) ahora que los tipos calzan, y quitar el comentario que documentaba el gap conocido.
- Agregar infraestructura de PIN de firma propia (nuevo, no reutiliza la contraseña): campo `PinHash` hasheado en `ShacUser` (vía `IPasswordHasher<ShacUser>`, mismo mecanismo que ya usa `UserManager` para contraseñas), endpoint de autogestión `POST /api/auth/set-pin` (requiere contraseña actual como confirmación de identidad), y endpoint de reset por administrador que limpia `PinHash` (el usuario configura uno nuevo la próxima vez que lo necesite).
- `FirmarCierreQEHandler` valida `command.Pin` contra `actor.PinHash` antes de aceptar cualquiera de las dos firmas: rechaza con mensaje claro si el usuario no tiene PIN configurado, y con 401 si el PIN no coincide.

## Capabilities

### New Capabilities
- `be-firma-pin`: infraestructura de PIN de firma (autogestión, reset por admin, hasheo) y su validación real en la firma dual de cierre de Quality Event.

### Modified Capabilities
- `be-quality-events-api`: el requirement "Firma dual de cierre" gana scenarios de validación real del PIN (rechazo si no coincide, rechazo si el usuario no tiene PIN configurado).

## Impact

- `ShcMvpEndPoint.Infrastructure/Identity/ShacUser.cs`, `Features/Auth/AuthDtos.cs`, `Features/QualityEvents/EditarReporteInicialQE/EditarReporteInicialQEHandler.cs`, `Features/QualityEvents/FirmarCierreQE/FirmarCierreQECommand.cs` y `FirmarCierreQEHandler.cs`.
- Nueva migración EF Core (cambio de tipo de columna, sin FK nueva).
- Nuevos endpoints `Features/Auth/SetPin/*` y `Features/Auth/ResetPin/*` (o nombres equivalentes, a definir en design.md).
- Tests existentes en `QualityEventsCierreEndpointTests.cs` que hoy firman con un PIN arbitrario (`"1234"`/`"5678"`) sin que el sistema lo valide deben actualizarse para configurar un PIN real primero.
- No afecta al frontend (`shc-controldoc`): el formulario de firma ya envía `{ rol, pin }`, y no existe hoy ninguna pantalla de configuración de PIN — queda fuera de alcance agregarla en este cambio (solo backend).
