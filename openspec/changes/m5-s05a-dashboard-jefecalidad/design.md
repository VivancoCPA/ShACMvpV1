## Context

M5-S01 dejó `JefeCalidadDashboardData` (tipo), `buildJefeCalidadData` (handler MSW) y `getDashboardDataTypeForRole` (mapea `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO` → `'JEFE_CALIDAD'`) listos, pero **sin ningún consumidor real**: `DashboardPage` solo tiene ramas para `OPERARIO` (M5-S03) y `SUPERVISOR` (M5-S04); los demás roles caen al placeholder `ComingSoon`. Esta spec es el primer consumidor real de `JefeCalidadDashboardData`, replicando el patrón ya establecido por M5-S03/S04: `DashboardPage` hace switch por `dashboardType`, cada widget es una `<section>` con contenedor bordeado (`overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20`), estado vacío como `<p>` centrado, y navegación por `onClick` en vez de embeber lógica de dominio.

Dos huecos bloquean una verificación real en navegador:
1. `JefeCalidadDashboardData` no tiene forma de exponer "QEs por estado" ni "ACs por vencer" itemizadas — hoy solo tiene agregados (`distribucionQEPorTipo`) y listas ya filtradas por otro criterio (`qeCriticosAbiertos`, `ncPendientesVerificacion`).
2. Los fixtures de QE no tienen `fechaCierre` top-level en los registros `CERRADO`/`EN_VERIFICACION`/`VERIFICADO`, por lo que KPI-03 (Tiempo Promedio de Cierre) y KPI-09 (Firma Dual en Cierre de QE Críticos) —ambos con fórmula `... para QE en CERRADO/VERIFICADO` filtrando por `fechaCierre` dentro del periodo— siempre calculan sobre un conjunto vacío y retornan `0`, sin importar el periodo consultado.

Se verificó en código (no se asume) que los 7 registros afectados (`qe-2026-004`, `008`, `009`, `010`, `016`, `020`, `021`) tienen `accionesCorrectivas: []` (sin ACs propias), por lo que no hay una fecha de cierre de AC interna con la que deba ser consistente el nuevo `fechaCierre` del QE — solo debe ser posterior a `causaRaizFirmadaEn` y anterior a `fechaVerificacionProgramada`/`fechaVerificacionRealizada` (cuando existan) y a la fecha actual del sistema.

## Goals / Non-Goals

**Goals:**
- Vista real en `/dashboard` para `JEFE_CALIDAD_SYST` y `JEFE_CONTROL_DOCUMENTARIO`, con datos de alcance organizacional completo (nunca filtrados por usuario ni área — a diferencia de `OperarioDashboard`/`SupervisorDashboard`).
- Los 9 KPIs completos, un desglose de QEs por los 9 estados reales de `QEStatus`, y ACs por vencer en 5 días agregando origen QE+NC.
- Primer consumidor real de `SemaforoCriticoBanner` (M5-S02) en producción — hasta ahora solo vive en `/dev/semaforo-preview`.
- Desbloquear KPI-03 y KPI-09 con datos verificables en navegador, poblando `fechaCierre` en los fixtures que lo necesitan.
- Documentar, con evidencia de código, qué campos de `JefeCalidadDashboardData` quedan sin consumidor tras esta spec (gap explícito, no silencioso).

**Non-Goals:**
- No se implementa tendencia mensual de cierres (`tendenciaMensualCierres`, ya existe en el tipo) — diferido a M5-S05b.
- No se construyen widgets para `qeCriticosAbiertos`, `ncPendientesVerificacion` ni `distribucionQEPorTipo` — existen en el tipo desde S01 sin consumidor, y el alcance funcional pedido para S05a no los incluye. Se documentan como gap, no se eliminan del tipo (evita romper el contrato ya usado por el handler).
- No se implementa lógica nueva de aprobación de análisis, firma de cierre ni gestión de plazos — las 3 acciones del PRD son enlaces de navegación a `/quality-events` (lista filtrada por estado) o `/quality-events/:id` (detalle), reutilizando 100% la lógica de M4.
- No se toca `RoleGuard` ni agrega roles a `/dashboard` — el guard de 6 roles ya existe desde M5-S01.
- No se tocan los dashboards de `AUDITOR_INTERNO` ni `ALTA_DIRECCION` (S06/S07).

## Decisions

### 1. Corrección de alcance frente al pedido original (QEStatus real, KPIs reales)

Verificado en código antes de diseñar:

| Pedido en la propuesta | Realidad en código | Decisión |
| --- | --- | --- |
| "8 estados": ABIERTO, EN_INVESTIGACION, EN_EJECUCION, PENDIENTE_CIERRE, CERRADO, EN_VERIFICACION, VERIFICADO_EFECTIVO, REABIERTO | `QEStatus` (`qualityEvent.types.ts:11-20`) tiene **9** valores: incluye `ANALISIS_COMPLETADO` entre `EN_INVESTIGACION` y `EN_EJECUCION`; el terminal positivo es `VERIFICADO`, no `VERIFICADO_EFECTIVO` | El widget de estado usa `Record<QEStatus, number>` con las 9 claves reales del enum (mismo patrón que `SupervisorDashboardData.qePorEstado`), no una lista hardcodeada de 8 |
| "KPI-03 (tasa de reincidencia)" | KPI-03 real = "Tiempo Promedio de Cierre de Quality Events" (`kpi.constants.ts:24-33`); la tasa de reincidencia es **KPI-07** y no depende de `fechaCierre` | El fix de fixtures sigue siendo necesario (KPI-03 sí depende de `fechaCierre`), solo se corrige la etiqueta en la documentación |
| "KPI-09 (NCs por área)" | KPI-09 real = "Cumplimiento de Firma Dual en Cierre de QE Críticos" (`kpi.constants.ts:84-93`); no existe un KPI de "NCs por área" en `KPI_DEFINITIONS` | Igual: el fix de `fechaCierre` desbloquea el KPI-09 real (depende de `fechaCierre` + `cierreFirmaSupervisorId`), no uno de "NCs por área" |

Ninguna corrección cambia el trabajo técnico pedido (el fix de `fechaCierre` sigue siendo el mismo), solo alinea las etiquetas con lo que el código realmente calcula.

### 2. Extensión de `JefeCalidadDashboardData` — 2 campos nuevos, sin endpoint nuevo

```typescript
export interface JefeCalidadDashboardData {
  kpis: KpiResult[]
  qeCriticosAbiertos: QEResumen[]
  ncPendientesVerificacion: NCResumen[]
  distribucionQEPorTipo: Record<QEType, number>
  qePorEstado: Record<QEStatus, number>                        // NUEVO
  accionesCorrectivasPorVencer: AccionCorrectivaResumen[]       // NUEVO
  tendenciaMensualCierres: { periodo: string; cerrados: number }[]
}
```

- `qePorEstado`: `getQeStore().reduce(...)` sobre **todos** los QE del sistema (sin filtro de `esControlDocumentario` — el desglose de estado es un dato organizacional, no depende de si el rol es Jefe de Calidad o Jefe de Control Documentario), mismo criterio que `buildSupervisorData.qePorEstado` pero sin filtrar por área.
- `accionesCorrectivasPorVencer`: `collectACsWithOrigin(qes, ncs, [])` — se pasa un array vacío de incidentes para excluir ese origen por diseño (el pedido es explícito: "Agrega ACs de origen QE y NC", no incidentes) — `.filter(({ac}) => ac.estado !== 'CERRADA' && ac.estado !== 'COMPLETADA' && diasHabilesRestantes(ac.plazoFecha) <= 5)`, replicando el patrón agnóstico al enum que ya usa `buildSupervisorData.accionesCorrectivasVencidas` (nunca comparar contra `ac.estado === 'EN_EJECUCION'` o similar). Se reutiliza `calcularEstadoSemaforoDesdeFecha`/`calcularDiasHabilesRestantes`, ya existentes en `dashboard/utils/semaforoPendientes.ts` y `utils/businessDays.ts` — no se reimplementa el cálculo de días hábiles.

Se decide **no** filtrar `accionesCorrectivasPorVencer` por `esControlDocumentario`: al igual que `qePorEstado`, es un agregado organizacional; ambos roles que comparten `JefeCalidadDashboardData` ven el mismo dato (a diferencia de `qeCriticosAbiertos`, que sí distingue por rol porque es una lista de QE críticos — un concepto propio de calidad/SyST, no de control documentario).

### 3. Widget de ACs por vencer: primer consumidor real de `SemaforoCriticoBanner` + `SemaforoRow`

"Por vencer en 5 días" incluye tanto las ya vencidas (estado semáforo `ROJO`, `diasHabilesRestantes < 1`) como las próximas a vencer (`AMARILLO`, `1–5` días hábiles) — nunca las `VERDE` (`> 5` días). Se separan visualmente:
- `SemaforoCriticoBanner` (M5-S02, sin consumidor real hasta ahora) para el subconjunto `ROJO` — encaja exactamente con su semántica ("eventos críticos sin cerrar").
- `SemaforoRow` (ya usado en `MisACsWidget`/`ACsVencidasWidget`) para el subconjunto `AMARILLO`, con el mismo mapa `ORIGEN_ROUTE` (`QE` → `/quality-events`, `NC` → `/nonconformities`) usado en los widgets de Operario/Supervisor.

Alternativa descartada: fusionar todo en una sola lista `SemaforoRow` (como hace `ACsVencidasWidget`). Se descarta porque el pedido explícito reutiliza ambos componentes compartidos, y separar ROJO en el banner le da al Jefe de Calidad una jerarquía visual inmediata de lo crítico vs. lo próximo — consistente con el propósito documentado de `SemaforoCriticoBanner`.

Consecuencia de mantenimiento: al ser el primer consumidor de producción de `SemaforoCriticoBanner`, se actualiza la tabla de páginas `/dev/*` en `CLAUDE.md` (sección "Páginas de referencia visual") para reflejar que este componente ya tiene consumidor real — no se elimina `/dev/semaforo-preview` en esta spec porque `SemaforoRow` standalone (fuera del contexto de este widget) sigue sin una página de producción propia que lo previsualice de forma aislada; se deja nota explícita de qué parte de la tabla queda desactualizada.

### 4. Widget de QEs por estado: conteo navegable, no lista itemizada

`qePorEstado` es `Record<QEStatus, number>`; el widget renderiza 9 filas fijas (una por `QEStatus`, usando `QEStatusBadge` para la etiqueta visual coherente con el resto del sistema) con el conteo. Dos filas son clicables como resolución de las acciones del PRD:
- Fila `ANALISIS_COMPLETADO` → navega a `/quality-events?estado=ANALISIS_COMPLETADO` ("Aprobar análisis": el Jefe de Calidad revisa los QE con análisis completo pendientes de pasar a ejecución).
- Fila `PENDIENTE_CIERRE` → navega a `/quality-events?estado=PENDIENTE_CIERRE` ("Firmar cierres").

Se verificó en código que `QEList` (`features/quality-events/components/QEList.tsx:170,208`) ya lee el filtro `estado` desde `useSearchParams`, por lo que este enlace no requiere ningún cambio en `QEList` ni una ruta nueva — es navegación pura. Las 7 filas restantes no son clicables (no hay una acción de PRD asociada a, por ejemplo, `ABIERTO` o `REABIERTO` desde este dashboard).

Alternativa descartada: hacer las 9 filas clicables por consistencia visual. Se descarta para no implementar navegación no solicitada por el PRD (mismo criterio ya aplicado en M5-S04, decisión 4, para "QEs por tipo").

### 5. Widget de KPIs: primer `KpiCard`/grid del sistema

Ningún widget existente renderiza `KpiResult[]` (`SupervisorDashboard` recibe `kpisArea` pero no lo pinta en ningún componente — gap heredado, fuera de alcance de esta spec, no se toca `SupervisorDashboard`). Se crea `KpiGridWidget`, primer componente que consume `KPI_DEFINITIONS` (para nombre/unidad) + `KpiResult` (para valor/meta/semáforo), formateando `valor`/`meta` según `unidad` (`PORCENTAJE` → `%`, `DIAS` → días, `TASA` → tasa por 1,000,000, `CONTEO` → entero), con color de `semaforo` mapeado a los tokens semánticos ya definidos (`VERDE`→`success`/teal, `AMARILLO`→`warning`/amber, `ROJO`→`error`), consistente con `SeverityTag`/`StatusBadge` del design system.

### 6. Integración en `DashboardPage` y `routing`

```tsx
if (dashboardType === 'OPERARIO') return <OperarioDashboard />
if (dashboardType === 'SUPERVISOR') return <SupervisorDashboard />
if (dashboardType === 'JEFE_CALIDAD') return <JefeCalidadDashboard />
return <ComingSoon label="Dashboard" />
```
Como `getDashboardDataTypeForRole` ya mapea tanto `JEFE_CALIDAD_SYST` como `JEFE_CONTROL_DOCUMENTARIO` a `'JEFE_CALIDAD'` (M5-S01), esta única rama cubre ambos roles sin lógica adicional. No se toca `RoleGuard` ni `router/index.tsx`.

### 7. Fix de fixtures: `fechaCierre` calculado por registro + 1 cambio de severidad para desbloquear KPI-09 de verdad

Se poblan fechas específicas por registro (no una fórmula automática tipo "fechaHoraReporte + N días") para mantener coherencia narrativa con los campos ya existentes de cada QE (`causaRaizFirmadaEn`, `fechaVerificacionProgramada`, `fechaVerificacionRealizada`, `plazoVerificacionDias`):

Se verificó en código que **ningún** QE `severidad: 'CRITICA'` del seed está en `CERRADO`/`EN_VERIFICACION`/`VERIFICADO` (los 4 existentes —`qe-2026-001`, `006`, `012`, `019`— están en `ABIERTO`/`EN_INVESTIGACION`). Poblar solo `fechaCierre` en los 7 registros identificados no alcanza para que KPI-09 ("% de QE `CRITICA` cerrados con `cierreFirmaSupervisorId`") deje de ser estructuralmente `0`: el numerador y denominador de la fórmula requieren al menos un QE `CRITICA` cerrado. Se cambia `severidad` de `qe-2026-020` (`CERRADO`, sin dependencia de test existente más allá de su `estado` — verificado que `useEditarSeveridad.test.ts` solo usa que es `CERRADO`, no su `severidad`) de `BAJA` a `CRITICA`. Alternativa descartada: agregar un fixture de QE nuevo — se prefiere reutilizar uno existente para no inflar el conteo total de fixtures ni requerir nuevos `auditTrail`/ids.

| QE | Estado | `causaRaizFirmadaEn` | `fechaCierre` nuevo | Restricción verificada |
| --- | --- | --- | --- | --- |
| qe-2026-004 | VERIFICADO | 2025-12-01 | 2025-12-15T10:00:00Z | < `fechaVerificacionRealizada` (2026-02-10) |
| qe-2026-008 | EN_VERIFICACION | 2026-06-15 | 2026-06-25T10:00:00Z | < `fechaVerificacionProgramada` (2026-07-22); < hoy (2026-07-08) |
| qe-2026-009 | CERRADO | 2026-01-05 | 2026-01-20T10:00:00Z | < hoy |
| qe-2026-010 | VERIFICADO | 2025-11-01 | 2025-11-15T10:00:00Z | < `fechaVerificacionRealizada` (2026-01-18) |
| qe-2026-016 | EN_VERIFICACION | 2026-03-01 | 2026-03-15T10:00:00Z | < `fechaVerificacionProgramada` (2026-07-28); < hoy |
| qe-2026-020 | CERRADO (severidad → `CRITICA`, antes `BAJA`) | 2026-05-05 | 2026-05-20T10:00:00Z | < hoy |
| qe-2026-021 | EN_VERIFICACION | 2026-07-02 | 2026-07-04T10:00:00Z | < `fechaVerificacionProgramada` (2026-07-13); < hoy |

Ningún otro campo de estos registros cambia (mismo `estado`, `severidad`, `accionesCorrectivas: []`, `auditTrail`).

## Risks / Trade-offs

- [`accionesCorrectivasPorVencer` excluye origen `INCIDENTE` a diferencia de `MisACsWidget`/`ACsVencidasWidget`] → Es una decisión explícita del pedido ("Agrega ACs de origen QE y NC"), no un descuido; se documenta en el JSDoc/comentario del handler para que una spec futura que quiera agregar incidentes no lo confunda con un bug.
- [Fechas de `fechaCierre` fijadas a mano en vez de derivadas por fórmula] → 7 registros es un volumen manejable para verificación manual uno a uno; una fórmula genérica arriesgaba violar la restricción `fechaCierre < fechaVerificacionRealizada` en registros con verificación ya completada.
- [`SupervisorDashboard` sigue sin pintar `kpisArea`] → Gap preexistente a M5-S01, no introducido ni agravado por esta spec; se documenta pero no se corrige aquí (fuera de alcance: tocar `SupervisorDashboard` no fue pedido).
- [Roles `AUDITOR_INTERNO`/`ALTA_DIRECCION` sin vista propia todavía] → Ya documentado como diferido a S06/S07 desde M5-S04; sin cambio de plan.

## Open Questions

Ninguna — alcance de datos, filtrado, fixtures y las 3 acciones de navegación quedaron resueltos con la verificación de código de este documento.
