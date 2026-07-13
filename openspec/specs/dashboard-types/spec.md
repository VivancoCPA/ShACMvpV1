# Spec: dashboard-types

## Purpose

Define the TypeScript type contracts for the Dashboard module: the 9 system KPIs (parametrized by a common `KpiId`/`KpiDefinition`/`KpiResult` shape rather than 9 disconnected interfaces), the lightweight cross-domain summary projections used by dashboard widgets, and the 5 role-specific dashboard data shapes with their role-to-type mapping.

---

## Requirements

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

---

### Requirement: Tipos de resumen (proyecciones ligeras) para widgets de dashboard
El sistema SHALL definir en `src/features/dashboard/types/dashboardSummary.types.ts` los tipos `QEResumen`, `IncidenteResumen`, `NCResumen`, `DocumentoResumen` y `AccionCorrectivaResumen`, cada uno como una proyección de un subconjunto de campos de su entidad completa (nunca la entidad completa), suficiente para renderizar una fila de widget: identificador, número/código, estado, severidad (cuando aplique), fecha relevante y área. `AccionCorrectivaResumen` SHALL incluir `origenTipo: 'QE' | 'NC' | 'INCIDENTE'` y `origenId: string` para permitir navegar al detalle correcto sin importar de qué dominio proviene la acción correctiva. `QEResumen` SHALL incluir además el campo opcional `fechaVerificacionProgramada?: string`, proyectado del campo homónimo de la entidad completa `QualityEvent`, para permitir que los widgets de dashboard determinen si un QE tiene un plazo de verificación real (RN-QE-008) antes de aplicar un tratamiento visual de semáforo.

#### Scenario: QEResumen no expone campos internos de análisis de causa raíz
- **WHEN** se construye un `QEResumen`
- **THEN** el tipo no incluye `cincoPorques`, `ishikawa` ni `auditTrail` (campos exclusivos del detalle completo de `QualityEvent`)

#### Scenario: AccionCorrectivaResumen identifica su dominio de origen
- **WHEN** se construye un `AccionCorrectivaResumen` a partir de una acción correctiva de un `Incidente`
- **THEN** `origenTipo === 'INCIDENTE'` y `origenId` es el `id` del incidente padre

#### Scenario: QEResumen proyecta fechaVerificacionProgramada cuando existe
- **WHEN** se construye un `QEResumen` a partir de un `QualityEvent` con `fechaVerificacionProgramada: '2026-07-10'`
- **THEN** el `QEResumen` resultante incluye `fechaVerificacionProgramada: '2026-07-10'`

#### Scenario: QEResumen omite fechaVerificacionProgramada cuando la entidad no la tiene
- **WHEN** se construye un `QEResumen` a partir de un `QualityEvent` sin `fechaVerificacionProgramada` definido
- **THEN** el `QEResumen` resultante tiene `fechaVerificacionProgramada: undefined`, no un valor inventado

---

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` seis interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData`, `JefeControlDocDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `qeAbiertosPorTipo: Record<QEType, number>`, `qesEnVerificacionArea: QEResumen[]`, `accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `tendenciaMensualCierres: { periodo: string; cerrados: number }[]`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`.
- `AuditorDashboardData`: `hallazgosPorArea: { area: string; total: number }[]` (QE `origen O3_HALLAZGO_AUDITORIA` agrupados por `areaAfectada`, orden descendente por `total`), `hallazgosPorEstado: Record<QEStatus, number>` (mismo filtro de origen, las 9 claves de `QEStatus` siempre presentes), `evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }` (mismo filtro de origen, según `documentosVinculados.length > 0`), `tasaCierreEnPlazoPorArea: { area: string; tasaCierreEnPlazo: number; totalCerrados: number }[]` (todos los QE, no solo origen O3; orden ascendente por `tasaCierreEnPlazo`).
- `JefeControlDocDashboardData`: `Record<string, never>` — sin campos propios en v1; el contenido de `JefeControlDocumentarioDashboard` es exclusivamente `AccionesRequeridasWidget`, que no depende de `useDashboardSummary()`. Este tipo existe para preservar el patrón "una interfaz por rol, unión discriminada por `rol`" y queda listo para ganar campos en un spec futuro sin romper la forma de la unión.

#### Scenario: Cada tipo de rol expone solo sus propios widgets
- **WHEN** se compara `OperarioDashboardData` con `AltaDireccionDashboardData`
- **THEN** no comparten ningún campo con el mismo nombre y forma (ambos son interfaces independientes, no una extensión de un tipo base de widgets)

#### Scenario: SupervisorDashboardData no expone KPIs organizacionales completos
- **WHEN** se construye un `SupervisorDashboardData`
- **THEN** `kpisArea` contiene únicamente los `KpiResult` relevantes al alcance de un Supervisor (no los 9 KPIs completos que sí ve `JefeCalidadDashboardData.kpis`)

#### Scenario: qeAbiertosPorTipo cubre los 4 valores de QEType siempre
- **WHEN** se construye un `SupervisorDashboardData` para un área sin ningún QE de tipo `SST`
- **THEN** `qeAbiertosPorTipo.SST === 0`, la clave existe con valor `0` en vez de estar ausente

#### Scenario: qesEnVerificacionArea solo incluye QE con plazo real de verificación
- **WHEN** se construye `qesEnVerificacionArea` a partir de los QEs del área
- **THEN** el arreglo solo contiene QE con `estado === 'EN_VERIFICACION'` y `fechaVerificacionProgramada` definido; ningún QE en otro estado aparece en este campo

#### Scenario: accionesCorrectivasPendientesArea incluye PENDIENTE y EN_EJECUCION, no solo vencidas
- **WHEN** se construye `accionesCorrectivasPendientesArea` a partir de las ACs del área
- **THEN** el arreglo incluye ACs con `estado === 'PENDIENTE'` o `estado === 'EN_EJECUCION'` sin importar si `plazoFecha` ya venció, a diferencia de `accionesCorrectivasVencidas` que sí exige vencimiento

#### Scenario: accionesCorrectivasVencidas ahora exige estado EN_EJECUCION
- **WHEN** se construye `accionesCorrectivasVencidas` a partir de una AC del área con `estado: 'PENDIENTE'` y `plazoFecha` en el pasado
- **THEN** esa AC NO aparece en `accionesCorrectivasVencidas` (solo `estado === 'EN_EJECUCION'` con `plazoFecha` vencida califica)

#### Scenario: JefeControlDocDashboardData no tiene campos requeridos
- **WHEN** un desarrollador construye un `JefeControlDocDashboardData`
- **THEN** `{}` es un valor válido — el tipo no exige ninguna propiedad

#### Scenario: AuditorDashboardData.hallazgosPorEstado y evidenciasHallazgos filtran por origen O3
- **WHEN** se construye `AuditorDashboardData` sobre un store con QE de los 4 orígenes
- **THEN** `hallazgosPorArea`, `hallazgosPorEstado` y `evidenciasHallazgos` solo consideran QE con `origen === 'O3_HALLAZGO_AUDITORIA'`

#### Scenario: AuditorDashboardData.tasaCierreEnPlazoPorArea no filtra por origen
- **WHEN** se construye `AuditorDashboardData.tasaCierreEnPlazoPorArea`
- **THEN** el cálculo considera QE de cualquier `origen`, no solo `O3_HALLAZGO_AUDITORIA`

---

### Requirement: Discriminated union y mapeo de rol a tipo de dashboard
El sistema SHALL exportar un tipo `DashboardSummaryData` como unión discriminada por el campo `rol` (`'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD' | 'ALTA_DIRECCION' | 'AUDITOR' | 'JEFE_CONTROL_DOC'`), donde cada variante empareja el valor de `rol` con su interfaz correspondiente (`data: OperarioDashboardData` cuando `rol === 'OPERARIO'`, ..., `data: JefeControlDocDashboardData` cuando `rol === 'JEFE_CONTROL_DOC'`). El sistema SHALL exportar una función `getDashboardDataTypeForRole(rol: UserRole): DashboardSummaryData['rol']` en `src/features/dashboard/utils/dashboardRoleMapping.ts` que mapea los 6 `UserRole` con acceso a `/dashboard` a una de las 6 variantes, mapeando `JEFE_CONTROL_DOCUMENTARIO` a `'JEFE_CONTROL_DOC'` (ya no a `'JEFE_CALIDAD'`).

#### Scenario: OPERARIO mapea a su propio tipo
- **WHEN** se llama `getDashboardDataTypeForRole('OPERARIO')`
- **THEN** retorna `'OPERARIO'`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO mapea a su propio tipo, no a JefeCalidadDashboardData
- **WHEN** se llama `getDashboardDataTypeForRole('JEFE_CONTROL_DOCUMENTARIO')`
- **THEN** retorna `'JEFE_CONTROL_DOC'`

#### Scenario: ADMINISTRADOR_SISTEMA no tiene mapeo
- **WHEN** se llama `getDashboardDataTypeForRole('ADMINISTRADOR_SISTEMA')`
- **THEN** la función retorna `undefined` o lanza, dado que este rol no tiene acceso a `/dashboard`
