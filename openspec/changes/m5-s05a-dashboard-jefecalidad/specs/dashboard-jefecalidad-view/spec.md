## ADDED Requirements

### Requirement: JefeCalidadDashboard renderiza los 9 KPIs completos
El sistema SHALL implementar `JefeCalidadDashboard` en `src/features/dashboard/pages/JefeCalidadDashboard.tsx`, consumiendo `useDashboardSummary()` y renderizando, cuando `data.rol === 'JEFE_CALIDAD'`, un widget `KpiGridWidget` que muestra las 9 entradas de `data.data.kpis` (`KpiResult[]`). Cada tarjeta SHALL mostrar: `kpiId`, el `nombre` correspondiente desde `KPI_DEFINITIONS`, el `valor` calculado formateado según `unidad` (`PORCENTAJE` con símbolo `%`, `DIAS` con sufijo de días, `TASA` como tasa por 1,000,000, `CONTEO` como entero), la `meta`, y un indicador visual de color derivado de `semaforo` (`VERDE`/`AMARILLO`/`ROJO`).

#### Scenario: Las 9 tarjetas de KPI se renderizan
- **WHEN** `JefeCalidadDashboard` recibe `data.data.kpis` con 9 elementos
- **THEN** se renderizan exactamente 9 tarjetas, una por cada `KpiId`

#### Scenario: Valor de KPI en PORCENTAJE se formatea con símbolo
- **WHEN** un `KpiResult` tiene `unidad: 'PORCENTAJE'` (vía `KPI_DEFINITIONS[kpiId].unidad`) y `valor: 87.5`
- **THEN** la tarjeta muestra el valor con el símbolo `%`

#### Scenario: Semáforo ROJO se refleja visualmente
- **WHEN** un `KpiResult` tiene `semaforo: 'ROJO'`
- **THEN** la tarjeta correspondiente usa el color semántico de error (`error`/rojo), no el de éxito ni advertencia

---

### Requirement: Widget de QEs por estado con navegación a acciones del PRD
`JefeCalidadDashboard` SHALL renderizar `QEPorEstadoWidget`, recibiendo `qePorEstado: Record<QEStatus, number>` y mostrando exactamente 9 filas, una por cada uno de los 9 valores de `QEStatus` (`ABIERTO`, `EN_INVESTIGACION`, `ANALISIS_COMPLETADO`, `EN_EJECUCION`, `PENDIENTE_CIERRE`, `CERRADO`, `EN_VERIFICACION`, `VERIFICADO`, `REABIERTO`), con el conteo correspondiente (`0` si no hay QE en ese estado). La fila `ANALISIS_COMPLETADO` SHALL ser clicable y navegar a `/quality-events?estado=ANALISIS_COMPLETADO`. La fila `PENDIENTE_CIERRE` SHALL ser clicable y navegar a `/quality-events?estado=PENDIENTE_CIERRE`. Las 7 filas restantes NO SHALL ser clicables (sin acción de navegación asociada).

#### Scenario: Las 9 filas de estado se renderizan con su conteo
- **WHEN** `qePorEstado` es `{ ABIERTO: 3, EN_INVESTIGACION: 1, ANALISIS_COMPLETADO: 0, EN_EJECUCION: 2, PENDIENTE_CIERRE: 1, CERRADO: 5, EN_VERIFICACION: 2, VERIFICADO: 4, REABIERTO: 0 }`
- **THEN** se renderizan 9 filas, cada una mostrando el `QEStatus` correspondiente y su conteo exacto, incluyendo las filas en `0`

#### Scenario: Click en fila ANALISIS_COMPLETADO navega a la lista filtrada
- **WHEN** el usuario hace click en la fila `ANALISIS_COMPLETADO`
- **THEN** la aplicación navega a `/quality-events?estado=ANALISIS_COMPLETADO`

#### Scenario: Click en fila PENDIENTE_CIERRE navega a la lista filtrada
- **WHEN** el usuario hace click en la fila `PENDIENTE_CIERRE`
- **THEN** la aplicación navega a `/quality-events?estado=PENDIENTE_CIERRE`

#### Scenario: Fila ABIERTO no es clicable
- **WHEN** el usuario intenta interactuar con la fila `ABIERTO`
- **THEN** no ocurre ninguna navegación (la fila no expone `onClick`/`role="button"`)

---

### Requirement: Widget de ACs por vencer en 5 días, separado en críticas y próximas
`JefeCalidadDashboard` SHALL renderizar `ACsPorVencerWidget`, recibiendo `accionesCorrectivasPorVencer: AccionCorrectivaResumen[]` (ya filtradas por el handler a origen `QE`/`NC`, estado no terminal, y `diasHabilesRestantes <= 5`). El widget SHALL calcular `calcularEstadoSemaforoDesdeFecha(ac.plazoFecha)` por cada elemento y renderizar el subconjunto con estado `ROJO` dentro de un `SemaforoCriticoBanner`, y el subconjunto con estado `AMARILLO` como una lista de `SemaforoRow`, cada fila con `onClick` que navega a `/quality-events/:id` o `/nonconformities/:id` según `origenTipo`/`origenId`. Cuando ambos subconjuntos están vacíos, SHALL mostrar un estado vacío centrado en vez de renderizar el banner o la lista.

#### Scenario: ACs vencidas se muestran en el banner crítico
- **WHEN** `accionesCorrectivasPorVencer` incluye 2 elementos cuyo `plazoFecha` ya pasó (estado semáforo `ROJO`)
- **THEN** `SemaforoCriticoBanner` se renderiza con esos 2 elementos

#### Scenario: ACs próximas a vencer se muestran como filas de semáforo
- **WHEN** `accionesCorrectivasPorVencer` incluye un elemento con `diasHabilesRestantes` entre 1 y 5 (estado `AMARILLO`)
- **THEN** se renderiza una `SemaforoRow` para ese elemento, fuera del banner crítico

#### Scenario: Click en una fila de AC navega al origen correcto
- **WHEN** el usuario hace click en una `SemaforoRow` cuyo `origenTipo === 'NC'` y `origenId === 'nc-005'`
- **THEN** la aplicación navega a `/nonconformities/nc-005`

#### Scenario: Sin ACs por vencer se muestra estado vacío
- **WHEN** `accionesCorrectivasPorVencer` es un array vacío
- **THEN** se renderiza un mensaje de estado vacío, sin banner ni filas de semáforo

---

### Requirement: JefeCalidadDashboard es la vista real para JEFE_CALIDAD_SYST y JEFE_CONTROL_DOCUMENTARIO
`DashboardPage` SHALL renderizar `JefeCalidadDashboard` cuando `getDashboardDataTypeForRole(user.rol) === 'JEFE_CALIDAD'`, cubriendo tanto `JEFE_CALIDAD_SYST` como `JEFE_CONTROL_DOCUMENTARIO` sin lógica de branching adicional (ambos comparten la misma forma de datos, `JefeCalidadDashboardData`). Mientras `data` no esté disponible o `data.rol !== 'JEFE_CALIDAD'`, SHALL mostrarse un esqueleto de carga, no un error.

#### Scenario: JEFE_CALIDAD_SYST ve JefeCalidadDashboard en /dashboard
- **WHEN** un usuario autenticado con rol `JEFE_CALIDAD_SYST` navega a `/dashboard`
- **THEN** se renderiza `JefeCalidadDashboard`, no `ComingSoon`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO ve JefeCalidadDashboard en /dashboard
- **WHEN** un usuario autenticado con rol `JEFE_CONTROL_DOCUMENTARIO` navega a `/dashboard`
- **THEN** se renderiza `JefeCalidadDashboard`, no `ComingSoon`

#### Scenario: Carga en curso muestra esqueleto, no error
- **WHEN** `useDashboardSummary()` está en `isLoading: true`
- **THEN** `JefeCalidadDashboard` renderiza un esqueleto de carga en vez de intentar leer `data.data`
