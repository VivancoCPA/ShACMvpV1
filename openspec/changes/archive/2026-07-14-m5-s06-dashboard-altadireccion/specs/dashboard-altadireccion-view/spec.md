## ADDED Requirements

### Requirement: DashboardPage renderiza AltaDireccionDashboard para el tipo ALTA_DIRECCION
`DashboardPage.tsx` SHALL agregar una rama `if (dashboardType === 'ALTA_DIRECCION') return <AltaDireccionDashboard />` junto a las ramas existentes de `OPERARIO`, `SUPERVISOR` y `JEFE_CALIDAD`, reemplazando el fallback `<ComingSoon label="Dashboard" />` para ese tipo.

#### Scenario: Usuario ALTA_DIRECCION ve el dashboard ejecutivo
- **WHEN** un usuario autenticado con `rol: 'ALTA_DIRECCION'` navega a `/dashboard`
- **THEN** se renderiza `AltaDireccionDashboard`, no `<ComingSoon />`

#### Scenario: Otros roles no se ven afectados
- **WHEN** un usuario `OPERARIO`, `SUPERVISOR` o `JEFE_CALIDAD_SYST` navega a `/dashboard`
- **THEN** cada uno sigue viendo su propio dashboard sin cambios de comportamiento

---

### Requirement: AltaDireccionDashboard compone los 5 widgets ejecutivos
El componente `AltaDireccionDashboard` (`src/features/dashboard/pages/AltaDireccionDashboard.tsx`) SHALL consumir `useDashboardSummary()`, mostrar un estado de carga con `WidgetSkeleton` mientras `isLoading` es verdadero o `data.rol !== 'ALTA_DIRECCION'`, y en el caso exitoso renderizar en un contenedor `space-y-8` dentro de `PageWrapper`, en este orden: `KpisEjecutivosWidget`, `ComparativaMensualWidget`, `QEsCriticosWidget`, `ReaperturasWidget`, `ACsExtensionPlazoWidget`.

#### Scenario: Carga muestra skeletons
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `AltaDireccionDashboard` renderiza 5 `WidgetSkeleton` y ningún widget de datos

#### Scenario: Datos cargados renderizan los 5 widgets en orden
- **WHEN** `useDashboardSummary()` resuelve con `{ rol: 'ALTA_DIRECCION', data }`
- **THEN** se renderizan, en orden, `KpisEjecutivosWidget`, `ComparativaMensualWidget`, `QEsCriticosWidget`, `ReaperturasWidget` y `ACsExtensionPlazoWidget`

---

### Requirement: KpisEjecutivosWidget muestra 5 indicadores ejecutivos
`KpisEjecutivosWidget` SHALL renderizar 5 tarjetas: "QEs abiertos" (`resumenPorModulo.qualityEvents.abiertos`, conteo simple sin semáforo), "QEs vencidos" (`resumenPorModulo.qualityEvents.vencidos`, conteo simple sin semáforo), y KPI-01/KPI-04/KPI-05 tomados de `kpisEstrategicos.filter(k => ['KPI-01','KPI-04','KPI-05'].includes(k.kpiId))`, reutilizando el mismo formato visual (valor, meta, semáforo por color) que `KpiGridWidget` usa en `JefeCalidadDashboard`.

#### Scenario: QEs abiertos incluye REABIERTO, excluye CERRADO y VERIFICADO
- **WHEN** el store de QE contiene QEs en cada uno de los 7 estados no `CERRADO` ni `VERIFICADO` (incluido `REABIERTO`)
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
- **THEN** renderiza exactamente 5 tarjetas, en el orden: QEs abiertos, QEs vencidos, KPI-01, KPI-04, KPI-05

---

### Requirement: ComparativaMensualWidget muestra tendencia vs mes anterior para KPI-01/04/05
El backend (`buildAltaDireccionData`) SHALL exponer `comparativaMensual: Record<'KPI-01'|'KPI-04'|'KPI-05', { actual: number; anterior: number; tendencia: 'SUBE'|'BAJA'|'ESTABLE' }>`, calculado invocando `calcularKpi01`/`calcularKpi04`/`calcularKpi05` (ya existentes) sobre los 2 últimos períodos de `ultimosMeses(2)`, sin duplicar la fórmula de cálculo mensual. `tendencia` SHALL ser `'ESTABLE'` cuando `Math.abs(actual - anterior) < 2` (umbral de 2 puntos porcentuales), `'SUBE'` cuando la diferencia es positiva y mayor o igual al umbral, `'BAJA'` cuando es negativa y mayor o igual al umbral en magnitud. `ComparativaMensualWidget` SHALL renderizar, para cada uno de los 3 KPIs, el valor actual, el valor del mes anterior y un ícono/etiqueta de tendencia (↑/↓/=).

#### Scenario: Variación menor al umbral se marca ESTABLE
- **WHEN** KPI-01 pasa de 91% a 92.5% entre el mes anterior y el actual
- **THEN** `comparativaMensual['KPI-01'].tendencia === 'ESTABLE'`

#### Scenario: Variación mayor al umbral se marca SUBE o BAJA
- **WHEN** KPI-05 pasa de 80% a 85% entre el mes anterior y el actual
- **THEN** `comparativaMensual['KPI-05'].tendencia === 'SUBE'`

#### Scenario: Reutiliza las funciones de cálculo mensual existentes
- **WHEN** se calcula `comparativaMensual['KPI-04']`
- **THEN** los valores `actual` y `anterior` provienen de invocar `calcularKpi04(incidentes, periodo)` para los 2 últimos períodos de `ultimosMeses(2)`, sin una fórmula nueva y distinta a la usada en `TendenciaMensualWidget`

---

### Requirement: QEsCriticosWidget lista QEs con severidad CRITICA en estado no terminal
`QEsCriticosWidget` SHALL renderizar `alertasCriticas: QEResumen[]` (ya calculado por `buildAltaDireccionData` filtrando `severidad === 'CRITICA' && estado !== 'CERRADO' && estado !== 'VERIFICADO'`), cada ítem con enlace a `/quality-events/:id`.

#### Scenario: Cada QE crítico enlaza a su detalle
- **WHEN** `alertasCriticas` contiene un QE con `id: 'qe-2026-010'`
- **THEN** el ítem correspondiente enlaza a `/quality-events/qe-2026-010`

#### Scenario: Widget vacío cuando no hay QEs críticos activos
- **WHEN** `alertasCriticas` es un arreglo vacío
- **THEN** `QEsCriticosWidget` muestra un estado vacío, no un error

---

### Requirement: ReaperturasWidget lista QEs reabiertos ordenados por fecha de reapertura más reciente
El backend SHALL exponer `reaperturas: QEReaperturaResumen[]` en `AltaDireccionDashboardData`, filtrando `qes.filter(qe => qe.ciclo > 1)`, agregando `ciclo` y `fechaReapertura` (el `timestamp` de la entrada de `auditTrail` más reciente con `estadoNuevo === 'REABIERTO'`, o `actualizadoEn` como fallback si no existe tal entrada), ordenado descendentemente por `fechaReapertura`. `ReaperturasWidget` SHALL renderizar esa lista con enlace a `/quality-events/:id` y el número de ciclo visible.

#### Scenario: Orden por fecha de reapertura más reciente primero
- **WHEN** `reaperturas` contiene QEs con `fechaReapertura` en distintas fechas
- **THEN** el primer elemento tiene la `fechaReapertura` más reciente

#### Scenario: QE con múltiples reaperturas usa el evento más reciente
- **WHEN** un QE con `ciclo === 3` tiene 2 entradas de auditoría con `estadoNuevo === 'REABIERTO'`
- **THEN** `fechaReapertura` corresponde al `timestamp` de la más reciente de esas 2 entradas

#### Scenario: QEs con ciclo 1 no aparecen
- **WHEN** un QE tiene `ciclo === 1`
- **THEN** no aparece en `reaperturas`

---

### Requirement: ACsExtensionPlazoWidget lista ACs de QEs Alta/Crítica con solicitud de ajuste de plazo pendiente
El backend SHALL exponer `acsConSolicitudAjustePlazo: ACSolicitudAjustePlazoResumen[]` en `AltaDireccionDashboardData`, recorriendo QEs con `severidad === 'ALTA' || severidad === 'CRITICA'` y sus `accionesCorrectivas.filter(ac => ac.solicitudAjustePlazo?.estado === 'PENDIENTE')`. `ACsExtensionPlazoWidget` SHALL renderizar cada ítem con enlace a `/quality-events/:qeId` (no implementa un formulario de aprobación; solo lista y enlaza al detalle).

#### Scenario: Solo ACs con solicitud PENDIENTE aparecen
- **WHEN** una AC de un QE `CRITICA` tiene `solicitudAjustePlazo.estado === 'APROBADA'`
- **THEN** esa AC no aparece en `acsConSolicitudAjustePlazo`

#### Scenario: ACs de QE severidad MEDIA o BAJA quedan excluidas
- **WHEN** una AC de un QE `severidad === 'MEDIA'` tiene `solicitudAjustePlazo.estado === 'PENDIENTE'`
- **THEN** esa AC no aparece en `acsConSolicitudAjustePlazo`

#### Scenario: Cada ítem enlaza al QE padre, no a un formulario de aprobación
- **WHEN** se renderiza un ítem de `ACsExtensionPlazoWidget`
- **THEN** el enlace apunta a `/quality-events/:qeId` y no existe ningún botón de "Aprobar"/"Rechazar" en el widget
