## Context

`QualityEvent.hallazgoAuditoriaRef` es hoy un `string` libre, usado únicamente por QEs de `origen === 'O3_HALLAZGO_AUDITORIA'`. En los fixtures actuales ya sigue informalmente una convención `"HAL-YYYY-NNN · <Norma> · §<Cláusula>"` (5 QEs O3 existentes: QE-2026-003, 007, 011, 015, 019), pero no hay tipo ni validación que la exija — RN-QE-010 (obligatoriedad de la cláusula) nunca se implementó como bloqueo real. Esto también forzó a `HallazgosPorAreaWidget` (dashboard de `AUDITOR_INTERNO`, de `m5-s07-dashboard-auditorinterno`) a agrupar por `areaAfectada` en vez de por norma, porque no existía un campo estructurado para agrupar.

`HallazgosPorAreaWidget` ya está implementado en código (`buildHallazgosPorArea()` en `dashboard.handlers.ts`, componente en `features/dashboard/components/`), pero su spec capability `dashboard-auditor-view` todavía no está sincronizada a `openspec/specs/` (el cambio `m5-s07-dashboard-auditorinterno` sigue pendiente de archivo). Este diseño asume que esa sincronización ocurre antes o junto con este cambio.

## Goals / Non-Goals

**Goals:**
- Estructurar `normativaVinculada` como tipo propio, con catálogo curado de cláusulas ISO para selección rápida y fallback de texto libre para casos no cubiertos (SUNAT, MINEM, auditorías internas no-ISO).
- Restaurar RN-QE-010 como bloqueo real de creación para origen O3.
- Migrar los 5 QEs O3 existentes en fixtures a la nueva forma, sin dejar rastro de `hallazgoAuditoriaRef`.
- Corregir `HallazgosPorAreaWidget` para agrupar por `normativaVinculada.norma` en vez de `areaAfectada`.

**Non-Goals:**
- Drill-down a cláusula/subcláusula dentro del widget de dashboard (queda como agrupación por `norma` únicamente en esta iteración; agrupar además por cláusula principal se deja para una spec futura si se necesita).
- Comparativa de KPIs por norma entre locales (diferido a v2.0, OBS-ADD03-003).
- Cualquier cambio a RN-QE-014 (ventana de corrección, antes RN-QE-010) — ya resuelto en el fix de renumeración previo.
- Validación server-side (MSW) de `normativaVinculada` en creación — el patrón existente para campos condicionales por origen (`incidenteId`, `ncId`, `reporteExternoRef`) vive únicamente en el schema Zod del cliente; no se introduce una excepción para O3.

## Decisions

**1. `NormativaVinculada` como objeto anidado, no campos planos.**
`{ norma: NormaISO; clausula: string; normaOtraDetalle?: string }` en vez de `normaVinculada` + `clausulaVinculada` sueltos en `QualityEvent`. Razón: mantiene el concepto agrupado, facilita pasar el objeto completo al combobox y al widget de dashboard sin destructurar, y dejará espacio a futuros campos (p. ej. `version` de la norma) sin ensuciar el nivel superior de `QualityEvent`.

**2. Catálogo de cláusulas: array estático de 2 niveles por norma, no un mapa plano con notación de puntos.**
`clausulasISO.constants.ts` exporta `Record<'ISO_9001_2015' | 'ISO_45001_2018', ClausulaISO[]>` donde `ClausulaISO = { codigo: string; titulo: string; subclausulas?: { codigo: string; titulo: string }[] }`. Alternativa descartada: lista plana `"8.4.1 — Control de procesos..."` sin jerarquía — se descarta porque el combobox necesita poder mostrar cláusula padre y subcláusula como opciones jerárquicas búscables independientemente, y porque los ejemplos existentes en fixtures (`§8.4.1`, `§7.1.5`) ya son de 2 niveles.

**3. Migración de fixtures: mapeo manual 1:1, aprovechando que el texto libre ya sigue el patrón `"HAL-CODIGO · NORMA · §CLAUSULA"`.**
Los 5 QEs O3 existentes se migran así:

| QE | hallazgoAuditoriaRef actual | hallazgoCodigo | normativaVinculada |
|---|---|---|---|
| QE-2026-003 | `HAL-2026-001 · ISO 9001:2015 · §8.4.1` | `HAL-2026-001` | `{ norma: 'ISO_9001_2015', clausula: '8.4.1' }` |
| QE-2026-007 | `HAL-2026-002 · ISO 9001:2015 · §7.1.5` | `HAL-2026-002` | `{ norma: 'ISO_9001_2015', clausula: '7.1.5' }` |
| QE-2026-011 | `HAL-2026-003 · ISO 45001:2018 · §8.2` | `HAL-2026-003` | `{ norma: 'ISO_45001_2018', clausula: '8.2' }` |
| QE-2026-015 | `HAL-2026-004 · Auditoría Operacional · §3.2` | `HAL-2026-004` | `{ norma: 'OTRA', normaOtraDetalle: 'Auditoría Operacional', clausula: '3.2' }` |
| QE-2026-019 | `HAL-2026-005 · ISO 9001:2015 · §8.5.2` | `HAL-2026-005` | `{ norma: 'ISO_9001_2015', clausula: '8.5.2' }` |

QE-2026-015 es el caso interesante: "Auditoría Operacional" no es una norma ISO, confirmando que el catálogo necesita el fallback `'OTRA'` desde el primer lote de datos migrados, no solo como caso hipotético.

Las entradas de `auditTrail` en fixtures que referencian `campoModificado: 'hallazgoAuditoriaRef'` (QE-2026-011, QE-2026-019) se actualizan a `campoModificado: 'normativaVinculada'` con `valorNuevo` ajustado a la representación de texto del nuevo objeto — son datos de demostración, no un audit trail real de producción, así que no aplica la invariante de inmutabilidad de audit trail de sistemas reales.

**4. Widget agrupa solo por `norma`, no por cláusula, en esta iteración.**
`buildHallazgosPorArea()` se renombra a `buildHallazgosPorNorma()` y agrupa `Map<NormaISO, number>` en vez de `Map<string, number>` sobre `areaAfectada`. Se descarta agrupar además por cláusula principal en la misma iteración porque el catálogo de cláusulas es amplio (2 niveles × 2 normas) y una tabla de conteos por cláusula individual tendría demasiadas filas de 1 para ser útil sin una segunda capa de UI (acordeón o drill-down) que no está en el alcance de esta spec — se deja como extensión futura si Auditoría la pide.

## Risks / Trade-offs

- [Riesgo] `dashboard-auditor-view` no existe todavía en `openspec/specs/` porque `m5-s07-dashboard-auditorinterno` sigue sin archivar → Mitigación: el delta spec de `dashboard-auditor-view` en este cambio se escribe asumiendo que ese archivo ya ocurrió; si al aplicar este cambio `m5-s07` sigue sin archivar, se archiva primero (o se coordina el orden de aplicación) para evitar un delta spec huérfano.
- [Riesgo] Cambiar la forma de `hallazgosPorArea` a `hallazgosPorNorma` en `AuditorDashboardData` es un cambio de forma de API interna (mock) → Mitigación: es interno y sin consumidor externo real (mismo patrón **BREAKING** ya aceptado en `m5-s07` para `AuditorDashboardData`); se actualiza el único consumidor (`AuditorDashboard.tsx`) en el mismo cambio.
- [Riesgo] El caso `norma === 'OTRA'` en QE-2026-015 no tiene un "grupo" claro en el widget corregido si dos hallazgos 'OTRA' tienen `normaOtraDetalle` distintos (p. ej. SUNAT vs MINEM) → Mitigación: para el widget, todos los `norma === 'OTRA'` se agrupan bajo una sola fila "Otra normativa" (sin desglosar por `normaOtraDetalle`), documentado explícitamente en el spec de `dashboard-auditor-view`; desglosar por `normaOtraDetalle` queda fuera de alcance.
- [Trade-off] No se valida `normativaVinculada` en MSW (solo cliente) → aceptado porque es el patrón ya establecido para todos los campos condicionales por origen (O1/O2/O4); introducir una excepción solo para O3 añadiría inconsistencia sin beneficio real dado que no existe backend real todavía.

## Migration Plan

1. Fix de renumeración RN-QE-010→014/011→015/012→016 (ya aplicado, fuera de OpenSpec, previo a este cambio).
2. `quality-event-normativa-catalog`: nuevo tipo + catálogo + combobox (sin dependencias de los demás).
3. `quality-event-types`: reemplazar `hallazgoAuditoriaRef` por `hallazgoCodigo`/`normativaVinculada`.
4. `quality-event-schemas`: actualizar rama O3 de `qualityEventCreateSchema` y el schema de edición RN-QE-014.
5. `quality-event-form`: reemplazar el input de `hallazgoAuditoriaRef` por el combobox + `hallazgoCodigo`.
6. `quality-event-msw-fixtures`: migrar los 5 QEs O3 según la tabla de la Decisión 3.
7. `dashboard-auditor-view`: renombrar `buildHallazgosPorArea` → `buildHallazgosPorNorma`, actualizar `AuditorDashboardData['hallazgosPorArea']` → `hallazgosPorNorma`, actualizar `HallazgosPorAreaWidget` (o renombrarlo) y `AuditorDashboard.tsx`.
8. Verificar que KPI-01 a KPI-09 no leen `hallazgosPorArea`/`areaAfectada` de este widget (deberían ser independientes — confirmar antes de archivar).

No hay rollback especial: es un cambio de tipos + fixtures + un componente de dashboard, sin backend real ni datos de producción persistentes.

## Open Questions

- ¿El catálogo `clausulasISO.constants.ts` debe cubrir el 100% de cláusulas de ambas normas o solo las secciones más citadas en hallazgos reales de auditoría? Se asume cobertura completa de ambas normas en el primer corte (catálogo estático, sin costo de mantenimiento por ahora), pero puede recortarse en `tasks.md` si el volumen resulta excesivo para un solo archivo de constantes.
