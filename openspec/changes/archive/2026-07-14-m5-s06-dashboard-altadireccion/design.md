## Context

`DashboardPage.tsx` (`src/features/dashboard/pages/DashboardPage.tsx`) resuelve el tipo de dashboard vía `getDashboardDataTypeForRole(user.rol)` y ya mapea `ALTA_DIRECCION → 'ALTA_DIRECCION'` correctamente (`dashboardRoleMapping.ts`), pero no tiene rama `if (dashboardType === 'ALTA_DIRECCION')` — cae al placeholder `<ComingSoon label="Dashboard" />`. Esto fue diferido explícitamente desde M5-S05a ("`ALTA_DIRECCION` sigue viendo el placeholder hasta S06/S07").

El backend mock (`buildAltaDireccionData()` en `src/mocks/handlers/dashboard.handlers.ts:635-676`) ya devuelve `AltaDireccionDashboardData` con `kpisEstrategicos` (9 KPIs completos vía `calcularKpis`), `resumenPorModulo`, `alertasCriticas` (QEs `CRITICA` no cerrados/verificados) y `tendenciaTrimestral`. Este spec construye la UI que consume esos datos y extiende el shape donde faltan piezas específicas del alcance (QEs abiertos/vencidos, reaperturas, ACs con solicitud de extensión de plazo).

No existe función reutilizable de "fecha límite de un QE" — la lógica de plazo por severidad (`PLAZO_MAXIMO_QE_DIAS_HABILES`, `kpi.constants.ts:9-14`) está inline dentro de `calcularKpi01` (`dashboard.handlers.ts:187-196`), siempre evaluada contra `fechaCierre`. Este spec la reutiliza pero contra "hoy" en vez de `fechaCierre`, sin fórmula nueva.

QE-AC-007 (solicitud de extensión de plazo para una Acción Correctiva) no existe en ninguna forma en el código: ni campo, ni endpoint, ni fixture. Se agrega un campo mínimo de solo lectura para soportar la lista del widget 5; el flujo de aprobación real (justificación + validación de umbral 50%, RN a definir) queda como gap de M4.

## Goals / Non-Goals

**Goals:**
- Reemplazar el placeholder de `/dashboard` para `ALTA_DIRECCION` con un dashboard funcional de 5 widgets, consumiendo datos reales del seed.
- Reutilizar al máximo la lógica ya construida: `calcularKpi01/04/05` (M5-S05b), `alertasCriticas` (ya en `buildAltaDireccionData`), `contarDiasHabiles` (`businessDays.ts`), `KpiGridWidget`, y el patrón de `ACsPorVencerWidget`/`SemaforoCriticoBanner` donde el layout lo permita.
- Agregar solo los campos de datos estrictamente necesarios para los 2 widgets que no tienen soporte hoy (QEs abiertos/vencidos, reaperturas, AC-extensión-plazo), documentados como extensión mínima y no como rediseño de dominio.

**Non-Goals:**
- No se implementa el formulario de aprobación de extensión de plazo (justificación escrita + validación de umbral 50%) — gap de M4.
- No se implementa exportación de informe ejecutivo (diferido a S09/v1.1).
- No se implementa resumen automático por email (requiere sistema de notificaciones, gap ya documentado desde M5-S03).
- No se modifica routing ni RBAC — `/dashboard` ya admite `ALTA_DIRECCION` en `RoleGuard` (M5-S01).
- No se toca `JefeCalidadDashboard`, `SupervisorDashboard`, ni `OperarioDashboard`.

## Decisions

### 1. "QEs abiertos" y "QEs vencidos" — definición y reutilización de lógica de plazo

**Universo "abierto"**: `estado !== 'VERIFICADO'` (incluye `REABIERTO`). Aunque el diagrama de máquina de estados en CLAUDE.md describe `REABIERTO` como "terminal negativo", en el código (`qualityEventTransitions.ts:12`) `REABIERTO` transiciona a `EN_INVESTIGACION` y existen QEs fixture actualmente en ese estado en reposo (`qe-2026-005`, `qe-2026-017`) a la espera de que se reinicie la investigación. Excluirlo de "abiertos" subestimaría QEs que requieren atención activa. Decisión confirmada con el usuario en la propuesta.

**QEs vencidos**: de ese mismo universo ("abierto"), un QE está vencido si:
```
contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date()) > PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]
```
Reutiliza `contarDiasHabiles` (`src/utils/businessDays.ts:3-19`) y `PLAZO_MAXIMO_QE_DIAS_HABILES` (`kpi.constants.ts`) — la misma función y la misma tabla que ya usa `calcularKpi01`, solo que el segundo argumento es `new Date()` (momento de cálculo) en vez de `qe.fechaCierre`. No se crea una función "sumar N días hábiles a una fecha" (no existe hoy y no hace falta): comparar días hábiles transcurridos contra el máximo permitido es equivalente y evita introducir una nueva primitiva de fechas.

Ambos conteos se calculan en `buildAltaDireccionData()` y se exponen como `resumenPorModulo.qualityEvents.abiertos` y `resumenPorModulo.qualityEvents.vencidos` (junto a los ya existentes `total`/`criticosAbiertos`), no como nuevas entradas en `KPI_DEFINITIONS` — evita inventar semántica de `KpiResult` (meta, semáforo, frecuencia) para dos conteos simples que no tienen meta/semaforo definidos en el PRD.

### 2. Widget de KPIs ejecutivos — composición, no nuevo endpoint

El widget arma sus 5 tarjetas combinando:
- `resumenPorModulo.qualityEvents.abiertos` / `.vencidos` (conteos nuevos, sin meta/semáforo — se muestran como número simple, sin badge de color).
- `kpisEstrategicos.filter(k => ['KPI-01','KPI-04','KPI-05'].includes(k.kpiId))` reutilizando `KpiGridWidget` (o una variante reducida del mismo) para KPI-01/04/05, que ya trae `valor`, `meta`, `semaforo`, `unidad` — mismo componente visual que usa `JefeCalidadDashboard`.

No se agrega un endpoint nuevo: `GET /api/dashboard/summary` ya devuelve `kpisEstrategicos` completo; solo se filtra client-side por los 3 IDs relevantes.

### 3. Comparativa vs mes anterior — reutiliza `calcularKpi01/04/05` sin nueva fórmula

`buildAltaDireccionData()` agrega un campo `comparativaMensual: Record<'KPI-01'|'KPI-04'|'KPI-05', { actual: number; anterior: number; tendencia: 'SUBE'|'BAJA'|'ESTABLE' }>` calculado así:
```ts
const [mesActual, mesAnterior] = ultimosMeses(2) // ya existe en dashboard.handlers.ts:83-107
const actual = calcularKpi01(qes, mesActual)
const anterior = calcularKpi01(qes, mesAnterior)
const tendencia = clasificarTendencia(actual, anterior) // nuevo helper, ver abajo
```
Mismo patrón para KPI-04 (`calcularKpi04`) y KPI-05 (`calcularKpi05`), usando `ultimosMeses(2)` (ya existente, usado hoy por `buildTendenciaMensualKpis` con `ultimosMeses(12)`). No se duplica ninguna fórmula de cálculo mensual — solo se invocan las funciones existentes con un rango de 2 meses.

`clasificarTendencia(actual, anterior)`: nuevo helper en `dashboard.handlers.ts` (o `utils/` si se prefiere testeable de forma aislada):
```ts
function clasificarTendencia(actual: number, anterior: number): 'SUBE' | 'BAJA' | 'ESTABLE' {
  const diff = actual - anterior
  if (Math.abs(diff) < 2) return 'ESTABLE' // umbral: variación < 2 puntos porcentuales
  return diff > 0 ? 'SUBE' : 'BAJA'
}
```
El umbral de 2 puntos aplica igual a KPI-01/05 (porcentajes) y KPI-04 (tasa por millón de horas) — se documenta como decisión de producto simplificada; si KPI-04 necesitara un umbral distinto por tener otra escala, es un ajuste de una constante, no de arquitectura.

### 4. QEs críticos activos — reutiliza `alertasCriticas` tal cual

`alertasCriticas` (`dashboard.handlers.ts:666-668`) ya filtra `severidad === 'CRITICA' && estado !== 'CERRADO' && estado !== 'VERIFICADO'` y mapea a `QEResumen[]`. El widget solo renderiza esa lista con enlace a `/quality-events/:id` (patrón ya usado por `SemaforoCriticoBanner`/`ACsPorVencerWidget` para navegación por `origenTipo`). Sin cambios de backend para este widget.

### 5. Alertas de reaperturas — nuevo campo derivado, sin nueva primitiva de negocio

Nuevo tipo en `dashboardSummary.types.ts`:
```ts
export interface QEReaperturaResumen extends QEResumen {
  ciclo: number
  fechaReapertura: string
}
```
`buildAltaDireccionData()` agrega `reaperturas: QEReaperturaResumen[]`:
```ts
const reaperturas = qes
  .filter((qe) => qe.ciclo > 1)
  .map((qe) => ({
    ...toQEResumen(qe),
    ciclo: qe.ciclo,
    fechaReapertura: [...qe.auditTrail].reverse().find((e) => e.estadoNuevo === 'REABIERTO')?.timestamp ?? qe.actualizadoEn,
  }))
  .sort((a, b) => new Date(b.fechaReapertura).getTime() - new Date(a.fechaReapertura).getTime())
```
Reutiliza `toQEResumen` existente y el `auditTrail` que todo QE ya tiene — no requiere nuevo campo en `QualityEvent`. `fechaReapertura` usa el último evento `estadoNuevo === 'REABIERTO'` (soporta QEs con múltiples reaperturas, `ciclo` > 2); `actualizadoEn` es fallback defensivo si por algún motivo no hay entrada de auditoría (no debería ocurrir dado que toda reapertura genera una entrada, según fixtures).

### 6. AC pendientes de extensión de plazo — campo mínimo de solo lectura (QE-AC-007)

Se agrega a `AccionCorrectivaQE` (`src/features/quality-events/types/qualityEvent.types.ts:64-79`) un campo opcional:
```ts
export interface SolicitudAjustePlazoAC {
  fechaSolicitada: string       // nueva fecha límite propuesta
  justificacion: string
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  solicitadoPorId: string
  solicitadoEn: string
}

export interface AccionCorrectivaQE {
  // ...campos existentes
  solicitudAjustePlazo?: SolicitudAjustePlazoAC
}
```
Es deliberadamente un campo de **lectura**, sin endpoint de mutación ni UI de aprobación — cubre únicamente la necesidad de listar en el dashboard qué ACs tienen una solicitud pendiente. El flujo real (quién puede aprobar, validación de umbral 50%, notificación a Gerencia) es responsabilidad de un spec de M4 futuro y se documenta como gap.

`quality-events.fixtures.ts` siembra 2-3 `AccionCorrectivaQE` de QEs con `severidad` `ALTA` o `CRITICA` con `solicitudAjustePlazo.estado = 'PENDIENTE'` (y al menos una `APROBADA`/`RECHAZADA` para verificar que el filtro no las incluya).

Nuevo tipo de resumen en `dashboardSummary.types.ts`:
```ts
export interface ACSolicitudAjustePlazoResumen {
  qeId: string
  qeNumero: string
  qeSeveridad: QESeverity
  acId: string
  acDescripcion: string
  plazoFechaActual: string
  solicitudAjustePlazo: SolicitudAjustePlazoAC
}
```
`buildAltaDireccionData()` agrega `acsConSolicitudAjustePlazo: ACSolicitudAjustePlazoResumen[]`, recorriendo `qes.filter(qe => qe.severidad === 'ALTA' || qe.severidad === 'CRITICA')` y sus `accionesCorrectivas.filter(ac => ac.solicitudAjustePlazo?.estado === 'PENDIENTE')`.

### 7. Composición del `AltaDireccionDashboard` — mismo patrón que `JefeCalidadDashboard`

```tsx
export function AltaDireccionDashboard() {
  const { data, isLoading } = useDashboardSummary()
  return (
    <PageWrapper title={t('altaDireccion.title')}>
      {isLoading || !data || data.rol !== 'ALTA_DIRECCION' ? (
        <div className="space-y-8">{/* WidgetSkeleton x5 */}</div>
      ) : (
        <div className="space-y-8">
          <KpisEjecutivosWidget resumenQE={data.data.resumenPorModulo.qualityEvents} kpis={data.data.kpisEstrategicos} />
          <ComparativaMensualWidget comparativaMensual={data.data.comparativaMensual} />
          <QEsCriticosWidget alertasCriticas={data.data.alertasCriticas} />
          <ReaperturasWidget reaperturas={data.data.reaperturas} />
          <ACsExtensionPlazoWidget acs={data.data.acsConSolicitudAjustePlazo} />
        </div>
      )}
    </PageWrapper>
  )
}
```
`DashboardPage.tsx` gana una rama `if (dashboardType === 'ALTA_DIRECCION') return <AltaDireccionDashboard />` junto al import correspondiente — mismo patrón que las 3 ramas existentes.

## Risks / Trade-offs

- **[Riesgo]** Extender `AccionCorrectivaQE` con `solicitudAjustePlazo` podría interpretarse como parte de QE-AC-007 completo → **Mitigación**: el campo es explícitamente de solo lectura, sin endpoint de mutación; el proposal y las specs documentan el alcance exacto y el gap remanente (formulario + umbral 50%) para que un futuro spec de M4 no asuma que el flujo ya existe.
- **[Riesgo]** El umbral de "estable" (2 puntos) es una decisión de producto sin respaldo explícito en el PRD para KPI-04 (escala distinta a KPI-01/05) → **Mitigación**: aislado en una sola constante (`UMBRAL_TENDENCIA_ESTABLE`), fácil de ajustar por KPI si Alta Dirección lo pide tras revisión visual.
- **[Riesgo]** Incluir `REABIERTO` en "QEs abiertos"/"vencidos" contradice la etiqueta "terminal negativo" del diagrama de estados en CLAUDE.md → **Mitigación**: decisión explícita documentada aquí y confirmada con el usuario; si se requiere alinear el diagrama de CLAUDE.md, es un cambio de documentación separado, no de este spec.
- **[Riesgo]** `reaperturas` depende de que toda transición a `REABIERTO` deje una entrada de auditoría — si algún flujo futuro reabre un QE sin registrar auditoría, `fechaReapertura` caería al fallback `actualizadoEn` (menos preciso) → **Mitigación**: fallback documentado explícitamente; no bloquea el widget, solo reduce precisión del orden en ese caso límite.

## Migration Plan

No aplica migración de datos real (mock-only, MSW). Pasos de despliegue:
1. Extender tipos (`qualityEvent.types.ts`, `dashboardSummary.types.ts`, `dashboardData.types.ts`).
2. Sembrar fixtures (`quality-events.fixtures.ts`) con `solicitudAjustePlazo`.
3. Extender `buildAltaDireccionData()` y agregar `clasificarTendencia`.
4. Construir los 5 componentes de widget + `AltaDireccionDashboard`.
5. Cablear `DashboardPage.tsx`.
6. Verificación en navegador con `gerencia@shac.pe` / `Shac2025!`.

Rollback: revertir el commit — no hay estado persistente fuera del código/fixtures.

## Open Questions

Ninguna pendiente — las dos ambigüedades detectadas (inclusión de `REABIERTO`, alcance de QE-AC-007) fueron resueltas con el usuario antes de este documento.
