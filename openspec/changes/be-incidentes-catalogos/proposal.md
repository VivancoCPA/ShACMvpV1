## Why

Auth y Empresas ya corren contra el backend .NET real (39/39 escenarios manuales, 45/45 tests), pero ningún módulo de dominio existe todavía — todo el frontend sigue consumiendo MSW para Incidentes SyST (M3) y sus catálogos de soporte. Este cambio construye el primer módulo de dominio completo, seleccionado por ser el módulo con menor superficie de dependencias cruzadas (no depende de QE, NC ni Documentos) y por depender de solo dos catálogos nuevos y acotables (Áreas, Locales/Zonas).

## What Changes

- Nuevo catálogo **Áreas**: seed de las 19 áreas fijas (`area-001`..`area-019`, mismos nombres que `AREAS_SHAC`/`areas.fixtures.ts` del frontend), compartido entre empresas (sin `empresaId`). Solo lectura: `GET /api/areas`, `GET /api/areas/:id`.
- Nuevo sub-recurso de solo lectura **Locales/Zonas**, scoped por `empresaId`, con seed de desarrollo (2-3 locales con 2-3 zonas cada uno, gateado a `IsDevelopment()`): `GET /api/locales`, y el endpoint de zonas por local.
- Nuevo módulo **Incidentes SyST (M3)** completo: CRUD, transición de estado con máquina de estados validada server-side, soft-delete/restore, acciones correctivas del incidente, severidad auto-calculada server-side, detección de "reporte tardío" (>24h), numeración `INC-2026-NNN` correlativa por empresa, multi-tenancy (404 en vez de 403 cross-tenant), hook de notificación post-transición dejado explícito (implementado o TODO según infraestructura existente).
- **Fuera de alcance explícito** (no se implementa en este cambio): CRUD completo de Áreas y de Locales/Zonas (crear/editar/desactivar/reactivar, upload de plano PNG) — bloqueado porque las validaciones cruzadas (RN-ARE-001, RN-LOC-002, RN-ZON-002) requieren QE y NC, que no existen todavía en el backend; creación automática de Quality Event al crear un Incidente; el job real de notificaciones; `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar` (sin contrato formal, ver Impact).

## Capabilities

### New Capabilities
- `be-areas-catalogo`: catálogo compartido de Áreas (seed de 19 + lectura), sin scoping por empresa.
- `be-locales-zonas-lectura`: sub-recurso de solo lectura de Locales/Zonas, scoped por empresa, con seed de desarrollo — no es el CRUD admin completo de M6.
- `be-incidentes-api`: módulo backend de Incidentes SyST (M3) — endpoints, máquina de estados, severidad auto-calculada, acciones correctivas, multi-tenancy.

### Modified Capabilities
(ninguna — no existen specs backend previas que este cambio modifique; los specs `incident-*`/`area-*`/`location-*` existentes en `openspec/specs/` describen el frontend, no el backend, y no se tocan)

## Impact

- **Código nuevo**: `ShcMvpEndPoint/Features/Incidentes/**`, `ShcMvpEndPoint/Features/Areas/**` (o equivalente), `ShcMvpEndPoint/Features/Locales/**`, entidades de dominio nuevas (`Incidente`, `AccionCorrectivaIncidente`, `Area`, `Local`, `Zona`), migraciones EF Core, seeds en `DevSeedExtensions.cs` (o archivo dev-seed nuevo).
- **Tests**: nuevos tests de integración en `ShcMvpEndPoint.Tests/Features/Incidentes` (y Areas/Locales), partiendo de 45 tests actuales.
- **Discrepancias detectadas contra `docs/SHAC-Contrato-API.md` y el frontend real, para decisión humana antes o durante `design.md`** (no resueltas unilateralmente):
  1. El contrato documenta `GET /api/locales/:localId/zonas` como el endpoint de zonas por local, pero el código real consumido por el frontend (`useZonasByLocal.ts`) llama `GET /api/zonas?localId=X` (query param, no path param). El flag #10 del propio contrato ya señala esta zona como ambigua, pero desde el ángulo opuesto (asumía que el path-param estaba "bien especificado"). Este cambio implementará `GET /api/zonas?localId=` por ser el contrato realmente ejecutado por el frontend — a confirmar.
  2. `POST /api/incidents/:id/acciones` — el contrato documenta el body como `{ descripcion, responsableId, fechaLimite }`, pero el handler MSW real exige `{ titulo, descripcion, responsableId, plazoFecha, prioridad }` (falla 400 si faltan). Este cambio implementará el body real del handler — a confirmar.
  3. `PATCH /api/incidents/:incidenteId/acciones/:acId/cerrar` sí tiene una implementación completa y funcional en el MSW real (`descripcionEvidencia` requerido, `evidenciaUrl?` opcional) pese a que el contrato lo marca sin especificar — se documenta como hallazgo, pero se respeta la instrucción explícita de no implementarlo en este cambio.
  4. Flags ya conocidos del contrato que siguen abiertos y aplican a este cambio: #2 (shape `data.items` de la lista, se implementa tal cual), #6 (Áreas como catálogo compartido, se implementa tal cual con nota de riesgo de diseño de esquema).
