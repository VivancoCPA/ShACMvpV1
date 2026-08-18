## 1. Dominio y persistencia — modelo de datos

- [x] 1.1 Crear entidad `Area` (`Id`, `Nombre`, `Descripcion?`, `Activo`, `CreadoEn`) sin `EmpresaId`, en `ShcMvpEndPoint.Domain/Entities`
- [x] 1.2 Crear entidad `Local` (`Id`, `Nombre`, `Codigo`, `Activo`, `EmpresaId`, `CreadoEn`, `ActualizadoEn`, `Direccion?`, `PlanoPngUrl?`)
- [x] 1.3 Crear entidad `Zona` (`Id`, `LocalId`, `Nombre`, `Codigo`, `Activo`, `EmpresaId`, `CreadoEn`, `ActualizadoEn`, `Descripcion?`)
- [x] 1.4 Crear entidad `Incidente` con todos los campos del shape confirmado (ver specs/be-incidentes-api), incluyendo `LocalId?`, `ZonaId?`, `UbicacionX?`/`UbicacionY?`, `DeletedAt?`
- [x] 1.5 Crear entidad `AccionCorrectivaIncidente` (FK `IncidenteId`) con `Titulo`, `Descripcion`, `ResponsableId`, `PlazoFecha`, `Prioridad`, `Estado`, `DescripcionEvidencia?`, `EvidenciaUrl?`, `FechaCierre?`
- [x] 1.6 Crear entidad `IncidenteAuditTrail` (FK `IncidenteId`), append-only, con `Accion`, `EstadoAnterior?`, `EstadoNuevo?`, `RealizadoPorId`, `RealizadoPorNombre`, `Timestamp`, `GeneradoPorIA`
- [x] 1.7 Crear tabla de contadores de secuencia por empresa (`EmpresaSecuencia`: `EmpresaId`, `Tipo`, `Anio`, `UltimoValor`) reutilizable para futuras numeraciones (QE, NC)
- [x] 1.8 Configurar EF Core (DbContext, mapeos, índices: `Incidente.EmpresaId`, `Incidente.Numero` único por empresa+año, `Local.EmpresaId`, `Zona.LocalId`)
- [x] 1.9 Generar y aplicar migración EF Core con las tablas nuevas

## 2. Áreas — catálogo compartido (solo lectura)

- [x] 2.1 Implementar `Features/Areas/ListarAreas` (Dapper, `GET /api/areas`, sin scoping por empresa)
- [x] 2.2 Implementar `Features/Areas/ObtenerArea` (Dapper, `GET /api/areas/:id`, 404 si no existe)
- [x] 2.3 Crear `DevSeedAreasExtensions.cs` — seed idempotente de las 19 áreas (`area-001`..`area-019`) leyendo nombres exactos de `shc-controldoc/src/mocks/fixtures/areas.fixtures.ts`, gateado a `IsDevelopment()`, no bloqueante si falla
- [x] 2.4 Registrar el seed de Áreas en `Program.cs`, después del seed de SUPERADMIN/QA existente

## 3. Locales/Zonas — sub-recurso de solo lectura

- [x] 3.1 Implementar `Features/Locales/ListarLocales` (Dapper, `GET /api/locales`, filtro opcional `activo`, scoped por `empresaActivaId`)
- [x] 3.2 Implementar `Features/Locales/ListarZonasPorLocal` (Dapper, `GET /api/zonas?localId=`, scoped por `empresaActivaId`, 404 si `localId` no existe o es de otra empresa)
- [x] 3.3 Crear `DevSeedLocalesExtensions.cs` — seed idempotente de 2-3 locales con 2-3 zonas cada uno, asociados a una empresa de desarrollo existente, gateado a `IsDevelopment()`, no bloqueante si falla
- [x] 3.4 Registrar el seed de Locales/Zonas en `Program.cs`

## 4. Incidentes — creación y lectura

- [x] 4.1 Implementar `Utils/IncidentSeveridad` (o equivalente) replicando exactamente `getAutoSeveridad` del frontend (ACCIDENTE+>1 afectado→CRITICA, ACCIDENTE resto→ALTA, INCIDENTE→MEDIA, CUASI_ACCIDENTE→MEDIA, default→BAJA)
- [x] 4.2 Implementar generación de `numero` (`INC-<año>-NNN`) vía la tabla `EmpresaSecuencia`, atómico bajo concurrencia
- [x] 4.3 Implementar `Features/Incidentes/CrearIncidente` (Command + Validator + Handler EF Core + Endpoint): validación de campos requeridos, `descripcion` ≥20 chars, `empresaId` desde JWT, 401 sin empresa activa, severidad server-side, cálculo de `REPORTE_TARDIO` (>24h entre `fechaEvento` y ahora)
- [x] 4.4 Implementar `Features/Incidentes/ListarIncidentes` (Dapper, filtros `tipo`/`fechaDesde`/`fechaHasta`/`search`/`showDeleted`/`page`/`pageSize`, respuesta `{ items, pagination }`, scoped por empresa activa)
- [x] 4.5 Implementar `Features/Incidentes/ObtenerIncidente` (Dapper, `GET /:id`, incluye `accionesCorrectivas` y `auditTrail`, 404 cross-tenant)

## 5. Incidentes — actualización, estado y borrado

- [x] 5.1 Implementar `Features/Incidentes/ActualizarInvestigacion` (`PATCH /:id`, actualización parcial de campos de investigación, agrega entrada `CAMPO_EDITADO`)
- [x] 5.2 Implementar máquina de estados (`ABIERTO→{EN_INVESTIGACION,ANULADO}`, `EN_INVESTIGACION→ANALISIS_COMPLETADO`, `ANALISIS_COMPLETADO→EN_EJECUCION`, `EN_EJECUCION→PENDIENTE_CIERRE`, `PENDIENTE_CIERRE→CERRADO`, `CERRADO`/`ANULADO` terminales)
- [x] 5.3 Implementar `Features/Incidentes/CambiarEstadoIncidente` (`PATCH /:id/status`, 422 en transición inválida, agrega entrada `ESTADO_CAMBIADO`)
- [x] 5.4 Implementar `IIncidenteNotificationSender` + `NoOpIncidenteNotificationSender` (cálculo de destinatarios: reportante + responsables de ACs no cerradas, excluyendo al actor; envío no bloqueante, TODO explícito documentado en código)
- [x] 5.5 Implementar `Features/Incidentes/EliminarIncidente` (`DELETE /:id`, soft-delete solo si `estado === 'ABIERTO'` y no eliminado previamente, 422 en los demás casos, agrega entrada `ELIMINADO`)
- [x] 5.6 Implementar `Features/Incidentes/RestaurarIncidente` (`PATCH /:id/restore`, solo si `deletedAt` definido, agrega entrada `RESTAURADO`)

## 6. Acciones correctivas del Incidente

- [x] 6.1 Implementar `Features/Incidentes/CrearAccionCorrectiva` (`POST /:id/acciones`, body `{ titulo, descripcion, responsableId, plazoFecha, prioridad }`, estado inicial `PENDIENTE`, agrega entrada `AC_CREADA`)
- [x] 6.2 Implementar `Features/Incidentes/ActualizarAccionCorrectiva` (`PATCH /:incidenteId/acciones/:acId`, actualización parcial, 404 si la acción no existe)

## 7. Multi-tenancy y comentario de alcance QE

- [x] 7.1 Verificar que todos los handlers de Incidentes filtran por `empresaId === empresaActivaId` antes de cualquier otro filtro y responden 404 (nunca 403) cross-tenant
- [x] 7.2 Agregar comentario explícito en `CrearIncidente` señalando que la creación automática de Quality Event está intencionalmente fuera de alcance (no un olvido)

## 8. Tests

- [x] 8.1 Tests de integración: Áreas (listado, detalle, 404, catálogo compartido entre empresas)
- [x] 8.2 Tests de integración: Locales/Zonas (listado scoped, filtro `activo`, zonas por local, 404 cross-tenant)
- [x] 8.3 Tests de integración: creación de Incidente (éxito, validaciones 400, 401 sin empresa activa, severidad calculada por combinación tipo/afectados, `REPORTE_TARDIO`)
- [x] 8.4 Tests de integración: listado/detalle de Incidentes (paginación, filtros, `showDeleted`, shape `data.items`, 404 cross-tenant)
- [x] 8.5 Tests de integración: transición de estado (transiciones válidas e inválidas, notificación no bloqueante)
- [x] 8.6 Tests de integración: soft-delete/restore (bloqueo por estado, doble eliminación, restauración)
- [x] 8.7 Tests de integración: acciones correctivas (creación, validación de campos requeridos, actualización, 404)
- [x] 8.8 Tests de numeración correlativa: dos incidentes de la misma empresa en el mismo año obtienen números consecutivos; empresas distintas no interfieren entre sí

## 9. Verificación manual y cierre

- [x] 9.1 Ejecutar `dotnet test` y confirmar conteo de tests antes/después (partiendo de 45)
- [x] 9.2 Pasada manual mínima: crear incidente, listar/filtrar, transicionar estado, crear y actualizar AC, soft-delete + restore, acceso cross-tenant → 404
- [x] 9.3 Documentar en el reporte final: endpoints implementados con status codes verificados, discrepancias encontradas (ver proposal.md "Impact" y design.md "Open Questions") sin resolver unilateralmente, estado del hook de notificación (TODO vs. infraestructura existente), y `git status` final

## 10. Ajustes 2026-08-18 — resolución de Open Questions (Áreas por-empresa, ruta de zonas, doc de contrato)

Áreas pasó de catálogo global (tareas 2.x arriba) a catálogo por-empresa — las tareas 2.x describen el estado original, no se reescriben para no perder el rastro del cambio de diseño; esta sección documenta la migración sobre ese estado.

- [x] 10.1 Revertir D5: `Area` entidad gana `EmpresaId` (Guid, requerido), clave primaria compuesta `(EmpresaId, Id)` configurada en `ShacDbContext.OnModelCreating` (mismo patrón que `EmpresaSecuencia`) — decisión documentada en `design.md`, D5 revisado
- [x] 10.2 Migración EF Core nueva `AreasPorEmpresa` (posterior a `AddIncidentesCatalogos`, no la edita) — agrega columna `empresa_id`, recompone la PK; generada con `dotnet ef migrations add` y aplicada contra la BD de desarrollo (`dotnet ef database update`)
- [x] 10.3 `Features/Areas/ListarAreas` y `Features/Areas/ObtenerArea`: scoping por `empresaActivaId` (mismo patrón que `Features/Locales/ListarLocales`/`ListarZonasPorLocal`); `ObtenerArea` responde 404 (no 403) para área de otra empresa
- [x] 10.4 `DevSeedAreasExtensions.cs`: siembra las 19 áreas para cada Empresa existente (antes: una sola vez, global); tolerante si todavía no existe ninguna Empresa, mismo patrón que `DevSeedLocalesExtensions`
- [x] 10.5 `ShcMvpEndPoint.Tests/TestDataSeeder.cs`: `CreateAreaAsync` gana parámetro `empresaId` requerido; `CreateIncidenteAsync` actualizado para pasarlo
- [x] 10.6 `ShcMvpEndPoint.Tests/Features/Areas/AreasEndpointTests.cs`: el test de "catálogo compartido entre empresas" se invierte a "cada empresa ve su propio catálogo" + nuevo test `ObtenerArea_DeOtraEmpresa_Devuelve404`
- [x] 10.7 `ShcMvpEndPoint.Tests/Features/Incidentes/IncidentesCrudEndpointTests.cs`: todas las llamadas a `CreateAreaAsync()` actualizadas para pasar la empresa correspondiente del test
- [x] 10.8 Revertir D6: `Features/Locales/ListarZonasPorLocal` — ruta cambia de `GET /api/zonas` (query `localId`) a `GET /api/locales/{localId}/zonas` (path param); sin cambios de lógica en el handler, solo el binding en el endpoint
- [x] 10.9 `ShcMvpEndPoint.Tests/Features/Locales/LocalesEndpointTests.cs`: las 3 llamadas a `/api/zonas?localId=` migradas a `/api/locales/{id}/zonas`
- [x] 10.10 Frontend (`shc-controldoc`): `useZonasByLocal.ts` migrado a `GET /api/locales/${localId}/zonas`; `src/mocks/handlers/locales.handlers.ts` gana el handler `GET /api/locales/:localId/zonas` y el handler `GET /api/zonas` se simplifica (deja de filtrar por `localId` — sigue existiendo solo para `listarZonas()`, el listado plano de M6, sin tocar ese consumidor)
- [x] 10.11 Frontend tests: `useZonasByLocal.test.ts` y `src/mocks/handlers/locales.handlers.test.ts` actualizados a la ruta nueva; confirmado sin referencias muertas a `?localId=` en `src/`
- [x] 10.12 Verificado contra frontend real (no asumido): `areas.fixtures.ts` / `area.types.ts` no tienen `empresaId` ni asumen multi-empresa — no requirió cambio de frontend para el punto de Áreas, ya que M3/Incidentes sigue consumiendo MSW, no el backend real, para este dato
- [x] 10.13 Open Question #3 (Notificaciones): cerrada sin cambios de código — `NoOpIncidenteNotificationSender` permanece como está
- [x] 10.14 Open Question #4 (body de acciones correctivas): sin cambio de código (backend ya correcto); corregido `docs/SHAC-Contrato-API.md` — body real `{ titulo, descripcion, responsableId, plazoFecha, prioridad }`, ruta de zonas actualizada a path param, flags #6 y #10bis cerrados como resueltos
- [x] 10.15 `design.md`: D5 y D6 reescritos con la decisión final; Open Questions 1-4 marcadas resueltas
- [x] 10.16 `specs/be-areas-catalogo/spec.md` y `specs/be-locales-zonas-lectura/spec.md` actualizadas para reflejar el scoping por empresa y la ruta con path param
- [x] 10.17 Verificación final: `dotnet build`/`dotnet test` limpios (87/87, partiendo de 86 antes de estos ajustes) y suite de frontend afectada (`useZonasByLocal`, `locales.handlers`, `features/incidents`, `HeatmapIncidentesWidget`) limpia
