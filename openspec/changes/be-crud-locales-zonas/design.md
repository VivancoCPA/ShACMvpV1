## Context

`ShcMvpEndPoint` (.NET 10, VSA + Minimal APIs, CQRS Dapper-para-lecturas/EF-Core-para-escrituras) expone hoy Áreas y Locales/Zonas en modo exclusivamente de solo lectura: `Features/Areas/{ListarAreas,ObtenerArea}` y `Features/Locales/{ListarLocales,ListarZonasPorLocal}`, ambos Dapper. No existe ningún `Features/Areas/Crear*` ni `Features/Locales/Crear*`. Las entidades de dominio (`Area`, `Local`, `Zona`) ya tienen todos los campos necesarios — confirmado leyendo `ShcMvpEndPoint.Domain/Entities/{Area,Local,Zona}.cs` — así que este cambio no agrega columnas nuevas, solo endpoints de escritura, un índice único nuevo, y (para Local) el primer mecanismo de upload de archivo del backend.

El patrón de escritura ya está establecido en 5 módulos anteriores (Empresas, Incidentes, NoConformidades, QualityEvents, Auth): `Features/<Modulo>/<Accion>/{Command,Endpoint,Handler,Validator}.cs`, `ValidationFilter<TCommand>` + FluentValidation, `RequireEmpresaActivaFilter` en toda mutación scoped por empresa, `empresaId`/`actorId` resueltos del JWT vía `ClaimsPrincipalExtensions` (nunca del body), 404 (nunca 403) cross-tenant. `EmpresaSecuencia` (contador atómico `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`, ver `NoConformidadNumeroGenerator`) ya existe y es el mecanismo establecido para numeraciones correlativas sin colisión bajo concurrencia.

El frontend (`shc-controldoc`) tiene el CRUD completo de M6 (`area-admin-mocks`, `area-business-rules`, `location-form`, `location-permissions`) ya construido contra MSW — es la fuente de verdad del contrato HTTP exacto, verificada leyendo `areas.handlers.ts`, `locales.handlers.ts`, `areaBusinessRules.ts`, `localesBusinessRules.ts`, `localForm.schema.ts`, `zonaForm.schema.ts`, `areaForm.schema.ts` y `locales.api.ts` antes de escribir este documento.

## Goals / Non-Goals

**Goals:**
- CRUD completo de Área (crear, editar, desactivar con validación de referencias cruzadas QE/NC/Incidentes, reactivar) con paridad de comportamiento contra `areaBusinessRules.ts`.
- CRUD completo de Local y Zona (crear, editar, desactivar con validación de Incidentes en vivo, reactivar), incluyendo el primer upload de archivo real del backend (plano PNG de Local).
- Numeración correlativa atómica de `Local.Codigo`/`Zona.Codigo` reutilizando `EmpresaSecuencia`, en vez del `COUNT(*)` no seguro bajo concurrencia del mock.
- Mantener el patrón CQRS ya establecido (EF Core para las escrituras nuevas; los endpoints de lectura existentes no se tocan).
- Restringir las mutaciones a `ADMINISTRADOR_SISTEMA` y `JEFE_CALIDAD_SYST` (ver D9 — revisado 2026-08-24 con decisión explícita de Toño, amplía el criterio inicial basado en `puedeAdministrarAreas`/`puedeAdministrarLocales` del frontend).

**Non-Goals:**
- Cambiar el comportamiento de `GET /api/areas`, `GET /api/areas/:id`, `GET /api/locales`, `GET /api/locales/:localId/zonas` (siguen sin restricción de rol, tal como hoy).
- Agregar campos nuevos a `Area`/`Local`/`Zona` (las entidades ya están completas).
- Cualquier forma de FK enforcement entre `AreaId`/`LocalId`/`ZonaId` y las tablas de dominio que los referencian (`Incidente`, `NoConformidad`, `QualityEvent`) — se mantiene el mismo criterio "sin FK enforcement" ya usado en esas entidades.
- Ejecutar `dotnet test` (Cowork no tiene SDK .NET/NuGet en este entorno).

## Decisions

### D1 — Estructura de Features
```
Features/Areas/{CrearArea,ActualizarArea,DesactivarArea,ReactivarArea}/{Command,Endpoint,Handler,Validator}.cs
Features/Locales/{CrearLocal,ActualizarLocal,DesactivarLocal,ReactivarLocal,CrearZona}/...
Features/Zonas/{ActualizarZona,DesactivarZona,ReactivarZona}/...
```
`CrearZona` vive bajo `Features/Locales` (ruta anidada `POST /api/locales/:id/zonas`, mismo agrupamiento que `ListarZonasPorLocal`); el resto de mutaciones de Zona vive bajo `Features/Zonas` (rutas `PATCH /api/zonas/:id...`, sin `:localId` en el path). Mismo criterio de agrupamiento por ruta, no por "dueño conceptual", que ya usa `Features/Locales/ListarZonasPorLocal`.

### D2 — Sin cambios de esquema en entidades; solo índice único nuevo
`Area`/`Local`/`Zona` no requieren campos nuevos. Migración EF Core agrega `HasIndex(e => new { e.EmpresaId, e.Codigo }).IsUnique()` para `Local` y `Zona` en `ShacDbContext.OnModelCreating` (no existía, a diferencia de `Incidente.Numero`/`NoConformidad.Numero`/`QualityEvent.Numero`).

### D3 — Numeración correlativa `LOC-NNN`/`ZON-NNN` vía `EmpresaSecuencia`
Nuevo `LocalZonaNumeroGenerator`, mismo mecanismo que `NoConformidadNumeroGenerator` (upsert atómico sobre `empresa_secuencias` dentro de la misma transacción/conexión de la escritura), pero con `Tipo = "LOCAL"` / `"ZONA"` y `Anio` fijado a la constante `0` — el código visible no lleva año (`LOC-001`, no `LOC-2026-001`), pero `EmpresaSecuencia` exige `(EmpresaId, Tipo, Anio)` como clave compuesta ya establecida; fijar `Anio = 0` evita introducir una tabla de contadores paralela solo para este caso sin año. Formato de salida: `$"LOC-{valor:D3}"` / `$"ZON-{valor:D3}"`.

### D4 — Generación de `Area.Id` para Áreas creadas por CRUD
`Area.Id` es `string` con `HasMaxLength(20)` (mitad de la PK compuesta `(EmpresaId, Id)`). Las 19 semillas usan `area-001`..`area-019`; no hay un formato "canónico" más allá de ser único dentro de la empresa (confirmado — el mock usa `area-{timestamp}-{random}`, que no cabría necesariamente en 20 caracteres). Se genera como `$"area-{Guid.NewGuid():N}"[..17]` (prefijo `area-` + 12 hex chars del GUID, 17 caracteres totales, dentro del límite de 20) — colisión estadísticamente despreciable a la escala de este catálogo (decenas de filas por empresa), sin necesitar confirmación de Toño (mismo criterio que la instrucción original: "queda a tu criterio").

### D5 — RN-ARE-001: conjunto de estados bloqueantes distinto por dominio, y distinto del de Local/Zona
Replicar exactamente `puedeDesactivarArea` (`areaBusinessRules.ts`) contra las tablas reales, con EF Core (LINQ `CountAsync` con filtro compuesto), dentro del handler de `DesactivarArea`:
- QE no-terminal: `ABIERTO, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE, EN_VERIFICACION`
- NC no-terminal: `ABIERTA, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE` (usa el enum real `NCEstado`, no el texto desactualizado de `be-incidentes-catalogos` design.md que mencionaba `DETECTADA`/`EN_CORRECCION`/`REABIERTA`, valores que no existen en el enum real)
- Incidente no-terminal (bloqueo de Área): `ABIERTO, EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION, PENDIENTE_CIERRE`

**Importante — no confundir con el conjunto bloqueante de Local/Zona (RN-LOC-002/RN-ZON-002, D6):** el set de Incidente que bloquea Área incluye `ANALISIS_COMPLETADO` y `PENDIENTE_CIERRE`; el que bloquea Local **no** los incluye. Son dos listas literalmente distintas en el frontend (`ESTADOS_BLOQUEANTES_INCIDENTE` en `areaBusinessRules.ts` vs. `ESTADOS_BLOQUEANTES_LOCAL`/`ESTADOS_BLOQUEANTES_ZONA` en `localesBusinessRules.ts`) — implementarlas con la misma constante compartida sería un bug.

En todos los casos, el filtro de conteo debe cruzar `EmpresaId` de cada fila de QE/NC/Incidente contra `EmpresaId` del Área (no solo `AreaId`), porque `AreaId` es un código compartido entre empresas (`area-XXX` sembrado 19 veces) y ninguna de las tres entidades tiene FK enforcement sobre `AreaId`.

El `409` responde `{ success: false, message, conteo: { qe, nc, incidentes, total } }` (mismo shape que el mock, consumido estructurado por `AreaBloqueoModal.tsx`).

### D6 — RN-LOC-002/RN-ZON-002: bloqueo de Local/Zona solo por Incidentes, sets distintos entre sí
- Local bloqueante: `ABIERTO, EN_INVESTIGACION`
- Zona bloqueante: `ABIERTO, EN_INVESTIGACION, EN_EJECUCION` (superset — agrega `EN_EJECUCION`)

Ambos scoped por `EmpresaId` del Local/Zona (mismo criterio de D5: `Incidente.LocalId`/`ZonaId` son `Guid?` con FK real hacia `Local`/`Zona`, pero el filtro de empresa igual se aplica explícitamente por consistencia con el resto del backend, no por necesidad de aislamiento — un incidente con `LocalId` apuntando a un Local de otra empresa no puede existir dado que `LocalId` sí es un Guid único global, a diferencia de `AreaId`).

### D7 — Endpoint dual JSON / `multipart/form-data` para `POST`/`PATCH /api/locales(/:id)`
El contrato real (`locales.api.ts`, `buildLocalFormData`) envía JSON cuando no hay archivo y `multipart/form-data` (con campos `nombre`, `direccion`, `planoUrl`) cuando sí lo hay — la misma ruta acepta ambos. Minimal API binding no soporta un único parámetro que se bindee desde JSON o form indistintamente, así que `CrearLocalEndpoint`/`ActualizarLocalEndpoint` reciben `HttpContext` directo en vez de un `TCommand` tipado, y **no** usan `ValidationFilter<TCommand>` (que depende de que el argumento ya esté bindeado por el pipeline). En su lugar:
1. Si `request.HasFormContentType`, parsear vía `request.ReadFormAsync()` (`nombre`, `direccion` de `form.TryGetValue`; `planoUrl` de `form.Files`); si no, `await request.ReadFromJsonAsync<CrearLocalCommand>()`.
2. Construir el `Command` en ambos casos y validarlo manualmente con el `IValidator<CrearLocalCommand>` inyectado (mismo `FluentValidation` que el resto del backend), devolviendo el mismo shape 400 que `ValidationFilter` (`ApiResponse.Fail`) si falla — para no introducir un formato de error distinto en este único endpoint.
3. Si viene `IFormFile` de `planoUrl`: validar `ContentType == "image/png"` exacto y `Length <= 2 * 1024 * 1024` (RN-LOC-003) antes de aceptar; error `400` con el mismo shape si falla.

### D8 — Almacenamiento del plano PNG
Primer endpoint de upload real del backend — no hay patrón preexistente que replicar. Se guarda en disco local: `wwwroot/uploads/planos/{empresaId}/{Guid.NewGuid()}.png`, servido como estático. Requiere agregar `app.UseStaticFiles()` a `Program.cs` (no existe todavía — confirmado, no hay ninguna referencia a `UseStaticFiles`/`wwwroot` en el proyecto). Respuesta: `planoPngUrl` como URL relativa (`/uploads/planos/{empresaId}/{archivo}.png`), consistente con el contrato (`Local.planoPngUrl: string`). Aceptable para este entorno de desarrollo; no es la solución de almacenamiento de producción (S3/Blob Storage), que queda fuera de alcance.

### D9 — Restricción de rol en las mutaciones: `ADMINISTRADOR_SISTEMA` + `JEFE_CALIDAD_SYST` (revisado 2026-08-24 — decisión de Toño)
Versión inicial (implementada primero, luego ampliada): `area-permissions`/`location-permissions` (specs ya archivadas del frontend) definen `puedeAdministrarAreas`/`puedeAdministrarLocales`, que solo permiten `ADMINISTRADOR_SISTEMA` — esto no estaba en la instrucción original de Cowork, se agregó tras verificar contra esas specs de permisos del frontend, y el backend original solo aceptaba ese único rol.

**Decisión final de Toño, 2026-08-24**: `JEFE_CALIDAD_SYST` se agrega junto a `ADMINISTRADOR_SISTEMA` en las 12 mutaciones (no lo reemplaza — ambos roles pueden ejecutar estas acciones). Diverge deliberadamente de `puedeAdministrarAreas`/`puedeAdministrarLocales` del frontend (que siguen restringidos a `ADMINISTRADOR_SISTEMA` únicamente) — el frontend no se tocó en este cambio, queda como trabajo pendiente de una futura spec si Toño decide alinear también el check client-side. Los 12 endpoints (`Crear`/`Actualizar`/`Desactivar`/`Reactivar` × Área/Local/Zona, más `CrearZona`) usan `.RequireAuthorization(p => p.RequireRole(nameof(UserRole.ADMINISTRADOR_SISTEMA), nameof(UserRole.JEFE_CALIDAD_SYST)))`. Los 4 endpoints de lectura existentes no cambian (siguen sin restricción de rol, fuera de alcance de este cambio).

## Risks / Trade-offs

- [Riesgo] `Area.Id` generado con `Guid.NewGuid():N[..17]` (D4) no tiene garantía de unicidad como un `COUNT`/secuencia — depende de la baja probabilidad de colisión de 12 hex chars (48 bits) dentro de la misma empresa → Mitigación: la PK compuesta `(EmpresaId, Id)` rechaza cualquier colisión real con una excepción de BD (`DbUpdateException`), que el handler debe traducir a un reintento simple (regenerar Id y reinsertar) o, más simple, dejar que se propague como 500 dado lo improbable del caso — decisión de implementación, no bloqueante.
- [Riesgo] El endpoint dual JSON/multipart (D7) es la primera excepción al patrón `TCommand` + `ValidationFilter<TCommand>` establecido — cualquier desarrollador futuro que copie `CrearLocalEndpoint` como plantilla para un endpoint JSON-only heredaría complejidad innecesaria → Mitigación: comentario explícito en el código señalando que este patrón es exclusivo de endpoints con upload de archivo condicional, no la plantilla por defecto.
- [Riesgo] Confundir el set de estados bloqueantes de Incidente para Área (D5, incluye `ANALISIS_COMPLETADO`/`PENDIENTE_CIERRE`) con el de Local/Zona (D6, no los incluye) → Mitigación: nombrar las constantes de forma inequívoca en el código (`EstadosIncidenteBloqueantesArea` vs. `EstadosIncidenteBloqueantesLocal`/`EstadosIncidenteBloqueantesZona`), nunca una constante compartida.
- [Riesgo] El almacenamiento en disco local (D8) no sobrevive a un despliegue sin volumen persistente ni escala a múltiples instancias → Mitigación: aceptado explícitamente como solución de solo-desarrollo; migrar a almacenamiento de objetos queda fuera de alcance y debe abrirse como cambio separado antes de producción.
- [Riesgo, resuelto 2026-08-24] La restricción de rol solo a `ADMINISTRADOR_SISTEMA` (D9, versión inicial) no estaba en la instrucción original — Toño confirmó que `JEFE_CALIDAD_SYST` también debía poder administrar Áreas/Locales/Zonas en el backend real. Mitigado: los 12 endpoints ahora aceptan ambos roles. El frontend (`puedeAdministrarAreas`/`puedeAdministrarLocales`) sigue sin actualizarse — un usuario `JEFE_CALIDAD_SYST` no verá los botones de administración en la UI todavía aunque el backend ya se lo permita; queda como gap conocido para una spec de frontend futura si Toño lo pide.

## Migration Plan

1. Migración EF Core nueva: índices únicos `(EmpresaId, Codigo)` sobre `Local` y `Zona`. Sin cambios de columnas.
2. Aplicar migración (`dotnet ef database update`) — la ejecuta Toño en su máquina junto con las pruebas, no Cowork.
3. Registrar `app.UseStaticFiles()` en `Program.cs` (antes de `app.MapFeatureEndpoints()`), y crear el directorio `wwwroot/uploads/planos/` (o dejar que se cree en el primer upload).
4. Sin rollback especial — no hay datos de producción; revertir la migración es suficiente si algo falla.

## Open Questions

Ninguna pregunta abierta bloqueante. La única decisión que se apartó de la instrucción original (D9, restricción de rol) fue revisada por Toño el 2026-08-24: confirmó ampliar a `ADMINISTRADOR_SISTEMA` + `JEFE_CALIDAD_SYST`, ya implementado en los 12 endpoints. Sin preguntas pendientes.
