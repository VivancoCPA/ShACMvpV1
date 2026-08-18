## Context

`ShcMvpEndPoint` (.NET 10, VSA + Minimal APIs, CQRS Dapper-para-lecturas/EF-Core-para-escrituras) tiene hoy dos módulos reales: Auth y Empresas, cada uno bajo `Features/<Modulo>/<Accion>/{Command,Endpoint,Handler,Validator}.cs`, con entidades en `ShcMvpEndPoint.Domain/Entities`. Multi-tenancy ya sigue un patrón establecido en Empresas: filtrar por `empresaId` antes que cualquier otro filtro, 404 (nunca 403) para recursos de otra empresa, `empresaId` fijado desde el JWT en creaciones. `DevSeedExtensions.cs` ya sembra un SUPERADMIN y usuarios QA de forma idempotente, gateada a `IsDevelopment()`.

Este cambio agrega el primer módulo de dominio (Incidentes SyST) más dos catálogos de soporte (Áreas, Locales/Zonas de solo lectura). El frontend (`shc-controldoc`) ya tiene el contrato de referencia implementado en MSW — es la fuente de verdad para el shape exacto de request/response, por encima del PRD (ver `CLAUDE.md`, sección "Verificar contra código real antes de proponer").

## Goals / Non-Goals

**Goals:**
- Endpoints reales de Incidentes SyST con paridad de comportamiento contra `incidents.handlers.ts` (severidad auto-calculada, reporte tardío, máquina de estados, soft-delete, acciones correctivas, multi-tenancy).
- Catálogo Áreas sembrado y de solo lectura, compartido entre empresas.
- Sub-recurso Locales/Zonas de solo lectura, scoped por empresa, con datos de desarrollo seedeados.
- Mantener el patrón CQRS ya establecido (Dapper para GET, EF Core para POST/PATCH/DELETE), sin LINQ en lecturas, sin MediatR.

**Non-Goals:**
- CRUD administrativo de Áreas o de Locales/Zonas (crear/editar/desactivar/reactivar, upload de plano PNG).
- Creación automática de Quality Event al crear un Incidente.
- Job real de notificaciones (solo se deja el hook/TODO).
- `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar`.

## Decisions

### D1 — Estructura de Features
`Features/Incidentes/{CrearIncidente,ListarIncidentes,ObtenerIncidente,ActualizarInvestigacion,CambiarEstadoIncidente,EliminarIncidente,RestaurarIncidente,CrearAccionCorrectiva,ActualizarAccionCorrectiva}/`, cada uno con Command/Endpoint/Handler (+Validator donde aplique), replicando el patrón de `Features/Empresas/*`. `Features/Areas/ListarAreas`, `Features/Areas/ObtenerArea`. `Features/Locales/ListarLocales`, `Features/Locales/ListarZonasPorLocal`.

### D2 — Entidades de dominio
Nuevas entidades EF Core: `Incidente` (con `AccionesCorrectivas` como colección owned o tabla propia `AccionCorrectivaIncidente` con FK a `IncidenteId`), `Area` (tabla global, sin `EmpresaId` — ver D5), `Local`, `Zona`. `AuditTrailEntry` de Incidente se modela como tabla propia append-only (`IncidenteAuditTrail`), FK a `IncidenteId`, igual que el patrón `auditTrail: AuditTrailEntry[]` del frontend pero relacional.

### D3 — Numeración correlativa `INC-2026-NNN`
El mock genera el correlativo contando filas existentes (`count + 1`), lo cual es sensible a soft-deletes y no es seguro bajo concurrencia. Para el backend real: secuencia por `(empresaId, año)` calculada dentro de la misma transacción de creación (`SELECT COUNT(*) ... FOR UPDATE` o una tabla de contadores `EmpresaSecuencia(empresaId, tipo, anio, ultimoValor)` con actualización atómica). No existe todavía un mecanismo genérico de secuencias en el scaffolding de Empresas — este cambio introduce el primero, pensado para reutilizarse cuando existan QE/NC (`QE-2025-001`, etc.).

### D4 — Severidad auto-calculada
Replicar exactamente `incidentSeveridad.ts`: `ACCIDENTE` + `numPersonasAfectadas > 1` → `CRITICA`; `ACCIDENTE` (resto de casos) → `ALTA`; `INCIDENTE` → `MEDIA`; `CUASI_ACCIDENTE` → `MEDIA`; `CONDICION_INSEGURA` (default) → `BAJA`. Cualquier `severidad` enviada en el body se ignora — nunca se confía en el cliente (a diferencia del mock, que sí acepta un override opcional; el mock lo hace solo para facilitar fixtures de test, no es un comportamiento a preservar).

### D5 — Áreas como catálogo por-empresa (revisado 2026-08-18)
**Decisión final de Toño, revierte la D5 original** (que la modelaba como tabla global sin `EmpresaId`, basada en `areas.fixtures.ts` sin ese campo). Área pasa a ser un catálogo scoped por `empresaId`, igual que Locales/Zonas — resuelve el flag #6 del contrato (`docs/SHAC-Contrato-API.md`).

**Esquema de ids — decisión de diseño tomada por Claude Code, marcada para confirmar con Toño:** los mismos 19 códigos human-readable `area-001`..`area-019` se repiten por cada empresa. En vez de introducir un PK Guid nuevo + columna `Codigo` separada (una de las dos opciones que planteó la instrucción original), se optó por una **clave primaria compuesta `(EmpresaId, Id)`** sobre el `Id` string existente — mismo patrón ya usado por `EmpresaSecuencia` en `ShacDbContext.OnModelCreating`. Razones:
- `Incidente.AreaId` (string) **no cambia de forma** — sigue siendo el código `"area-XXX"`; solo cambia que su resolución a una fila concreta de `Area` ahora requiere también `Incidente.EmpresaId` (ya existente en la entidad), nunca `Id` en solitario.
- `CrearIncidenteHandler` no valida `AreaId` contra la tabla `Area` (no hay FK enforcement ni lookup) — no hay riesgo de romper incidentes de dev ya creados con esta migración.
- El endpoint `GET /api/areas/:id` sigue devolviendo `id` como el mismo código string que el frontend espera (`shc-controldoc` `Area.id: string`, sin `empresaId`) — cero cambio de shape en la respuesta HTTP.
- Es el cambio de esquema mínimo: una migración `ALTER TABLE` (drop PK, add columna, add PK compuesta), sin introducir una columna nueva de propósito puramente interno.

Migración EF Core `AreasPorEmpresa` (posterior a `AddIncidentesCatalogos`) aplicada contra la BD de desarrollo. `ListarAreasHandler`/`ObtenerAreaHandler` ahora filtran por `empresaActivaId` (mismo patrón que `ListarLocalesHandler`/`ListarZonasPorLocalHandler`); `ObtenerArea` usa 404 (nunca 403) cross-tenant. `DevSeedAreasExtensions` siembra las 19 áreas para cada Empresa existente en el arranque (antes sembraba una sola vez, global) — mismo enfoque tolerante que `DevSeedLocalesExtensions` si todavía no existe ninguna Empresa.

**Verificado contra el frontend real antes de implementar**: `shc-controldoc/src/features/areas/types/area.types.ts` (`Area { id, nombre, activo, creadoEn, descripcion? }`) y `src/mocks/fixtures/areas.fixtures.ts` **no tienen campo `empresaId`** ni asumen multi-empresa — no hay consumidor real de `GET /api/areas` contra el backend .NET a esta fecha (M3/Incidentes sigue en MSW, `CLAUDE.md` "Estado actualizado"), así que este cambio de backend no requirió ningún ajuste de frontend.

### D6 — Locales/Zonas: ruta con path param (revisado 2026-08-18)
**Decisión final de Toño, revierte la D6 original** (que implementaba `GET /api/zonas?localId=` por ser lo que el frontend ejecutaba en ese momento). El backend expone `GET /api/locales/:localId/zonas` (path param) — la misma ruta que `docs/SHAC-Contrato-API.md` ya documentaba desde el inicio — y el frontend migra a consumirla: `useZonasByLocal.ts` (`shc-controldoc/src/features/incidents/hooks/`) ahora llama `GET /api/locales/${localId}/zonas`; el handler MSW correspondiente en `src/mocks/handlers/locales.handlers.ts` se actualizó en paralelo (nuevo `http.get('/api/locales/:localId/zonas', ...)`, separado del handler `GET /api/zonas` que sigue existiendo solo para el listado plano sin `:localId` que usa `listarZonas()` — CRUD admin de M6, fuera de alcance de este cambio). `ListarZonasPorLocalHandler` no necesitó cambios de lógica, solo el binding de `localId` pasó de query string a route param en `ListarZonasPorLocalEndpoint`. `GET /api/locales` no lleva filtro `:localId` — lista todos los locales activos de la empresa activa (replicando `useLocales()` → `GET /api/locales?activo=true`).

### D7 — Acciones correctivas del Incidente: shape real vs. contrato documentado
El body real de `POST /api/incidents/:id/acciones` exige `{ titulo, descripcion, responsableId, plazoFecha, prioridad }` (`incidents.handlers.ts`), no `{ descripcion, responsableId, fechaLimite }` como documenta el contrato. Se implementa el shape real. `AccionCorrectivaIncidente.estado` sigue el enum del frontend: `PENDIENTE | EN_EJECUCION | COMPLETADA | CERRADA` (el endpoint `/cerrar` que transiciona a `CERRADA` queda fuera de alcance, así que en este cambio `PATCH /:incidenteId/acciones/:acId` puede escribir `estado` libremente vía `Partial<AccionCorrectivaIncidente>`, igual que el mock).

### D8 — Reporte tardío
Calculado server-side comparando `fechaEvento` (del body) contra `DateTime.UtcNow` en el momento de la creación, dentro del mismo handler que crea el incidente — no un job. Si `> 24h`, se agrega una entrada `IncidenteAuditTrail` con `Accion = "REPORTE_TARDIO"`, `RealizadoPorId = "system"`, `GeneradoPorIA = true`, igual que `makeAuditEntry` en el mock.

### D9 — Notificación post-transición
Se implementa el cálculo de destinatarios (reportante + responsables de ACs no cerradas, excluyendo al actor) como parte del handler de `PATCH /:id/status`, pero el envío real queda como método de una interfaz `IIncidenteNotificationSender` con una implementación `NoOpIncidenteNotificationSender` (log + TODO explícito) hasta confirmar si existe infraestructura de Notificaciones en el backend — no se bloquea el request si el envío falla o no está implementado.

### D10 — Dev seed
Áreas (19) y Locales/Zonas de desarrollo se seedean en archivos separados dentro de `ShcMvpEndPoint.Infrastructure/DevSeed/` (`DevSeedAreasExtensions.cs`, `DevSeedLocalesExtensions.cs`), no en el mismo `DevSeedExtensions.cs` de SUPERADMIN/QA — mismo patrón (idempotente, gateado a `IsDevelopment()`, no tumba el arranque si falla), pero separado por dominio para no acoplar el seed de identidad con el de catálogos de dominio.

## Risks / Trade-offs

- [Riesgo, resuelto 2026-08-18] Áreas sin `empresaId` (D5 original) resultó incorrecto — el equipo confirmó que debía ser por-empresa. Mitigado como se previó: el acceso a `Area` ya vivía detrás de `Features/Areas/*`, así que agregar `EmpresaId` fue una migración localizada (`AreasPorEmpresa`), sin cambio de contrato HTTP en cascada.
- [Riesgo] La secuencia `INC-2026-NNN` (D3) puede tener contención bajo alta concurrencia si se implementa con `COUNT(*)` ingenuo → Mitigación: usar una tabla de contadores con `UPDATE ... RETURNING` atómico (Postgres) en vez de contar filas.
- [Riesgo, resuelto 2026-08-18] Implementar `GET /api/zonas?localId=` en vez de `GET /api/locales/:localId/zonas` (D6 original) divergía del contrato escrito — Toño confirmó que el frontend debía migrar a la ruta documentada en vez de al revés. Ver D6 revisado arriba.
- [Riesgo] Notificación como no-op (D9) puede dar falsa sensación de "completo" si nadie revisa el TODO → Mitigación: el reporte final de este cambio debe declarar explícitamente el estado de este hook (ver proposal.md, Impact). Confirmado 2026-08-18: no existe infraestructura de Notificaciones en el backend todavía — `NoOpIncidenteNotificationSender` permanece como está (no-op + TODO explícito), no se toca.

## Migration Plan

1. Migraciones EF Core nuevas: `Area`, `Local`, `Zona`, `Incidente`, `AccionCorrectivaIncidente`, `IncidenteAuditTrail`, tabla de contadores de secuencia.
2. Aplicar migraciones (`dotnet ef database update`) antes de correr el dev seed nuevo.
3. Dev seed de Áreas y de Locales/Zonas corre en el arranque de Development, después del seed de SUPERADMIN/QA existente (mismo orden que hoy, agregado como nuevas llamadas en `Program.cs`).
4. Sin rollback especial más allá de revertir la migración — no hay datos de producción todavía (backend nuevo).

## Open Questions

Todas las preguntas abiertas quedaron resueltas el 2026-08-18 con decisiones explícitas de Toño. Este cambio sigue sin archivarse — la resolución de estas preguntas no implica cierre automático, eso lo decide Toño por separado cuando esté conforme con el resultado final.

1. ~~¿Áreas es realmente un catálogo global o debería ser por-empresa?~~ — **RESUELTO**: por-empresa. Ver D5 revisado arriba.
2. ~~¿Se debe alinear `docs/SHAC-Contrato-API.md` con la ruta real `GET /api/zonas?localId=`, o el frontend debería migrar a `GET /api/locales/:localId/zonas`?~~ — **RESUELTO**: el frontend migra a la ruta documentada (path param). Ver D6 revisado arriba.
3. ~~¿Existe ya alguna infraestructura de Notificaciones en el backend que deba reusarse en vez de `IIncidenteNotificationSender` como no-op?~~ — **RESUELTO (sin cambios)**: no existe infraestructura de Notificaciones todavía. `NoOpIncidenteNotificationSender` permanece exactamente como está (no-op + TODO explícito) — no se implementó nada nuevo en este punto.
4. ~~¿El body real de `POST /api/incidents/:id/acciones` debe mantenerse tal cual del mock o el contrato documentado refleja una simplificación deliberada?~~ — **RESUELTO**: el mock (`incidents.handlers.ts`) es la versión correcta — `{ titulo, descripcion, responsableId, plazoFecha, prioridad }`, ya implementado así en `Features/Incidentes/CrearAccionCorrectiva`. Sin cambio de código; se corrigió `docs/SHAC-Contrato-API.md`, que documentaba el shape viejo (`fechaLimite`, sin `titulo`/`prioridad`).
