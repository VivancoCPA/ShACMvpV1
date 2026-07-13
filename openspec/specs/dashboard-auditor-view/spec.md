# Spec: dashboard-auditor-view

## Purpose

Define the dashboard view rendered for the `AUDITOR_INTERNO` role: `AuditorDashboard` and its 4 widgets, composing `useDashboardSummary()` data into non-interactive area/estado breakdowns of hallazgos de auditoría (`origen === 'O3_HALLAZGO_AUDITORIA'`) plus an organization-wide closure-rate widget.

---

## Requirements

### Requirement: DashboardPage renderiza AuditorDashboard para el tipo AUDITOR
`DashboardPage.tsx` SHALL agregar una rama `if (dashboardType === 'AUDITOR') return <AuditorDashboard />` junto a las ramas existentes de `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD` y `ALTA_DIRECCION`, reemplazando el fallback `<ComingSoon label="Dashboard" />` para ese tipo.

#### Scenario: Usuario AUDITOR_INTERNO ve el dashboard de auditoría
- **WHEN** un usuario autenticado con `rol: 'AUDITOR_INTERNO'` navega a `/dashboard`
- **THEN** se renderiza `AuditorDashboard`, no `<ComingSoon />`

#### Scenario: Otros roles no se ven afectados
- **WHEN** un usuario `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST` o `ALTA_DIRECCION` navega a `/dashboard`
- **THEN** cada uno sigue viendo su propio dashboard sin cambios de comportamiento

---

### Requirement: AuditorDashboard compone los 4 widgets de auditoría
El componente `AuditorDashboard` (`src/features/dashboard/pages/AuditorDashboard.tsx`) SHALL consumir `useDashboardSummary()`, mostrar un estado de carga con `WidgetSkeleton` mientras `isLoading` es verdadero o `data.rol !== 'AUDITOR'`, y en el caso exitoso renderizar en un contenedor `space-y-8` dentro de `PageWrapper`, en este orden: `HallazgosPorAreaWidget`, `HallazgosPorEstadoWidget`, `EvidenciasHallazgosWidget`, `TasaCierrePorAreaWidget`.

#### Scenario: Carga muestra skeletons
- **WHEN** `useDashboardSummary()` está en `isLoading`
- **THEN** `AuditorDashboard` renderiza 4 `WidgetSkeleton` y ningún widget de datos

#### Scenario: Datos cargados renderizan los 4 widgets en orden
- **WHEN** `useDashboardSummary()` resuelve con `{ rol: 'AUDITOR', data }`
- **THEN** se renderizan, en orden, `HallazgosPorAreaWidget`, `HallazgosPorEstadoWidget`, `EvidenciasHallazgosWidget` y `TasaCierrePorAreaWidget`

---

### Requirement: HallazgosPorAreaWidget muestra el conteo de hallazgos O3 por área, sin navegación
`HallazgosPorAreaWidget` SHALL renderizar `hallazgosPorArea: { area: string; total: number }[]` (ya ordenado descendentemente por `total`) como una lista de filas no interactivas (área + conteo), sin enlace a `/quality-events` — `QEListParams` no soporta un filtro por `areaAfectada`, y agregarlo está fuera de alcance de este spec.

#### Scenario: Filas ordenadas de mayor a menor conteo
- **WHEN** `hallazgosPorArea` contiene `[{ area: 'Almacén Norte', total: 1 }, { area: 'Zona de Pesaje', total: 3 }]` en ese orden de llegada
- **THEN** el widget respeta el orden recibido (la ordenación ya la hizo el backend) mostrando "Zona de Pesaje" antes que "Almacén Norte" solo si así viene ordenado el arreglo

#### Scenario: Widget vacío cuando no hay hallazgos O3
- **WHEN** `hallazgosPorArea` es un arreglo vacío
- **THEN** `HallazgosPorAreaWidget` muestra un estado vacío, no un error

#### Scenario: Ninguna fila es un elemento clicable
- **WHEN** se renderiza `HallazgosPorAreaWidget` con datos
- **THEN** ninguna fila es un `<button>` ni tiene `onClick` — son contenedores estáticos

---

### Requirement: HallazgosPorEstadoWidget muestra el conteo de hallazgos O3 por estado, todas las filas navegables
`HallazgosPorEstadoWidget` SHALL renderizar `hallazgosPorEstado: Record<QEStatus, number>` con una fila por cada uno de los 9 `QEStatus` (mismo patrón visual que `QEPorEstadoWidget`), mostrando `0` para estados sin hallazgos (no un valor vacío/`undefined`). A diferencia de `QEPorEstadoWidget` (que solo navega para un subconjunto de estados "accionables"), **todas** las filas SHALL ser navegables, dirigiendo a `/quality-events?estado=${estado}&origen=O3_HALLAZGO_AUDITORIA`.

#### Scenario: Estados sin hallazgos muestran 0, no vacío
- **WHEN** ningún QE `origen O3` está en estado `VERIFICADO`
- **THEN** la fila de `VERIFICADO` muestra `0`, no un espacio en blanco

#### Scenario: Cualquier estado navega con ambos filtros
- **WHEN** el usuario hace clic en la fila del estado `PENDIENTE_CIERRE`
- **THEN** navega a `/quality-events?estado=PENDIENTE_CIERRE&origen=O3_HALLAZGO_AUDITORIA`

#### Scenario: Los 9 estados están siempre presentes
- **WHEN** se renderiza `HallazgosPorEstadoWidget`
- **THEN** hay exactamente 9 filas, una por cada `QEStatus`, sin importar cuántos tengan conteo 0

---

### Requirement: EvidenciasHallazgosWidget muestra dos conteos, sin lista
`EvidenciasHallazgosWidget` SHALL renderizar `evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }` como dos números o una barra simple (con evidencia / sin evidencia), sin listar los QE individuales y sin navegación.

#### Scenario: Ambos conteos suman el total de hallazgos O3
- **WHEN** existen 5 QE `origen O3`, 2 con `documentosVinculados` no vacío
- **THEN** `evidenciasHallazgos` es `{ conEvidencia: 2, sinEvidencia: 3 }`

#### Scenario: El widget no renderiza una lista de QEs
- **WHEN** se renderiza `EvidenciasHallazgosWidget`
- **THEN** no hay ningún elemento por QE individual (ni número ni código de QE) — solo los 2 conteos agregados

---

### Requirement: TasaCierrePorAreaWidget muestra la tasa de cierre en plazo por área, peor desempeño primero
`TasaCierrePorAreaWidget` SHALL renderizar `tasaCierreEnPlazoPorArea: { area: string; tasaCierreEnPlazo: number; totalCerrados: number }[]` (ya ordenado ascendentemente por `tasaCierreEnPlazo`, peor desempeño primero) como una lista informativa no interactiva, mostrando para cada área el porcentaje y el total de QE cerrados considerados. Áreas sin ningún QE cerrado en el período actual SHALL quedar fuera del arreglo (no se muestra un `0/0`).

#### Scenario: Orden ascendente por tasa de cierre en plazo
- **WHEN** `tasaCierreEnPlazoPorArea` contiene áreas con tasas `45`, `100` y `80`
- **THEN** el widget las renderiza en el orden `45`, `80`, `100` (peor primero)

#### Scenario: Área sin QE cerrados en el período no aparece
- **WHEN** un área tiene QE abiertos pero ninguno `CERRADO`/`VERIFICADO` con `fechaCierre` en el período actual
- **THEN** esa área no aparece en `tasaCierreEnPlazoPorArea`

#### Scenario: El widget no tiene filas clicables
- **WHEN** se renderiza `TasaCierrePorAreaWidget` con datos
- **THEN** ninguna fila navega a `/quality-events` — es una métrica agregada de desempeño por área, no una lista de QEs
