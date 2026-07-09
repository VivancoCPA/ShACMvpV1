## Context

M5-S05a dejó `JefeCalidadDashboard` con 3 widgets (`KpiGridWidget`, `QEPorEstadoWidget`, `ACsPorVencerWidget`) y documentó explícitamente que `tendenciaMensualCierres` (campo ya existente en `JefeCalidadDashboardData` desde M5-S01) queda sin consumidor, diferido a esta spec. Se verificó en código que:

- `calcularKpi01(qes, periodo)`, `calcularKpi04(incidentes, periodo)` y `calcularKpi05(qes, ncs, periodo)` (`dashboard.handlers.ts:187-248`) ya reciben `periodo: string` (`'YYYY-MM'`) como parámetro — recalcular un KPI para un mes distinto al actual no requiere ninguna fórmula nueva, solo invocarlas con otro `periodo`.
- `buildTendenciaMensualCierres` (`dashboard.handlers.ts:529-534`) ya usa el patrón `ultimosMeses(N).map(periodo => ...)` para agregar por mes — mismo patrón que esta spec extiende a 12 meses y a "abiertos" + KPIs.
- `horasTrabajadasFixtures` solo cubre `2026-01`→`2026-06` (`horasTrabajadas.fixtures.ts`); con la fecha de referencia del sistema en `2026-07`, ni siquiera el mes actual tiene datos de horas — KPI-04 del mes actual ya calcula sobre `horas = 0` (retorna `0` por el fallback existente en `calcularKpi04`). Esto empeora al pedir un rango histórico de hasta 12 meses.
- Los fixtures de QE (`quality-events.fixtures.ts`, 21 registros) tienen `fechaHoraReporte`/`fechaCierre` concentrados de forma desigual: hay meses sin ningún `fechaCierre` (ej. la mayoría de 2025) y dos meses (`2025-08`, `2025-09`) sin ningún `fechaHoraReporte`.
- `openspec/specs/dashboard-jefecalidad-view` **no existe todavía** en el árbol principal de specs — la spec de M5-S05a que crea esa capability sigue sin archivar. Por eso esta spec no la lista como "Modified Capability"; el wiring del widget nuevo en la página se documenta dentro de la nueva capability `dashboard-trend-widget` (ver proposal.md).
- El router (`router/index.tsx:32,281`) importa `DashboardPage` de forma estática, y `DashboardPage` importa las 5 páginas de rol estáticamente — no hay code-splitting por ruta en el proyecto. `recharts` quedará en el mismo bundle que sirve a todos los roles, no solo a Jefe de Calidad.

## Goals / Non-Goals

**Goals:**
- Widget "Tendencia mensual" en `JefeCalidadDashboard`: 2 `LineChart` (recharts) — volumen de QEs (abiertos vs. cerrados) y evolución de KPI-01/04/05 — con selector de rango 3/6/12 meses (default 6).
- El servidor mock (MSW) siempre calcula 12 meses de historia; el selector de rango recorta client-side, sin round-trip adicional al cambiar de rango.
- Seed data (QE, horas trabajadas) con variación real mes a mes en los 12 meses hacia atrás desde la fecha del sistema, para que ningún mes del rango máximo muestre `0` o un valor idéntico en KPI-01/04/05 estructuralmente (mismo criterio que M5-S01-fix-kpis-prd, aplicado por mes).
- Primera integración de `recharts` en el proyecto, verificada contra el build de Vite.

**Non-Goals:**
- No se agregan KPIs adicionales a la tendencia (solo KPI-01/04/05, elegidos por coincidir con `US-DIR-001`).
- No se implementa exportación del gráfico (diferido a S09/v1.1).
- No se persiste la preferencia de rango entre sesiones (ni en `preferencesStore` ni en `localStorage`).
- No se introduce code-splitting por ruta en el proyecto — fuera del alcance de esta spec (ver Riesgo de bundle más abajo).
- No se toca `SupervisorDashboardData`, `AltaDireccionDashboardData` ni `AuditorDashboardData` — el pedido es exclusivo de `JefeCalidadDashboardData`.

## Decisions

### 1. Un único payload de 12 meses; el selector de rango recorta client-side, sin endpoint nuevo

`GET /api/dashboard/summary` (ya usado por `useDashboardSummary()`) siempre calcula y devuelve 12 meses de tendencia dentro de `JefeCalidadDashboardData`. El widget recorta a los últimos 3/6/12 con un `slice` puro sobre el array ya recibido (`useMemo`, no `useEffect` — regla 1 de CLAUDE.md).

**Alternativa descartada**: endpoint nuevo `GET /api/dashboard/tendencia?meses=N`. Se descarta porque duplicaría la resolución de usuario/rol ya hecha por `/summary`, agregaría un round-trip por cada cambio de rango, y el costo de calcular 12 meses en vez de N es marginal (reduce en memoria sobre arrays ya cargados en MSW, mismo orden de magnitud que `calcularKpis` actual).

### 2. Forma de datos: reemplaza `tendenciaMensualCierres`, agrega `tendenciaMensualVolumen` y `tendenciaMensualKpis`

```typescript
// dashboardData.types.ts
export interface TendenciaMensualVolumenEntry {
  periodo: string   // 'YYYY-MM'
  abiertos: number  // QE con fechaHoraReporte en el mes (sin filtrar por estado)
  cerrados: number  // QE con fechaCierre en el mes, sin filtrar por estado — mismo criterio exacto que buildTendenciaMensualCierres actual (no exige CERRADO/VERIFICADO como sí lo hace KPI-01/02)
}

export interface TendenciaMensualKpiEntry {
  periodo: string
  valor: number
}

export interface JefeCalidadDashboardData {
  kpis: KpiResult[]
  qeCriticosAbiertos: QEResumen[]
  ncPendientesVerificacion: NCResumen[]
  distribucionQEPorTipo: Record<QEType, number>
  qePorEstado: Record<QEStatus, number>
  accionesCorrectivasPorVencer: AccionCorrectivaResumen[]
  tendenciaMensualVolumen: TendenciaMensualVolumenEntry[]                       // NUEVO — reemplaza tendenciaMensualCierres
  tendenciaMensualKpis: Record<'KPI-01' | 'KPI-04' | 'KPI-05', TendenciaMensualKpiEntry[]>  // NUEVO
}
```

`tendenciaMensualCierres` se elimina del tipo (nunca tuvo consumidor; `tendenciaMensualVolumen[i].cerrados` lo reemplaza con el mismo criterio de cálculo). Ambos arrays tienen 12 entradas, ordenadas de más antiguo a más reciente (mismo orden que `ultimosMeses(N)` ya produce).

**Alternativa descartada**: mantener `tendenciaMensualCierres` intacto y agregar los campos nuevos por separado (`tendenciaMensualAbiertos`, `tendenciaMensualKpis`). Se descarta porque duplicaría el recorrido de `periodo` en 2 arrays paralelos (`cierres` y `abiertos`) que el widget siempre consume juntos — `tendenciaMensualVolumen` como un solo array de `{periodo, abiertos, cerrados}` es la forma natural para un `LineChart` de recharts con 2 series (recharts espera un array de objetos con una key por serie, no 2 arrays paralelos).

### 3. "Abiertos" = `fechaHoraReporte` en el mes, sin filtrar por `estado`

Mismo campo y mismo criterio ("QE del periodo") que ya usa `calcularKpi09` (`dashboard.handlers.ts:284-295`) para agrupar QEs por mes — no se introduce un segundo significado de "QE del mes". Un QE cuenta como "abierto" en el mes de su `fechaHoraReporte` independientemente de su `estado` actual (incluyendo los ya cerrados) — es un conteo de volumen de entrada, no de QEs actualmente abiertos.

### 4. `tendenciaMensualKpis` reutiliza `calcularKpi01`/`04`/`05` en un loop sobre `ultimosMeses(12)`; sin semáforo por punto

```typescript
function buildTendenciaMensualKpis(
  qes: QualityEvent[], ncs: NoConformidad[], incidentes: Incidente[],
): JefeCalidadDashboardData['tendenciaMensualKpis'] {
  const meses = ultimosMeses(12)
  return {
    'KPI-01': meses.map((periodo) => ({ periodo, valor: calcularKpi01(qes, periodo) })),
    'KPI-04': meses.map((periodo) => ({ periodo, valor: calcularKpi04(incidentes, periodo) })),
    'KPI-05': meses.map((periodo) => ({ periodo, valor: calcularKpi05(qes, ncs, periodo) })),
  }
}
```

Los puntos de la línea de tendencia no llevan semáforo — es una vista informativa de evolución, no una tarjeta de cumplimiento (esas ya existen en `KpiGridWidget` para el mes actual). No se recalcula `calcularSemaforoAbsoluto`/`calcularSemaforoKpi04` por punto histórico.

**Alternativa descartada**: reutilizar `calcularKpis(periodo)` completo (los 9 KPIs) y filtrar a 3. Se descarta por costo innecesario — `calcularKpis` calcula los 9, incluyendo KPI-08 (`TIEMPO_REAL`, no tiene sentido por mes histórico) y KPI-09 (con `distribucion`); invocar directamente las 3 funciones `calcularKpiNN` evita ese trabajo de más, igual que `buildTendenciaMensualCierres` ya evita pasar por `calcularKpis`.

### 5. Selector de rango: estado local del widget, sin persistencia

`useState<3 | 6 | 12>(6)` dentro de `TendenciaMensualWidget` (o el nombre de componente que se cree). No usa `preferencesStore` ni `localStorage` — el pedido explícitamente excluye persistencia entre sesiones. El recorte a los últimos N meses es `array.slice(-N)` sobre los 12 ya recibidos, memoizado con `useMemo` para no recalcular en cada render no relacionado.

### 6. Fixtures: extender cobertura a 12 meses, ajustando registros existentes antes que agregar nuevos

**`horasTrabajadasFixtures`**: se extiende `PERIODOS` de 6 a 12 entradas cronológicas ascendentes (`'2025-08'` a `'2026-07'`). La función `horasParaAreaYMes(areaIndex, mesIndex)` ya es determinística por índice de array — extender `PERIODOS` produce automáticamente 6 meses nuevos con valores distintos sin tocar la fórmula. `dashboard-msw-fixtures` (spec existente) sube su exigencia mínima de "al menos 6 periodos" a "al menos 12 periodos".

**`quality-events.fixtures.ts`**: se prioriza ajustar `fechaHoraReporte`/`fechaCierre` de registros existentes (mismo criterio que M5-S05a — tabla explícita de fecha por registro, verificada contra las restricciones narrativas de cada QE: `causaRaizFirmadaEn` < `fechaCierre` < `fechaVerificacionProgramada`/`fechaVerificacionRealizada`/hoy) para cubrir los meses hoy vacíos, en vez de agregar fixtures nuevos — evita re-violar las proporciones ya exigidas por `quality-event-msw-fixtures` (mínimo de `ciclo>1`, de `VERIFICADO`, cobertura de enums).

Se verificó en código el inventario completo de los 21 fixtures (`fechaHoraReporte`, `estado`, `causaRaizFirmadaEn`, `fechaCierre` de cada uno). Con la fecha de referencia del sistema en `2026-07`, el rango de 12 meses es `2025-08`→`2026-07`. Resultado de la verificación:
- `fechaHoraReporte` ya cubre 10 de los 12 meses; solo `2025-08` y `2025-09` están vacíos.
- `fechaCierre` (a nivel de QE, no de AC individual) solo existe en 8 de los 21 fixtures, cubriendo apenas 5 de los 12 meses (`2025-11`, `2026-03`, `2026-05`, `2026-06`, `2026-07`).

Cambios concretos (todos preservan `numero`, `severidad`, `ciclo`, `origen`, `tipo`, `accionesCorrectivas`, `auditTrail` de cada registro — solo se tocan los campos de fecha y, cuando se indica, `estado`):

| QE | Cambio | Antes | Después | Justificación |
|---|---|---|---|---|
| `qe-2026-006` | `fechaHoraReporte` | `2026-01-20` | `2025-08-20` | Cubre `abiertos` de `2025-08`; `2026-01` conserva `qe-2026-005`/`017` (2 registros), sigue cubierto |
| `qe-2026-011` | `fechaHoraReporte` | `2026-04-15` | `2025-09-15` | Cubre `abiertos` de `2025-09`; `2026-04` conserva `009`/`014`/`020` (3 registros), sigue cubierto |
| `qe-2026-006` | + `causaRaizFirmadaEn`, + `fechaCierre`, `estado: ABIERTO → CERRADO` | — | `causaRaizFirmadaEn: 2025-08-25`, `fechaCierre: 2025-08-29` | Cubre `cerrados` de `2025-08`; `ABIERTO` baja de 3→2 registros, sigue cubriendo el enum (`018` restante) |
| `qe-2026-011` | + `causaRaizFirmadaEn`, + `fechaCierre`, `estado: ABIERTO → CERRADO` | — | `causaRaizFirmadaEn: 2025-09-22`, `fechaCierre: 2025-09-29` | Cubre `cerrados` de `2025-09`; `ABIERTO` baja de 2→1 (`018`), sigue cubriendo el enum |
| `qe-2026-002` | `causaRaizFirmadaEn` movido antes, + `fechaCierre`, `estado: EN_EJECUCION → CERRADO` | `causaRaizFirmadaEn: 2026-01-10` | `causaRaizFirmadaEn: 2025-12-22`, `fechaCierre: 2025-12-29` | Cubre `cerrados` de `2025-12`; `EN_EJECUCION` baja de 2→1 (`013` restante, que NO se toca — conserva su narrativa de "ciclo 3 aún activo") |
| `qe-2026-001` | + `causaRaizFirmadaEn`, + `fechaCierre`, `estado: EN_INVESTIGACION → CERRADO` | — | `causaRaizFirmadaEn: 2026-02-14`, `fechaCierre: 2026-02-24` | Cubre `cerrados` de `2026-02`; `EN_INVESTIGACION` baja de 3→2 (`012`/`019` restantes), sigue cubriendo el enum |
| `qe-2026-014` | + `causaRaizFirmadaEn`, + `fechaCierre`, `estado: ANALISIS_COMPLETADO → CERRADO` | — | `causaRaizFirmadaEn: 2026-04-12`, `fechaCierre: 2026-04-24` | Cubre `cerrados` de `2026-04`; `ANALISIS_COMPLETADO` baja de 2→1 (`007` restante), sigue cubriendo el enum |

Con estos 6 cambios, `fechaCierre` cubre 10 de los 12 meses (los 5 que ya tenía + `2025-08`, `2025-09`, `2025-12`, `2026-02`, `2026-04`). Quedan sin `fechaCierre` `2025-10` y `2026-01` — 2 meses, dentro del margen que permite el requisito ("al menos 10 de 12"); no se fuerza un séptimo ajuste porque ningún registro restante tiene un `causaRaizFirmadaEn` narrativamente compatible con cerrar en esos 2 meses sin contradecir una fecha ya fijada en otro registro. Se documenta como gap aceptado, no como pendiente.

`qe-2026-013` (ciclo 3, "los dos anteriores cerraron sin efectividad comprobada") y `qe-2026-005`/`qe-2026-017` (`REABIERTO`) se excluyen deliberadamente de estos ajustes — cerrarlos o darles un `fechaCierre` de ciclo 1 contradiría su narrativa ya escrita o introduciría un concepto (fecha de cierre de un ciclo anterior) que ningún otro fixture `REABIERTO` del seed usa hoy.

**KPI-05 histórico** (el más exigente en datos): requiere, para cada uno de los 12 meses, al menos una AC (`estado: 'CERRADA'`, origen QE o NC) cuyo padre tenga `resultadoVerificacion` y su fecha de verificación (`fechaVerificacionRealizada` en QE, `fechaVerificacion` en NC) caiga en ese mes. Es el criterio con más probabilidad de dar `0` en meses sin ajuste — se marca como el punto de mayor riesgo del fix de fixtures (ver Riesgos).

**Alternativa descartada**: generar fixtures nuevas por fórmula (ej. "un QE cerrado cada mes con fecha = mes - offset"). Se descarta por el mismo motivo que M5-S05a: una fórmula genérica arriesga violar restricciones narrativas cruzadas (`causaRaizFirmadaEn`, `fechaVerificacionProgramada`, `resultadoVerificacion` del padre) que solo se verifican registro por registro.

### 7. `recharts` sin code-splitting adicional; verificación de bundle es una tarea, no una decisión arquitectónica

El proyecto no hace code-splitting por ruta (`DashboardPage` importa las 5 páginas de rol de forma estática). Se instala `recharts` y se importa directamente en el nuevo widget, siguiendo el mismo patrón estático que el resto del proyecto — no se introduce `React.lazy()` solo para este widget (inconsistente con el resto de la app, y fuera del alcance pedido). El costo real en tamaño de bundle se verifica con una tarea explícita (build + comparación de tamaño de `dist/`), no se asume aceptable de antemano.

### 8. Colores de las series: paleta semántica existente, no `dark:` de Tailwind

Recharts renderiza SVG (`stroke`/`fill`), que no puede usar clases `dark:` de Tailwind directamente. Se usan los tokens hex ya definidos en el design system (`coral` `#cc785c` para "abiertos"/KPI-01, `teal` `#5db8a6` para "cerrados"/KPI-05, `amber` `#e8a55a` para KPI-04) — los mismos 3 acentos que `SeverityTag` ya usa, elegidos porque son legibles tanto sobre `canvas` (light) como sobre `surface-dark` (dark) sin necesitar un segundo set de colores por tema.

## Risks / Trade-offs

- [KPI-05 histórico es el campo con más restricciones narrativas cruzadas (padre + AC + fecha de verificación) — mayor riesgo de que el ajuste de fixtures en `tasks.md` deje algún mes en `0` pese al esfuerzo] → Se documenta explícitamente como el punto a verificar primero en navegador antes de dar la tarea de fixtures por completa; si algún mes queda en `0` de forma justificada (ej. ningún AC verificado ese mes en la realidad narrativa del seed), se documenta como gap aceptado, no se fuerza un valor artificial.
- [`recharts` se agrega al bundle compartido por todos los roles, no solo Jefe de Calidad, por falta de code-splitting preexistente] → Aceptado como consistente con el patrón actual del proyecto; se verifica el tamaño real añadido con una tarea de build antes de cerrar la spec, no se introduce lazy-loading nuevo para mitigar (fuera de alcance).
- [`tendenciaMensualCierres` se elimina del tipo en vez de deprecarse] → Sin consumidor real desde su creación en M5-S01 (confirmado en design.md de M5-S05a); no hay código ni test que dependa de su forma actual, eliminarlo es seguro.
- [Los 12 meses de tendencia se recalculan en cada `GET /api/dashboard/summary`, incluso cuando el usuario solo pide un rango de 3] → Costo aceptable para un mock en memoria (mismo orden de magnitud que los otros agregados de `buildJefeCalidadData`); no se optimiza con cache porque MSW ya se ejecuta enteramente en el cliente.

## Open Questions

Ninguna — el inventario exacto de qué fixtures de QE mueven su fecha a qué mes, y si algún mes del rango de 12 queda en `0` para KPI-05 pese al ajuste, se resuelve y documenta con evidencia de código en `tasks.md` (mismo criterio que M5-S05a), no queda pendiente de decisión de producto.
