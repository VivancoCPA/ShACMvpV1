## Context

`/dashboard` ya resuelve el tipo `AUDITOR` para el rol `AUDITOR_INTERNO` (`dashboardRoleMapping.ts`) y el backend mock ya construye un `AuditorDashboardData` (`buildAuditorData()` en `dashboard.handlers.ts`), pero ese tipo nunca tuvo un componente consumidor: `DashboardPage.tsx` no tiene rama para `dashboardType === 'AUDITOR'` y cae al fallback `<ComingSoon label="Dashboard" />`. El placeholder actual (`hallazgosAuditoriaAbiertos`, `ncPorOrigenAuditoria`, `kpisCumplimiento`, `documentosProximaRevision`) fue sembrado especulativamente en M5-S01 y no refleja el alcance funcional real pedido para este spec — se reemplaza íntegramente.

El origen O3 (`O3_HALLAZGO_AUDITORIA`) no tiene un campo estructurado de normativa vinculada: solo `hallazgoAuditoriaRef: string` (texto libre, obligatorio al crear un QE de origen O3 según `qualityEventCreate.schema.ts`, pero sin garantía de contenido ISO — el fixture `qe-2026-015` referencia "Auditoría Operacional", no una norma ISO). Agrupar el widget 1 por "normativa" habría requerido parsear ese texto libre con heurísticas frágiles o agregar un campo nuevo al modelo de `QualityEvent` — ambas cosas fuera de lo que un dashboard de solo lectura debe decidir. Se agrupa por `areaAfectada` en su lugar y se documenta el gap de datos como pendiente de un spec correctivo de M4.

Todos los QE `origen O3` existentes en fixtures (`qe-2026-003`, `007`, `011`, `015`, `019`) tienen hoy `documentosVinculados: []`. Sin al menos un caso positivo, el widget de evidencias sería `0 con evidencia / 5 sin evidencia` — no verificable de forma significativa en navegador.

## Goals / Non-Goals

**Goals:**
- Dar a `AUDITOR_INTERNO` un dashboard real en `/dashboard`, reemplazando el `<ComingSoon />`.
- Reutilizar exactamente la fórmula de "en plazo" de KPI-01 (`calcularKpi01`/`qeCerradosEnPeriodo`/`PLAZO_MAXIMO_QE_DIAS_HABILES`, ya corregida en `m5-s01-fix-kpis-prd` para usar `fechaCierre` real y el plazo por severidad, no un umbral plano) para el widget de tasa de cierre por área, cambiando únicamente el agrupador de global a `areaAfectada`.
- Documentar explícitamente, no resolver, el gap de datos de "normativa vinculada" para origen O3.

**Non-Goals:**
- Agregar el campo estructurado `normativaVinculada`/`clausulaVinculada` a `QualityEvent` (gap de M4, fuera de alcance).
- Exportar evidencias para auditoría externa (diferido a S09/v1.1).
- Cualquier cambio de RBAC/routing (`AUDITOR_INTERNO` ya tiene acceso a `/dashboard` desde M5-S01).
- Agregar un filtro por `areaAfectada` a `QEListParams`/`QEList` (ver Decisión 3 — ninguno de los widgets lo necesita).

## Decisions

### 1. `AuditorDashboardData` se reemplaza por completo, no se extiende

El placeholder actual nunca fue renderizado por ningún componente (no hay `AuditorDashboard.tsx`), así que no existe ningún consumidor real que se rompa. Extender el placeholder con 4 campos más habría dejado 4 campos muertos (`hallazgosAuditoriaAbiertos`, `ncPorOrigenAuditoria`, `kpisCumplimiento`, `documentosProximaRevision`) sin ningún widget que los use — código muerto desde el día uno. Se reemplaza por:

```typescript
export interface AuditorDashboardData {
  hallazgosPorArea: { area: string; total: number }[]
  hallazgosPorEstado: Record<QEStatus, number>
  evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }
  tasaCierreEnPlazoPorArea: { area: string; tasaCierreEnPlazo: number; totalCerrados: number }[]
}
```

**Alternativa considerada**: mantener los 4 campos viejos y agregar los 4 nuevos. Rechazada — ningún widget futuro planeado reutiliza `ncPorOrigenAuditoria`/`documentosProximaRevision`, y `dashboard-types` ya documenta (regla del proyecto) que cada rol expone solo sus propios widgets sin campos no consumidos.

### 2. Widget 1 agrupa por `areaAfectada`, no por normativa — gap de datos, no de diseño

Ver Contexto: `hallazgoAuditoriaRef` es texto libre sin garantía de contenido ISO. `hallazgosPorArea` reutiliza el mismo patrón de distribución que `calcularKpi09` (`dashboard.handlers.ts:301-312`, "NCs por área"): `Map<area, count>` → `.sort((a,b) => b.total - a.total)`, filtrando primero por `origen === 'O3_HALLAZGO_AUDITORIA'`.

### 3. Navegación de cada widget: solo donde el filtro ya existe en `QEListParams`, sin agregar ninguno nuevo

`QEListParams` hoy soporta `estado`, `tipo`, `severidad`, `origen`, `fechaDesde/Hasta`, `ciclo`, `soloReincidencias` — **no** `areaAfectada`. Esto determina qué filas son clicables:

- **Widget 1 (hallazgos por área)**: filas no interactivas (conteo puro), igual que el desglose de `calcularKpi09` no tiene navegación propia. Agregar un filtro por área a `QEList` sería lógica nueva, fuera del alcance declarado ("sin lógica nueva").
- **Widget 2 (estado de hallazgos)**: mismo patrón visual que `QEPorEstadoWidget` (`components/QEPorEstadoWidget.tsx`), pero como componente propio `HallazgosPorEstadoWidget` — no se reutiliza el componente compartido porque este widget necesita navegar con **ambos** filtros (`estado` + `origen=O3_HALLAZGO_AUDITORIA`) para **todos** los 9 estados (a diferencia de `QEPorEstadoWidget`, que solo hace navegable un subconjunto de estados "accionables" para Jefe de Calidad — un auditor de solo lectura quiere poder inspeccionar cualquier estado). Modificar el componente compartido para soportar un `origen` opcional y una lista de estados navegables configurable habría acoplado un widget de Jefe de Calidad a una necesidad de Auditor Interno sin beneficio mutuo — tres líneas duplicadas son preferibles a esa abstracción prematura.
- **Widget 3 (evidencias disponibles)**: dos números/barra, sin fila individual, sin navegación (explícito en el alcance: "no como lista completa").
- **Widget 4 (tasa de cierre por área)**: fila informativa por área (porcentaje + total cerrados), no interactiva — es una métrica agregada de desempeño, no una lista de QEs.

La frase genérica "cada fila de los widgets 1-3 enlaza a QEDetail" del alcance funcional se resuelve entonces así: solo el widget 2 tiene filas navegables (a una lista filtrada, no a un QEDetail individual — no hay una fila por QE en ningún widget de este spec, todos son agregados), consistente con que ninguno de los 4 widgets es una lista de QEs individuales sino desgloses/conteos.

### 4. Tasa de cierre por área reutiliza `qeCerradosEnPeriodo` + `PLAZO_MAXIMO_QE_DIAS_HABILES` sin fórmula nueva

```typescript
const periodo = currentPeriodo()
const { start, end } = monthRange(periodo)
const cerrados = qeCerradosEnPeriodo(qes, start, end) // ya filtra estado CERRADO/VERIFICADO + fechaCierre en rango
// agrupar `cerrados` por areaAfectada, y por cada grupo:
const enPlazo = grupo.filter((qe) => contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date(qe.fechaCierre!)) <= PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad])
tasaCierreEnPlazo = pct(enPlazo.length, grupo.length)
```

Esto es exactamente `calcularKpi01`, con el `filter`/`reduce` final agrupado por `areaAfectada` en vez de aplicado al total. Evita repetir el bug que M5-S06 tuvo que corregir (comparar contra `actualizadoEn`/sin excluir estados no terminales): al reutilizar `qeCerradosEnPeriodo` tal cual, el universo de "cerrado" (`CERRADO`/`VERIFICADO` + `fechaCierre` real en el período) queda idéntico al de KPI-01, no una reinterpretación nueva.

Áreas sin ningún QE cerrado en el período quedan fuera de `tasaCierreEnPlazoPorArea` (no se fuerza `0/0` → división por cero evitada, igual que `calcularKpi01` retorna `0` solo cuando `cerrados.length === 0` a nivel global). Orden: ascendente por `tasaCierreEnPlazo` (peor desempeño primero) — es la vista que un auditor necesita para priorizar seguimiento, a diferencia de `calcularKpi09` que ordena descendente por ser una métrica de concentración de volumen, no de desempeño.

### 5. "Evidencia disponible" = `documentosVinculados.length > 0`

`QualityEvent` no tiene un campo de adjuntos general; `documentosVinculados: string[]` es el único campo a nivel de QE que representa evidencia/soporte documental vinculado (a diferencia de `evidenciaUrl`/`descripcionEvidencia`, que viven en cada `AccionCorrectiva` y describen el cierre de una acción correctiva, no el hallazgo en sí). Se documenta como asunción explícita: un hallazgo "tiene evidencia" si tiene al menos un documento vinculado.

**Alternativa considerada**: contar también hallazgos donde alguna `accionCorrectiva.evidenciaUrl` esté presente. Rechazada — mezclaría "evidencia del hallazgo" con "evidencia de cierre de una acción correctiva", que son preguntas distintas; el auditor de este widget busca específicamente soporte documental del hallazgo, no de su remediación.

### 6. Enriquecimiento de fixtures: 2 QE O3 ganan `documentosVinculados`

Los 5 fixtures O3 actuales tienen `documentosVinculados: []`. Se agrega al menos 1 documento existente (reutilizando IDs ya sembrados en `documents.fixtures.ts`, sin inventar nuevos documentos) a 2 de los 5 QE O3, dejando al menos 2 sin ninguno — para que `evidenciasHallazgos` muestre un contraste real (`con evidencia` > 0 y `sin evidencia` > 0) verificable en navegador.

## Risks / Trade-offs

- **[Riesgo]** Con solo 5 fixtures O3 y 5 áreas distintas, `hallazgosPorArea` mostrará 1 hallazgo por área — poco contraste visual de "concentración". → **Mitigación**: no se requiere enriquecer más allá de lo necesario para el widget de evidencias (Decisión 6); el widget sigue siendo correcto con datos escasos, solo menos ilustrativo. No se agregan QE O3 sintéticos adicionales solo por estética.
- **[Riesgo]** `tasaCierreEnPlazoPorArea` puede quedar vacío o con pocas filas si ningún QE cerró en el período actual (mes corriente). → **Mitigación**: mismo comportamiento que KPI-01 (0 cuando no hay cerrados); se documenta como estado vacío esperado, no un bug, y se verifica en navegador con el seed existente (hay QEs `CERRADO`/`VERIFICADO` con `fechaCierre` reciente, ver `qe-2026-021`, `qe-2026-009`).
- **[Gap conocido, no bloqueante]** `tasaCierreEnPlazoPorArea` agrupa correctamente TODOS los orígenes de QE (sin filtrar por O3, tal como pide el spec — ver Decisión 4), pero su cobertura de áreas en el período actual está limitada por el seed, no por el cálculo. Galpón B, Galpón C, Almacén Norte y Almacén Sur (las áreas asignadas a los 2 Supervisores de `auth.fixtures.ts`) no aparecen en el mes corriente porque ningún QE de esas áreas tiene `fechaCierre` dentro del mes calendario en curso — coincidencia agravada por que el generador sintético de tendencia mensual (`buildTendenciaSeedQE()`, M5-S05b) excluye deliberadamente esas 4 áreas de `AREAS_ROTACION` (`quality-events.fixtures.ts:311-318`) para no romper el conteo exacto por Supervisor que verifica `useDashboardSummary.test.ts`. No es un defecto de este widget: el cálculo es correcto sobre los datos existentes vía `qeCerradosEnPeriodo`; el widget mostrará más o menos áreas según qué se haya cerrado ese mes específico. → **Mitigación**: ninguna en este spec (fuera de alcance); ampliar `AREAS_ROTACION` para cubrir esas 4 áreas queda pendiente para cuando se revise `useDashboardSummary.test.ts` en conjunto, evitando tocar esa suite de paso en un spec de dashboard.
- **[Riesgo]** El gap de "normativa vinculada" puede reaparecer en specs futuros de auditoría si no queda documentado en un lugar visible. → **Mitigación**: documentado en `proposal.md` y en este `design.md`; queda como pendiente explícito de M4, no enterrado en un comentario de código.

## Migration Plan

No hay migración de datos real (mock-only, MSW). Pasos de despliegue:
1. Reemplazar `AuditorDashboardData` (`dashboardData.types.ts`).
2. Reescribir `buildAuditorData()` (`dashboard.handlers.ts`).
3. Enriquecer `documentosVinculados` en 2 fixtures O3 (`quality-events.fixtures.ts`).
4. Construir los 4 widgets + `AuditorDashboard.tsx`, cablear en `DashboardPage.tsx`.
5. i18n (`es-PE.json`/`en-US.json`).
6. Verificación en navegador con `auditor@shac.pe` / `Shac2025!`.

Rollback: revertir el commit — no hay estado persistente fuera del código/fixtures.

## Open Questions

- ¿El campo estructurado `normativaVinculada`/`clausulaVinculada` (gap de M4 documentado aquí) debería incluir también un valor `OTRO` para hallazgos no-ISO (como `qe-2026-015`), o todo origen O3 debe ser ISO por definición y ese fixture es un dato de seed incorrecto? Queda para el spec correctivo de M4.
