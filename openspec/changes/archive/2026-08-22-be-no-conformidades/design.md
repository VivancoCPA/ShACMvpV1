## Context

`ShcMvpEndPoint` tiene hoy tres módulos reales: Auth, Empresas, e Incidentes SyST (M3) + catálogos Áreas/Locales/Zonas (`be-incidentes-catalogos`, archivado). Todos siguen el mismo patrón VSA: `Features/<Modulo>/<Accion>/{Command,Endpoint,Handler,Validator}.cs`, entidades en `ShcMvpEndPoint.Domain/Entities`, CQRS (Dapper para `GET`, EF Core para mutaciones), multi-tenancy filtrando por `empresaId` de la sesión activa con 404-nunca-403, numeración correlativa vía `EmpresaSecuencia` (clave compuesta `EmpresaId, Tipo, Anio`).

Este cambio agrega el tercer módulo de dominio: No Conformidades (M2). El frontend (`shc-controldoc`) ya tiene el contrato de referencia implementado en MSW (`src/mocks/handlers/nonconformities.handlers.ts`) — es la fuente de verdad por encima de las instrucciones originales de Cowork y del PRD cuando divergen (mismo criterio aplicado en `be-incidentes-catalogos`; ver proposal.md, sección "Impact", para el detalle completo de discrepancias encontradas y corregidas).

## Goals / Non-Goals

**Goals:**
- Endpoints reales de No Conformidades con paridad de comportamiento contra `nonconformities.handlers.ts`: CRUD de NC, acciones correctivas, soft-delete/restore, detección de duplicados (RN-NC-005), numeración `NC-<DOM>-YYYY-NNN` correlativa por empresa+dominio, multi-tenancy.
- Mantener el patrón CQRS ya establecido (Dapper para `GET`, EF Core para mutaciones), sin LINQ en lecturas, sin MediatR, sin Controllers.
- Reutilizar `EmpresaSecuencia` y el patrón de audit trail append-only ya validados en Incidentes, sin reinventar ningún mecanismo.

**Non-Goals:**
- Creación automática de Quality Event (QE no existe en el backend).
- `GET /api/users` (M6, fuera de alcance).
- Envío real de notificaciones — solo el hook no-op.
- Job de marcado automático de AC a `VENCIDA`.
- Validación de `responsableId` de una AC contra permisos reales de módulo (RN-NC-004 — requiere RBAC de M6).
- Validación de secuencia de la máquina de estados en `PATCH /:id` — el mock real tampoco la valida (cualquier `estado` es aceptado mientras el actual no sea `CERRADA`/`ANULADA`); replicar esa misma permisividad, no inventar una máquina de estados que el frontend no espera.

## Decisions

### D1 — Estructura de Features
`Features/NoConformidades/{CrearNoConformidad,ListarNoConformidades,ObtenerNoConformidad,ActualizarNoConformidad,AnularNoConformidad,EliminarNoConformidad,RestaurarNoConformidad,CrearAccionCorrectiva,ActualizarAccionCorrectiva,CerrarAccionCorrectiva}/`, cada uno con Command/Endpoint/Handler (+Validator donde aplique), replicando exactamente el patrón de `Features/Incidentes/*`. `Features/NoConformidades/Shared/` para: generador de número (`NoConformidadNumeroGenerator`), detector de duplicados (RN-NC-005), notificador no-op (`INoConformidadNotificationSender`/`NoOpNoConformidadNotificationSender`).

### D2 — Entidades de dominio
`NoConformidad` (con `AccionesCorrectivas` como colección propia `AccionCorrectivaNC`, FK `NoConformidadId`, igual patrón que `AccionCorrectivaIncidente`), `NoConformidadAuditTrail` (append-only, FK `NoConformidadId`, mismos campos que `IncidenteAuditTrail`). No se agrega ninguna entidad de catálogo nueva — `AreaId` referencia el mismo catálogo `Area` por-empresa ya creado en `be-incidentes-catalogos` (sin FK enforcement, mismo criterio que `Incidente.AreaId`: no hay lookup ni validación contra la tabla `Area` en este cambio).

### D3 — Numeración correlativa `NC-<DOM>-YYYY-NNN`, por empresa + dominio
A diferencia de Incidentes (`INC-YYYY-NNN`, correlativo solo por `empresaId + año`), el mock real de NC calcula el correlativo contando `nonconformities.filter(nc => nc.dominio === dominio && nc.empresaId === empresaId).length + 1` — es decir, la secuencia es independiente por cada combinación `(empresaId, dominio)`, no solo por empresa. Se replica usando `EmpresaSecuencia` con `Tipo = $"NC-{DominioPrefix[dominio]}"` (`CAL|SST|ADU|OPE|PRV`) como parte de la clave compuesta `(EmpresaId, Tipo, Anio)`, con el mismo upsert atómico (`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`) dentro de la misma transacción de creación que ya usa `IncidenteNumeroGenerator`. Número final: `$"NC-{prefix}-{anio}-{valor:D3}"`.

### D4 — `requiereIPER` calculado server-side, no confiado del cliente (corrige el mock)
El mock real toma `requiereIPER` del body (`?? false`), sin calcularlo. Este backend ignora cualquier valor de `requiereIPER` enviado por el cliente y lo calcula siempre como `dominio === 'SST'` — mismo criterio ya aplicado a la severidad de Incidentes (D4 de `be-incidentes-catalogos`): nunca confiar en el cliente para un campo derivable server-side. RN-NC-001 (creación de QE con IPER) queda solo como el cálculo del flag — no se crea ningún QE, mismo criterio que en Incidentes.

### D5 — RN-NC-002 (notificación Comercio Exterior) como hook no-op
Al crear una NC con `dominio === 'ADUANERO'`, se invoca `INoConformidadNotificationSender.NotificarComercioExterior(...)` (best-effort, try/catch tras `SaveChangesAsync`, nunca bloquea la respuesta), implementado como `NoOpNoConformidadNotificationSender` con TODO explícito — mismo patrón que `IIncidenteNotificationSender`. El campo `NotificacionComercioExterior` (fecha/referencia/descripción) queda `null` en la creación; solo se llenará cuando exista un flujo real de envío.

### D6 — RN-NC-005: detección de duplicados contra `CreadoEn`, no `FechaDeteccion`
Confirmado por el handler MSW real (`new Date(nc.creadoEn).getTime() > thirtyDaysAgo`) y por el spec `nc-msw-handlers` existente (coinciden en este punto, sin conflicto). Al crear una NC, si `command.Forzar !== true`, se buscan otras NC de la misma empresa con mismo `Dominio` + `AreaId` y `CreadoEn` dentro de los últimos 30 días. Si hay coincidencias, la NC se crea igual (201) pero la respuesta incluye `warning: "POSIBLE_DUPLICADO"` y `ncsSimilares: NoConformidad[]`. Si `Forzar === true`, se omite la detección.

### D7 — Soft-delete + restore de NC (decisión de Toño, 2026-08-19 — revierte la instrucción original de Cowork)
Las instrucciones originales de este cambio decían explícitamente "no agregar `DeletedAt`, RN-NC-003 prohíbe eliminar". Se verificó contra el frontend real antes de implementar: `NCList.tsx` ya tiene botones "Eliminar"/"Restaurar" completamente cableados (gateados por `ncPermissions.canDelete`/`canRestore`, solo `JEFE_CALIDAD_SYST`, y solo si `nc.estado === 'ABIERTA'` para eliminar), más un filtro `showDeleted` en la lista — es una feature real y en uso, no un artefacto accidental del mock. Se escaló como pregunta genuina (no se resolvió unilateralmente, seguiendo la regla del contexto de specs sobre colisiones) y Toño confirmó implementar `DELETE /api/nonconformities/:id` (soft-delete, solo si `estado === 'ABIERTA'` y no eliminada ya) + `PATCH /api/nonconformities/:id/restore` (solo si `deletedAt` está definido), replicando exactamente `EliminarIncidenteHandler`/`RestaurarIncidenteHandler`. **Reconciliación de RN-NC-003**: queda documentada como superada por esta decisión, mismo patrón ya usado para RN-INC-006 vs. el texto original del PRD §3 (ver `CLAUDE.md`, nota técnica de Incidentes) — la regla del PRD describía una intención que el frontend real ya no sigue; este backend implementa el frontend real, no el texto literal de la regla.

### D8 — `POST .../acciones-correctivas/:acId/cerrar` fija `estado: 'CERRADA'` (decisión de Toño, 2026-08-19 — corrige el spec `nc-msw-handlers`)
El handler MSW real ejecuta `estado: 'CERRADA'` al cerrar una AC; el spec `nc-msw-handlers` (openspec/specs) documentaba `COMPLETADA`, y ningún test cubre este endpoint para desempatar. Se escaló como pregunta genuina y Toño confirmó seguir el código real: `CERRADA`. El spec `nc-msw-handlers` queda desactualizado en este punto — su corrección es responsabilidad de un cambio de frontend futuro, fuera de alcance de este backend (no se edita ningún artefacto de `shc-controldoc` en este cambio).

### D9 — Shape de la lista: `{ items, pagination }` anidado bajo `data` (corrige la instrucción original)
Confirmado por el handler real (`return ok({ items, pagination })`) y por `nonconformities.handlers.test.ts` (`data.items.some(...)`). Mismo shape que Incidentes — la instrucción original de Cowork asumía incorrectamente un shape plano `{ data: NoConformidad[], pagination }` "a diferencia de Incidentes"; en realidad no hay diferencia entre ambos módulos en este punto.

### D10 — Campos de creación de NC y de AC: shape real vs. instrucción original
`POST /api/nonconformities` requiere `origen, tipo, severidad, areaId, descripcion, fechaDeteccion, dominio, titulo, fechaCierre` (9 campos — la instrucción original omitía `titulo` y `fechaCierre`, y usaba `areaAfectada` en vez de `areaId`). `fechaCierre` en creación es la fecha límite **esperada** de cierre (deadline de negocio), no la fecha real de cierre efectivo — se persiste tal cual la envía el cliente, sin cálculo server-side. `POST .../acciones-correctivas` requiere `titulo, descripcion, responsableId, plazoFecha, prioridad` (5 campos — la instrucción original omitía `titulo` y `prioridad`), mismo tipo de gap ya encontrado y corregido en Incidentes (D7 de `be-incidentes-catalogos`).

### D11 — Dev seed
No se requiere seed nuevo de catálogos — Áreas ya está sembrada por empresa desde `be-incidentes-catalogos`. Sin datos de desarrollo propios de No Conformidades en este cambio (mismo criterio que Incidentes: la app arranca sin NCs, se crean vía UI/API).

## Risks / Trade-offs

- [Riesgo] La secuencia `NC-<DOM>-YYYY-NNN` (D3) introduce una dimensión adicional (`dominio`) a la clave de `EmpresaSecuencia` respecto al patrón `INC-YYYY-NNN` de Incidentes → Mitigación: `Tipo` ya es una columna de texto libre en `EmpresaSecuencia`, así que `"NC-CAL"`, `"NC-SST"`, etc. son valores válidos sin cambio de esquema; el upsert atómico ya existente maneja la concurrencia igual que con Incidentes.
- [Riesgo] D7 (soft-delete/restore) contradice RN-NC-003 tal como está escrita en el PRD → Mitigación: documentado explícitamente como reconciliación PRD-vs-implementación en proposal.md y en esta decisión (D7), con la misma metodología ya usada para RN-INC-006. Si en el futuro se decide alinear el PRD con el comportamiento real, es un cambio de documentación, no de código.
- [Riesgo] D8 (AC cerrar → `CERRADA`) dejará el spec `nc-msw-handlers` desactualizado (sigue documentando `COMPLETADA`) hasta que un cambio de frontend lo corrija → Mitigación: señalado explícitamente en proposal.md y en esta decisión; no se archiva este cambio con la expectativa de que ese spec quede corregido — es responsabilidad de un cambio de frontend separado.
- [Riesgo] Notificación como no-op (D5) puede dar falsa sensación de "completo" si nadie revisa el TODO → Mitigación: mismo criterio que Incidentes (D9 de `be-incidentes-catalogos`) — el reporte final de este cambio debe declarar explícitamente el estado de este hook.

## Migration Plan

1. Migración EF Core nueva: `AddNoConformidades` (`no_conformidades`, `acciones_correctivas_nc`, `no_conformidad_audit_trail`). Ninguna migración de catálogos — Área/Local/Zona no cambian.
2. Aplicar la migración (`dotnet ef database update`) antes de probar los endpoints nuevos.
3. Sin dev seed adicional — no hay filas de `empresa_secuencias` de tipo `NC-*` hasta la primera creación real (se generan en runtime, igual que con Incidentes).
4. Sin rollback especial más allá de revertir la migración — no hay datos de producción todavía.

## Open Questions

Las 4 preguntas originales del brief de Cowork quedaron resueltas leyendo código real de `shc-controldoc` (`nonconformity.types.ts`, `nonconformities.handlers.ts`) antes de escribir este documento — no requirieron confirmación de Toño porque el propio código (tipos TypeScript + handler ejecutado) las desambiguaba sin ambigüedad real:

1. ~~¿Existe un 5º dominio `NC-PRV` (Proveedor) o es un gap real del frontend?~~ — **RESUELTO**: sí existe, `NCDominio` incluye `PROVEEDOR` (`nonconformity.types.ts:25`). Ver D3 arriba (`DominioPrefix['PROVEEDOR'] = 'PRV'`).
2. ~~¿El estado inicial de creación es `DETECTADA` (un 8º estado no documentado en el enum) o `ABIERTA`?~~ — **RESUELTO**: `ABIERTA` — el enum `NCStatus` no tiene ningún valor `DETECTADA`, y el handler real (`estado: 'ABIERTA'`) lo confirma.
3. ~~¿`tipo` es un código derivado de `dominio` (`NC-CAL`) o un campo independiente?~~ — **RESUELTO**: independiente. `tipo: NCTipo = 'PROCESO'|'PRODUCTO'|'SERVICIO'|'SISTEMA'|'SST'` no tiene relación estructural con `dominio`.
4. ~~¿La ventana de 30 días de RN-NC-005 se mide contra `fechaDeteccion` o `creadoEn`?~~ — **RESUELTO**: `creadoEn`. Ver D6 arriba.

Dos preguntas nuevas, no anticipadas por el brief original, surgieron al verificar el código real y sí requirieron confirmación explícita de Toño (`AskUserQuestion`, 2026-08-19) por tratarse de conflictos genuinos entre el mock/frontend real y las reglas de negocio o instrucciones documentadas:

5. ~~¿El backend debe implementar soft-delete (`DELETE`) + restore de NC, replicando una feature real y en uso del frontend que contradice RN-NC-003, o debe seguir la regla tal como está escrita y omitir esos endpoints?~~ — **RESUELTO**: implementar `DELETE`/`restore`, replicando el frontend real. Ver D7 arriba.
6. ~~¿`POST .../acciones-correctivas/:acId/cerrar` debe fijar `estado: 'CERRADA'` (código real) o `estado: 'COMPLETADA'` (spec `nc-msw-handlers`/instrucción original)?~~ — **RESUELTO**: `CERRADA`, código real. Ver D8 arriba.

Este cambio sigue sin archivarse — la resolución de estas preguntas no implica cierre automático, eso lo decide Toño por separado cuando esté conforme con el resultado final de la implementación.
