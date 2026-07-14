## ADDED Requirements

### Requirement: GET /api/dashboard/summary calcula tendencia mensual de 12 meses para JEFE_CALIDAD
Cuando `usuario.rol` resuelve a `'JEFE_CALIDAD'` (`JEFE_CALIDAD_SYST` o `JEFE_CONTROL_DOCUMENTARIO`), `buildJefeCalidadData` SHALL calcular `tendenciaMensualVolumen` iterando los últimos 12 meses (`ultimosMeses(12)`), contando por mes los QE cuyo `fechaHoraReporte` cae en ese mes (`abiertos`, sin filtrar por `estado`) y los QE cuyo `fechaCierre` cae en ese mes (`cerrados`, sin filtrar por `estado` — mismo criterio exacto que ya usaba `buildTendenciaMensualCierres`, distinto del filtro `CERRADO`/`VERIFICADO` que sí exige KPI-01/02). SHALL además calcular `tendenciaMensualKpis` invocando `calcularKpi01`, `calcularKpi04` y `calcularKpi05` una vez por cada uno de los mismos 12 meses, sin recalcular semáforo por punto. Este cálculo SHALL tener alcance organizacional completo (sin filtro por `usuario.id` ni `usuario.area`), igual que el resto de `JefeCalidadDashboardData`.

#### Scenario: tendenciaMensualVolumen cuenta QE por fechaHoraReporte y fechaCierre
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`
- **THEN** `data.tendenciaMensualVolumen` tiene 12 entradas y la entrada de un mes con QEs reportados en ese mes tiene `abiertos > 0`

#### Scenario: tendenciaMensualKpis reutiliza las funciones de cálculo existentes por mes
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CALIDAD_SYST`
- **THEN** `data.tendenciaMensualKpis['KPI-01'][i].valor` es igual al resultado de invocar la misma fórmula de KPI-01 con `periodo = data.tendenciaMensualKpis['KPI-01'][i].periodo`

#### Scenario: Alcance organizacional, sin filtro por usuario
- **WHEN** dos usuarios distintos con rol `JEFE_CALIDAD_SYST` solicitan `GET /api/dashboard/summary`
- **THEN** ambos reciben el mismo `tendenciaMensualVolumen` y `tendenciaMensualKpis`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO recibe la misma tendencia que JEFE_CALIDAD_SYST
- **WHEN** `GET /api/dashboard/summary` es solicitado autenticado como `JEFE_CONTROL_DOCUMENTARIO`
- **THEN** `data.tendenciaMensualVolumen` y `data.tendenciaMensualKpis` tienen la misma forma y el mismo criterio de cálculo que para `JEFE_CALIDAD_SYST` (ambos comparten `JefeCalidadDashboardData`)
