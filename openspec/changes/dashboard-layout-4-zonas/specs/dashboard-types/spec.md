## ADDED Requirements

### Requirement: Dirección de la meta, datos incompletos y tendencias en los tipos de KPI
`KpiDefinition` (`types/kpi.types.ts`) SHALL incluir `direccion: KpiDireccion | null`, con `KpiDireccion = 'MAYOR_MEJOR' | 'MENOR_MEJOR'`. `KPI_DEFINITIONS` SHALL asignar `MAYOR_MEJOR` a KPI-01, KPI-05 y KPI-06; `MENOR_MEJOR` a KPI-02, KPI-03, KPI-04, KPI-07 y KPI-08; y `null` a KPI-09, como espejo de `DashboardKpiConstants.Definiciones` del backend (KPI-04, que el backend modela como `REDUCCION_INTERANUAL` sin dirección, se marca `MENOR_MEJOR` porque una tasa de incidentes más baja es mejor). `KpiResult` SHALL incluir `datosIncompletos?: boolean` y aceptar `valorPeriodoAnterior?: number | null`. `KpiPeriodoTipo = 'mes' | 'trimestre' | 'anio'` SHALL exportarse desde `kpi.types.ts`.

`JefeCalidadDashboardData.tendenciaMensualKpis` SHALL tiparse como `Record<'KPI-01' | 'KPI-04' | 'KPI-05', TendenciaMensualKpiEntry[]> & Partial<Record<'KPI-02' | 'KPI-07', TendenciaMensualKpiEntry[]>>`. `AltaDireccionDashboardData` SHALL incluir `tendenciaMensualKpis: Record<'KPI-01' | 'KPI-04' | 'KPI-05', TendenciaMensualKpiEntry[]>`. `JefeControlDocDashboardData` SHALL pasar a ser `{ documentosRevisionVencida: number; documentosRevisionProxima: number }`.

#### Scenario: Dirección de cada KPI
- **WHEN** se lee `KPI_DEFINITIONS['KPI-02'].direccion` y `KPI_DEFINITIONS['KPI-09'].direccion`
- **THEN** valen `'MENOR_MEJOR'` y `null`

#### Scenario: Summary de JCD tipado con conteos
- **WHEN** `DashboardSummaryData` tiene `rol: 'JEFE_CONTROL_DOC'`
- **THEN** `data.documentosRevisionVencida` y `data.documentosRevisionProxima` son `number` para TypeScript
