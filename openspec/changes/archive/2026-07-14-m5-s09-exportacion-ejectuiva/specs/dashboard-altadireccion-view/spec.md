## ADDED Requirements

<!--
Backfill: esta capability existe en código desde `m5-s06-dashboard-altadireccion`, pero ese change
nunca se archivó/sincronizó a openspec/specs/. Se documenta aquí como capability nueva reflejando el
estado real del código hoy (incluye la evolución posterior a m5-s06: `HeatmapIncidentesWidget` agregado
por `m5-s08-dashboard-mapacalor`, y `solicitudesAjustePlazo` como arreglo en vez de campo singular).
No se re-abre ni se re-decide ninguna de las reglas de negocio ya implementadas.
-->

### Requirement: DashboardPage renderiza AltaDireccionDashboard para el rol ALTA_DIRECCION
`DashboardPage.tsx` SHALL renderizar `AltaDireccionDashboard` cuando `getDashboardDataTypeForRole(user.rol) === 'ALTA_DIRECCION'`, junto a las ramas existentes de `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD` y `JEFE_CONTROL_DOC`.

#### Scenario: Usuario ALTA_DIRECCION ve el dashboard ejecutivo
- **WHEN** un usuario autenticado con `rol: 'ALTA_DIRECCION'` navega a `/dashboard`
- **THEN** se renderiza `AltaDireccionDashboard`

#### Scenario: Otros roles no se ven afectados
- **WHEN** un usuario `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO` navega a `/dashboard`
- **THEN** cada uno sigue viendo su propio dashboard, no `AltaDireccionDashboard`

### Requirement: AltaDireccionDashboard compone los widgets ejecutivos en orden fijo
El componente `AltaDireccionDashboard` (`src/features/dashboard/pages/AltaDireccionDashboard.tsx`) SHALL consumir `useDashboardSummary()`, mostrar `WidgetSkeleton` mientras `isLoading` es verdadero o `data.rol !== 'ALTA_DIRECCION'`, y en el caso exitoso renderizar, dentro de `PageWrapper`, en este orden: `AccionesRequeridasWidget` (montado fuera del bloque condicional de carga, cubierto por `dashboard-acciones-requeridas`), `KpisEjecutivosWidget`, `ComparativaMensualWidget`, `QEsCriticosWidget`, `ReaperturasWidget`, `ACsExtensionPlazoWidget`, `HeatmapIncidentesWidget`.

#### Scenario: Carga muestra skeletons
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `AltaDireccionDashboard` renderiza skeletons para los widgets dependientes del summary, sin bloquear `AccionesRequeridasWidget`

#### Scenario: Datos cargados renderizan los widgets en orden
- **WHEN** `useDashboardSummary()` resuelve con `{ rol: 'ALTA_DIRECCION', data }`
- **THEN** se renderizan, en orden, `KpisEjecutivosWidget`, `ComparativaMensualWidget`, `QEsCriticosWidget`, `ReaperturasWidget`, `ACsExtensionPlazoWidget` y `HeatmapIncidentesWidget`, después de `AccionesRequeridasWidget`

### Requirement: KpisEjecutivosWidget muestra 5 indicadores ejecutivos
`KpisEjecutivosWidget` SHALL renderizar 5 tarjetas: "QEs abiertos" (`resumenPorModulo.qualityEvents.abiertos`, conteo simple sin semáforo), "QEs vencidos" (`resumenPorModulo.qualityEvents.vencidos`, conteo simple sin semáforo), y KPI-01/KPI-04/KPI-05 tomados de `kpisEstrategicos.filter(k => ['KPI-01','KPI-04','KPI-05'].includes(k.kpiId))`, reutilizando el mismo formato visual que `KpiGridWidget`.

#### Scenario: QEs abiertos incluye REABIERTO, excluye CERRADO y VERIFICADO
- **WHEN** el store de QE contiene QEs en cada uno de los estados no `CERRADO` ni `VERIFICADO` (incluido `REABIERTO`)
- **THEN** `resumenPorModulo.qualityEvents.abiertos` cuenta todos ellos, y ninguno con `estado === 'CERRADO'` o `estado === 'VERIFICADO'`

#### Scenario: Widget muestra exactamente 5 tarjetas
- **WHEN** `KpisEjecutivosWidget` recibe datos completos
- **THEN** renderiza exactamente 5 tarjetas, en el orden: QEs abiertos, QEs vencidos, KPI-01, KPI-04, KPI-05

### Requirement: ComparativaMensualWidget muestra tendencia vs mes anterior para KPI-01/04/05
El backend (`buildAltaDireccionData`) SHALL exponer `comparativaMensual: Record<'KPI-01'|'KPI-04'|'KPI-05', { actual: number; anterior: number; tendencia: 'SUBE'|'BAJA'|'ESTABLE' }>`, calculado sobre los 2 últimos períodos de `ultimosMeses(2)` reutilizando `calcularKpi01`/`calcularKpi04`/`calcularKpi05`. `tendencia` SHALL ser `'ESTABLE'` cuando `Math.abs(actual - anterior) < 2`, `'SUBE'`/`'BAJA'` según el signo de la diferencia cuando supera ese umbral.

#### Scenario: Variación menor al umbral se marca ESTABLE
- **WHEN** KPI-01 pasa de 91% a 92.5% entre el mes anterior y el actual
- **THEN** `comparativaMensual['KPI-01'].tendencia === 'ESTABLE'`

#### Scenario: Variación mayor al umbral se marca SUBE o BAJA
- **WHEN** KPI-05 pasa de 80% a 85% entre el mes anterior y el actual
- **THEN** `comparativaMensual['KPI-05'].tendencia === 'SUBE'`

### Requirement: QEsCriticosWidget lista QEs con severidad CRITICA en estado no terminal
`QEsCriticosWidget` SHALL renderizar `alertasCriticas: QEResumen[]` (`severidad === 'CRITICA' && estado !== 'CERRADO' && estado !== 'VERIFICADO'`), cada ítem con enlace a `/quality-events/:id`, y un estado vacío explícito cuando la lista está vacía.

#### Scenario: Cada QE crítico enlaza a su detalle
- **WHEN** `alertasCriticas` contiene un QE con `id: 'qe-2026-010'`
- **THEN** el ítem correspondiente enlaza a `/quality-events/qe-2026-010`

#### Scenario: Widget vacío cuando no hay QEs críticos activos
- **WHEN** `alertasCriticas` es un arreglo vacío
- **THEN** `QEsCriticosWidget` muestra un estado vacío, no un error

### Requirement: ReaperturasWidget lista QEs reabiertos ordenados por fecha de reapertura más reciente
El backend SHALL exponer `reaperturas: QEReaperturaResumen[]` filtrando `qes.filter(qe => qe.ciclo > 1)`, con `fechaReapertura` (el `timestamp` de la entrada de `auditTrail` más reciente con `estadoNuevo === 'REABIERTO'`, o `actualizadoEn` como fallback), ordenado descendentemente. `ReaperturasWidget` SHALL renderizar esa lista con enlace a `/quality-events/:id` y el número de `ciclo` visible, con estado vacío explícito.

#### Scenario: Orden por fecha de reapertura más reciente primero
- **WHEN** `reaperturas` contiene QEs con `fechaReapertura` en distintas fechas
- **THEN** el primer elemento tiene la `fechaReapertura` más reciente

#### Scenario: QEs con ciclo 1 no aparecen
- **WHEN** un QE tiene `ciclo === 1`
- **THEN** no aparece en `reaperturas`

### Requirement: ACsExtensionPlazoWidget lista ACs de QEs Alta/Crítica con solicitud de ajuste de plazo pendiente
El backend SHALL exponer `acsConSolicitudAjustePlazo: ACSolicitudAjustePlazoResumen[]`, recorriendo QEs con `severidad === 'ALTA' || severidad === 'CRITICA'` y sus `accionesCorrectivas.filter(ac => ac.solicitudesAjustePlazo.some(s => s.estado === 'PENDIENTE'))` (`solicitudesAjustePlazo` es un arreglo — un AC puede tener más de una solicitud histórica). `ACsExtensionPlazoWidget` SHALL renderizar cada ítem con enlace a `/quality-events/:qeId`, sin implementar un formulario de aprobación (ver `ac-plazo-extension` para el flujo de aprobación).

#### Scenario: Solo ACs con alguna solicitud PENDIENTE aparecen
- **WHEN** todas las `solicitudesAjustePlazo` de una AC de un QE `CRITICA` tienen `estado !== 'PENDIENTE'`
- **THEN** esa AC no aparece en `acsConSolicitudAjustePlazo`

#### Scenario: ACs de QE severidad MEDIA o BAJA quedan excluidas
- **WHEN** una AC de un QE `severidad === 'MEDIA'` tiene una `solicitudAjustePlazo` con `estado === 'PENDIENTE'`
- **THEN** esa AC no aparece en `acsConSolicitudAjustePlazo`

#### Scenario: Cada ítem enlaza al QE padre, no a un formulario de aprobación
- **WHEN** se renderiza un ítem de `ACsExtensionPlazoWidget`
- **THEN** el enlace apunta a `/quality-events/:qeId` y no existe ningún botón de "Aprobar"/"Rechazar" en el widget

### Requirement: HeatmapIncidentesWidget se monta como último widget del dashboard
`AltaDireccionDashboard` SHALL montar `HeatmapIncidentesWidget` (mismo componente compartido que usa `JefeCalidadDashboard`) como último widget, con su propio rango (3/6/12 meses) y selector de local, independientes del resto del dashboard. El comportamiento detallado del widget (cálculo del mapa, interacción) es responsabilidad de su propia capability y no se redefine aquí.

#### Scenario: Heatmap aparece después de ACsExtensionPlazoWidget
- **WHEN** `AltaDireccionDashboard` renderiza con datos cargados
- **THEN** `HeatmapIncidentesWidget` es el último widget en el DOM, después de `ACsExtensionPlazoWidget`
