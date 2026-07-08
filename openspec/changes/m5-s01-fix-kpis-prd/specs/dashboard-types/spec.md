## MODIFIED Requirements

### Requirement: Tipos comunes de KPI parametrizados
El sistema SHALL definir en `src/features/dashboard/types/kpi.types.ts` un tipo `KpiId` como unión literal de 9 valores (`'KPI-01'` a `'KPI-09'`), un tipo `KpiMetaTipo` como unión literal `'ABSOLUTO' | 'REDUCCION_INTERANUAL'`, un tipo `KpiDefinition` con los campos `id: KpiId`, `nombre: string`, `descripcion: string`, `formula: string`, `unidad: 'PORCENTAJE' | 'DIAS' | 'TASA' | 'CONTEO' | 'DISTRIBUCION'`, `metaTipo: KpiMetaTipo`, `meta: number`, `frecuencia: 'MENSUAL' | 'TRIMESTRAL' | 'TIEMPO_REAL'`, `fuente: string`, y un tipo `KpiResult` con los campos `kpiId: KpiId`, `valor: number`, `meta: number`, `metaTipo: KpiMetaTipo`, `semaforo: 'VERDE' | 'AMARILLO' | 'ROJO' | 'INFORMATIVO'`, `periodo: string`, `calculadoEn: string`, `valorPeriodoAnterior?: number`, `distribucion?: { area: string; valor: number }[]`. El sistema NO SHALL definir una interfaz separada por cada uno de los 9 KPIs.

`valorPeriodoAnterior` SHALL estar presente únicamente cuando `metaTipo === 'REDUCCION_INTERANUAL'` (hoy, exclusivo de `KPI-04`). `distribucion` SHALL estar presente únicamente cuando `semaforo === 'INFORMATIVO'` (hoy, exclusivo de `KPI-09`); en ese caso `valor` SHALL contener el conteo del área con mayor valor de `distribucion`.

#### Scenario: KpiResult referencia un KpiId válido
- **WHEN** se construye un valor `KpiResult`
- **THEN** el campo `kpiId` solo acepta uno de los 9 valores literales de `KpiId`

#### Scenario: No existen tipos Kpi01...Kpi09 individuales
- **WHEN** se inspecciona `kpi.types.ts`
- **THEN** el único tipo que representa la forma de un KPI concreto es `KpiDefinition`/`KpiResult`, parametrizados por `KpiId`

#### Scenario: KPI con metaTipo REDUCCION_INTERANUAL expone valorPeriodoAnterior
- **WHEN** se construye un `KpiResult` con `kpiId: 'KPI-04'` y `metaTipo: 'REDUCCION_INTERANUAL'`
- **THEN** el resultado incluye `valorPeriodoAnterior` (puede ser `undefined` si no hay dato del año anterior para ese período, pero el campo existe en el tipo)

#### Scenario: KPI con semaforo INFORMATIVO expone distribucion
- **WHEN** se construye un `KpiResult` con `kpiId: 'KPI-09'` y `semaforo: 'INFORMATIVO'`
- **THEN** el resultado incluye `distribucion: { area: string; valor: number }[]` con al menos una entrada cuando existen QE con `areaAfectada` en el período

#### Scenario: Los 8 KPIs restantes mantienen metaTipo ABSOLUTO
- **WHEN** se inspecciona cualquier `KpiResult` con `kpiId` distinto de `'KPI-04'`
- **THEN** `metaTipo === 'ABSOLUTO'` y `valorPeriodoAnterior` es `undefined`

---

### Requirement: Registro constante de las 9 definiciones de KPI
El sistema SHALL exportar `KPI_DEFINITIONS: Record<KpiId, KpiDefinition>` desde `src/features/dashboard/constants/kpi.constants.ts`, con exactamente 9 entradas (`KPI-01` a `KPI-09`) que reflejan SHAC-PRD-003 §5.2: `KPI-01` "Tasa de cierre de QE en plazo" (PORCENTAJE, meta 90, mensual), `KPI-02` "Tiempo promedio de cierre de QE" (DIAS, meta 15, mensual), `KPI-03` "Tasa de reincidencia (reaperturas)" (PORCENTAJE, meta 5, trimestral), `KPI-04` "Índice de frecuencia de incidentes" (TASA, `metaTipo: 'REDUCCION_INTERANUAL'`, meta 10, mensual), `KPI-05` "Tasa de eficacia de acciones correctivas" (PORCENTAJE, meta 85, mensual), `KPI-06` "% Documentos vigentes bajo control" (PORCENTAJE, meta 100, mensual), `KPI-07` "Tiempo promedio de investigación" (DIAS, meta 7, mensual), `KPI-08` "ACs vencidas activas" (CONTEO, meta 3, tiempo real), `KPI-09` "NCs por área (mapa de calor)" (DISTRIBUCION, `metaTipo: 'ABSOLUTO'`, tiempo real no aplica — mensual, sin meta numérica significativa más allá del ranking). Cada entrada SHALL tener `meta` y `frecuencia` no vacíos, y `metaTipo` explícito (`'ABSOLUTO'` para las 8 restantes, `'REDUCCION_INTERANUAL'` únicamente para `KPI-04`).

#### Scenario: KPI_DEFINITIONS contiene las 9 entradas
- **WHEN** se itera `Object.keys(KPI_DEFINITIONS)`
- **THEN** el resultado son exactamente `['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-08', 'KPI-09']`

#### Scenario: KPI-04 referencia horas trabajadas como fuente y usa meta relativa
- **WHEN** se lee `KPI_DEFINITIONS['KPI-04']`
- **THEN** `fuente` menciona incidentes y horas trabajadas, y `metaTipo === 'REDUCCION_INTERANUAL'` con `meta === 10`

#### Scenario: KPI_DEFINITIONS ya no contiene los nombres inventados de M5-S01
- **WHEN** se lee `KPI_DEFINITIONS['KPI-05'].nombre` y `KPI_DEFINITIONS['KPI-09'].nombre`
- **THEN** ninguno es `'Tasa de Reporte Proactivo SyST'` ni `'Cumplimiento de Firma Dual en Cierre de QE Críticos'` (nombres reemplazados por este change)

#### Scenario: KPI-09 usa unidad DISTRIBUCION
- **WHEN** se lee `KPI_DEFINITIONS['KPI-09'].unidad`
- **THEN** el valor es `'DISTRIBUCION'`, distinto de `PORCENTAJE`/`DIAS`/`TASA`/`CONTEO`
