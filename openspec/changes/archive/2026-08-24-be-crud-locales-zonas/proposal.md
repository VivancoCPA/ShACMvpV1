## Why

`ShcMvpEndPoint` expone hoy Áreas y Locales/Zonas en modo exclusivamente de solo lectura (`be-areas-catalogo`, `be-locales-zonas-lectura`) — no existe ningún endpoint de escritura (`Features/Locales/CrearLocal` no existe, y `Features/Areas/` solo tiene `ListarAreas`/`ObtenerArea`). El frontend (`shc-controldoc`) ya tiene el CRUD administrativo completo de M6 construido contra MSW (creación, edición, desactivación con validación de referencias cruzadas, reactivación, plano PNG de Local) — sin el backend real, ese CRUD no puede pasar de mock a producción. Este cambio construye la contraparte real en `.NET`, reemplazando el solo-lectura actual.

## What Changes

- Nuevos endpoints de escritura para Áreas: `POST /api/areas`, `PATCH /api/areas/:id`, `PATCH /api/areas/:id/desactivar`, `PATCH /api/areas/:id/reactivar`.
- Nuevos endpoints de escritura para Locales: `POST /api/locales` (JSON o `multipart/form-data` con plano PNG), `PATCH /api/locales/:id`, `PATCH /api/locales/:id/desactivar`, `PATCH /api/locales/:id/reactivar`.
- Nuevos endpoints de escritura para Zonas: `POST /api/locales/:id/zonas`, `PATCH /api/zonas/:id`, `PATCH /api/zonas/:id/desactivar`, `PATCH /api/zonas/:id/reactivar`.
- Nueva entidad `EmpresaSecuencia` reutilizada (ya existe en el dominio, ya usada por Incidentes/NC/QE) para generar `LOC-NNN`/`ZON-NNN` de forma atómica, en vez del patrón `COUNT(*)` no seguro bajo concurrencia que usa el mock.
- Nuevo índice único `(EmpresaId, Codigo)` sobre `Local` y `Zona` (no existía).
- Primer endpoint de upload de archivo real del backend (`planoUrl` en el multipart de `POST`/`PATCH /api/locales/:id`), con almacenamiento en disco local servido como estático.
- Validación de reglas de negocio contra datos en vivo (reemplaza los stores en memoria del mock): RN-ARE-001 (bloqueo de Área por QE/NC/Incidentes no-terminales), RN-ARE-004 (unicidad de nombre de Área), RN-LOC-001 (máx. 5 Locales activos por empresa, aplica también a reactivación), RN-LOC-002/RN-ZON-002 (bloqueo por Incidentes no-terminales), RN-LOC-003 (plano PNG ≤2MB), RN-ARE-002/RN-ZON-003 (sin límite de cantidad).
- Los endpoints de lectura existentes (`GET /api/areas`, `GET /api/areas/:id`, `GET /api/locales`, `GET /api/locales/:localId/zonas`) no cambian de comportamiento.

## Capabilities

### Modified Capabilities
- `be-areas-catalogo`: agrega creación, edición, desactivación (con validación de referencias cruzadas QE/NC/Incidentes) y reactivación de Áreas — elimina el requirement "Sin mutaciones de Áreas en este alcance" que declaraba esto fuera de alcance.
- `be-locales-zonas-lectura`: agrega creación, edición, desactivación, reactivación y upload de plano PNG para Locales, y creación/edición/desactivación/reactivación de Zonas — elimina el requirement "Sin mutaciones de Locales/Zonas en este alcance" que declaraba esto fuera de alcance.

## Impact

- **Código afectado**: `ShcMvpEndPoint/Features/Areas/*` (endpoints nuevos), `ShcMvpEndPoint/Features/Locales/*` (endpoints nuevos), `ShcMvpEndPoint.Domain/Entities/Area.cs` / `Local.cs` / `Zona.cs` (sin cambios de esquema en campos, solo índices nuevos vía migración), `ShacDbContext.OnModelCreating` (índices únicos de `Codigo`), `Program.cs` (registro de nuevos endpoints, `UseStaticFiles` para el plano), nueva migración EF Core.
- **Dependencias existentes reutilizadas sin cambios**: `EmpresaSecuencia`, `ClaimsPrincipalExtensions`/`RequireEmpresaActivaFilter` (multi-tenancy), patrón `ValidationFilter<TCommand>` + FluentValidation ya establecido en NoConformidades/Incidentes/QualityEvents.
- **No afectado**: `GET /api/areas`, `GET /api/areas/:id`, `GET /api/locales`, `GET /api/locales/:localId/zonas` (comportamiento sin cambios); ningún campo nuevo en las entidades de dominio.
- **Fuera de alcance**: `dotnet test` no se ejecuta en este entorno (sin SDK .NET/NuGet) — Toño corre las pruebas en su máquina y reporta el resultado textual.
