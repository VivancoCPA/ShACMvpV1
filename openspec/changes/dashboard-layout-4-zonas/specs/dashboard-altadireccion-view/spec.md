## MODIFIED Requirements

### Requirement: AltaDireccionDashboard compone los widgets ejecutivos en orden fijo
El componente `AltaDireccionDashboard` (`src/features/dashboard/pages/AltaDireccionDashboard.tsx`) SHALL consumir `useDashboardSummary()` y `useDashboardKpis(periodo)` (con `periodo` de `usePeriodoKpi()`), y componer `DashboardLayout` así:
- **alertas:** "QE críticos activos" (error; `alertasCriticas.length`; `/quality-events?severidad=CRITICA`), "Reaperturas del período" (warning; `reaperturas` cuya `fechaReapertura` cae en el rango del período elegido; `/quality-events?soloReincidencias=true`) y "Extensiones de plazo por aprobar" (warning; `acsConSolicitudAjustePlazo.length`; `#acs-extension-plazo`);
- **indicadores:** `KpisEjecutivosWidget`, con `PeriodoSelector`;
- **trabajoPrincipal:** `AccionesRequeridasWidget` (montado fuera del bloque condicional de carga, cubierto por `dashboard-acciones-requeridas`) y `ComparativaMensualWidget`;
- **trabajoLateral:** `QEsCriticosWidget`, `ReaperturasWidget` y `ACsExtensionPlazoWidget` (`id="acs-extension-plazo"`);
- **mapa:** `HeatmapIncidentesWidget`.

Mientras `isLoading` es verdadero o `data.rol !== 'ALTA_DIRECCION'`, las zonas que dependen del summary SHALL mostrar `WidgetSkeleton`.

#### Scenario: Carga muestra skeletons
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `AltaDireccionDashboard` renderiza skeletons para los widgets dependientes del summary, sin bloquear `AccionesRequeridasWidget`

#### Scenario: Datos cargados renderizan los widgets en sus zonas
- **WHEN** `useDashboardSummary()` resuelve con `{ rol: 'ALTA_DIRECCION', data }`
- **THEN** se renderizan 3 alertas, `KpisEjecutivosWidget` en "Indicadores", `AccionesRequeridasWidget` y `ComparativaMensualWidget` en la columna principal, `QEsCriticosWidget`, `ReaperturasWidget` y `ACsExtensionPlazoWidget` en la lateral, y `HeatmapIncidentesWidget` en "Dónde ocurre"

#### Scenario: Reaperturas del período
- **WHEN** el período es `mes` (noviembre de 2026) y `reaperturas` tiene una con `fechaReapertura` el 2026-11-03 y otra el 2026-10-20
- **THEN** la alerta "Reaperturas del período" muestra `1`

### Requirement: KpisEjecutivosWidget muestra 5 indicadores ejecutivos
`KpisEjecutivosWidget` SHALL renderizar 5 tarjetas, sin `<section>` ni `h2` propios (el label lo pone la zona "Indicadores"): "QEs abiertos" (`resumenPorModulo.qualityEvents.abiertos`, conteo simple sin semáforo ni anillo), "QEs vencidos" (`resumenPorModulo.qualityEvents.vencidos`, conteo simple sin semáforo ni anillo), y una `KpiRingCard` por cada uno de KPI-01, KPI-04 y KPI-05, tomados de los `KpiResult` de `useDashboardKpis(periodo)` que recibe por props, con `tendencia` = los últimos 6 valores de `tendenciaMensualKpis[kpiId]` del summary.

#### Scenario: QEs abiertos incluye REABIERTO, excluye CERRADO y VERIFICADO
- **WHEN** el store de QE contiene QEs en cada uno de los estados no `CERRADO` ni `VERIFICADO` (incluido `REABIERTO`)
- **THEN** `resumenPorModulo.qualityEvents.abiertos` cuenta todos ellos, y ninguno con `estado === 'CERRADO'` o `estado === 'VERIFICADO'`
- Un QE `CERRADO` ya completó su ciclo activo de gestión (solo queda pendiente la verificación de eficacia automática, un proceso de sistema, no una tarea pendiente de un responsable humano)

#### Scenario: QEs vencidos usa el plazo máximo por ESTADO ACTUAL y severidad (no un plazo único por severidad)
- **WHEN** un QE `abierto` (no `CERRADO` ni `VERIFICADO`) tiene `contarDiasHabiles(fechaEntradaEstadoActual, hoy) > plazoMaximoQEPorEstado(estado, severidad)`, donde `plazoMaximoQEPorEstado` consulta `PLAZO_MAXIMO_QE_POR_ESTADO_DIAS_HABILES[estado][severidad]` para `EN_INVESTIGACION`/`ANALISIS_COMPLETADO`/`PENDIENTE_CIERRE` (misma tabla por severidad de `m5-s01-fix-kpis-prd` §1.3), o el plazo fijo de 10 días hábiles (RN-QE-008) para `EN_VERIFICACION`
- **THEN** ese QE se cuenta en `resumenPorModulo.qualityEvents.vencidos`

#### Scenario: fechaEntradaEstadoActual usa la última transición al estado vigente, no fechaHoraReporte
- **WHEN** un QE transicionó de `ABIERTO` a `EN_INVESTIGACION` (entrada de `auditTrail` con `accion === 'ESTADO_CAMBIADO'` y `estadoNuevo === 'EN_INVESTIGACION'`)
- **THEN** `fechaEntradaEstadoActual` usa el `timestamp` de esa entrada (la más reciente si hay varias), no `fechaHoraReporte`; si el QE nunca transicionó de `ABIERTO`, se usa `fechaHoraReporte` como fallback

#### Scenario: ABIERTO y EN_EJECUCION nunca se marcan vencidos por este widget
- **WHEN** un QE está en estado `ABIERTO` o `EN_EJECUCION`, sin importar cuánto tiempo lleve ahí
- **THEN** no se cuenta en `resumenPorModulo.qualityEvents.vencidos` — ninguno de los dos tiene un presupuesto de días propio citado en SHAC-PRD-003 §1.3 (`EN_EJECUCION` se rastrea a nivel de AC individual vía `ACsExtensionPlazoWidget`/`ACsPorVencerWidget`, no a nivel de QE)

#### Scenario: Widget muestra exactamente 5 tarjetas
- **WHEN** `KpisEjecutivosWidget` recibe datos completos
- **THEN** renderiza exactamente 5 tarjetas, en el orden: QEs abiertos, QEs vencidos, KPI-01, KPI-04, KPI-05; las 3 últimas con anillo

### Requirement: HeatmapIncidentesWidget se monta como último widget del dashboard
`AltaDireccionDashboard` SHALL montar `HeatmapIncidentesWidget` (mismo componente compartido que usa `JefeCalidadDashboard`) en la zona "Dónde ocurre" de `DashboardLayout`, la última de la página, con su propio rango (3/6/12 meses) y selector de local, independientes del resto del dashboard y del `PeriodoSelector` de indicadores. El comportamiento detallado del widget (cálculo del mapa, interacción) es responsabilidad de su propia capability y no se redefine aquí.

#### Scenario: Heatmap aparece después de ACsExtensionPlazoWidget
- **WHEN** `AltaDireccionDashboard` renderiza con datos cargados
- **THEN** `HeatmapIncidentesWidget` es el último widget en el DOM, dentro de la zona "Dónde ocurre", después de `ACsExtensionPlazoWidget`
