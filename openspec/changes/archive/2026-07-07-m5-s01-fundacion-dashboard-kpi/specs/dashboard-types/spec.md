## ADDED Requirements

### Requirement: Tipos comunes de KPI parametrizados
El sistema SHALL definir en `src/features/dashboard/types/kpi.types.ts` un tipo `KpiId` como unión literal de 9 valores (`'KPI-01'` a `'KPI-09'`), un tipo `KpiDefinition` con los campos `id: KpiId`, `nombre: string`, `descripcion: string`, `formula: string`, `unidad: 'PORCENTAJE' | 'DIAS' | 'TASA' | 'CONTEO'`, `meta: number`, `frecuencia: 'MENSUAL' | 'TRIMESTRAL'`, `fuente: string`, y un tipo `KpiResult` con los campos `kpiId: KpiId`, `valor: number`, `meta: number`, `semaforo: 'VERDE' | 'AMARILLO' | 'ROJO'`, `periodo: string`, `calculadoEn: string`. El sistema NO SHALL definir una interfaz separada por cada uno de los 9 KPIs.

#### Scenario: KpiResult referencia un KpiId válido
- **WHEN** se construye un valor `KpiResult`
- **THEN** el campo `kpiId` solo acepta uno de los 9 valores literales de `KpiId`

#### Scenario: No existen tipos Kpi01...Kpi09 individuales
- **WHEN** se inspecciona `kpi.types.ts`
- **THEN** el único tipo que representa la forma de un KPI concreto es `KpiDefinition`/`KpiResult`, parametrizados por `KpiId`

---

### Requirement: Registro constante de las 9 definiciones de KPI
El sistema SHALL exportar `KPI_DEFINITIONS: Record<KpiId, KpiDefinition>` desde `src/features/dashboard/constants/kpi.constants.ts`, con exactamente 9 entradas (`KPI-01` a `KPI-09`), cada una con `meta` y `frecuencia` numérico/enumerado no vacíos.

#### Scenario: KPI_DEFINITIONS contiene las 9 entradas
- **WHEN** se itera `Object.keys(KPI_DEFINITIONS)`
- **THEN** el resultado son exactamente `['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-08', 'KPI-09']`

#### Scenario: KPI-04 referencia horas trabajadas como fuente
- **WHEN** se lee `KPI_DEFINITIONS['KPI-04'].fuente`
- **THEN** el texto menciona incidentes y horas trabajadas

---

### Requirement: Tipos de resumen (proyecciones ligeras) para widgets de dashboard
El sistema SHALL definir en `src/features/dashboard/types/dashboardSummary.types.ts` los tipos `QEResumen`, `IncidenteResumen`, `NCResumen`, `DocumentoResumen` y `AccionCorrectivaResumen`, cada uno como una proyección de un subconjunto de campos de su entidad completa (nunca la entidad completa), suficiente para renderizar una fila de widget: identificador, número/código, estado, severidad (cuando aplique), fecha relevante y área. `AccionCorrectivaResumen` SHALL incluir `origenTipo: 'QE' | 'NC' | 'INCIDENTE'` y `origenId: string` para permitir navegar al detalle correcto sin importar de qué dominio proviene la acción correctiva.

#### Scenario: QEResumen no expone campos internos de análisis de causa raíz
- **WHEN** se construye un `QEResumen`
- **THEN** el tipo no incluye `cincoPorques`, `ishikawa` ni `auditTrail` (campos exclusivos del detalle completo de `QualityEvent`)

#### Scenario: AccionCorrectivaResumen identifica su dominio de origen
- **WHEN** se construye un `AccionCorrectivaResumen` a partir de una acción correctiva de un `Incidente`
- **THEN** `origenTipo === 'INCIDENTE'` y `origenId` es el `id` del incidente padre

---

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` cinco interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `tendenciaMensualCierres: { periodo: string; cerrados: number }[]`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`.
- `AuditorDashboardData`: `hallazgosAuditoriaAbiertos: QEResumen[]`, `ncPorOrigenAuditoria: NCResumen[]`, `kpisCumplimiento: KpiResult[]`, `documentosProximaRevision: DocumentoResumen[]`.

#### Scenario: Cada tipo de rol expone solo sus propios widgets
- **WHEN** se compara `OperarioDashboardData` con `AltaDireccionDashboardData`
- **THEN** no comparten ningún campo con el mismo nombre y forma (ambos son interfaces independientes, no una extensión de un tipo base de widgets)

#### Scenario: SupervisorDashboardData no expone KPIs organizacionales completos
- **WHEN** se construye un `SupervisorDashboardData`
- **THEN** `kpisArea` contiene únicamente los `KpiResult` relevantes al alcance de un Supervisor (no los 9 KPIs completos que sí ve `JefeCalidadDashboardData.kpis`)

---

### Requirement: Discriminated union y mapeo de rol a tipo de dashboard
El sistema SHALL exportar un tipo `DashboardSummaryData` como unión discriminada por el campo `rol` (`'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD' | 'ALTA_DIRECCION' | 'AUDITOR'`), donde cada variante empareja el valor de `rol` con su interfaz correspondiente (`data: OperarioDashboardData` cuando `rol === 'OPERARIO'`, etc.). El sistema SHALL exportar una función `getDashboardDataTypeForRole(rol: UserRole): DashboardSummaryData['rol']` en `src/features/dashboard/utils/dashboardRoleMapping.ts` que mapea los 6 `UserRole` con acceso a `/dashboard` a una de las 5 variantes, mapeando `JEFE_CONTROL_DOCUMENTARIO` a `'JEFE_CALIDAD'`.

#### Scenario: OPERARIO mapea a su propio tipo
- **WHEN** se llama `getDashboardDataTypeForRole('OPERARIO')`
- **THEN** retorna `'OPERARIO'`

#### Scenario: JEFE_CONTROL_DOCUMENTARIO reutiliza JefeCalidadDashboardData
- **WHEN** se llama `getDashboardDataTypeForRole('JEFE_CONTROL_DOCUMENTARIO')`
- **THEN** retorna `'JEFE_CALIDAD'`

#### Scenario: ADMINISTRADOR_SISTEMA no tiene mapeo
- **WHEN** se llama `getDashboardDataTypeForRole('ADMINISTRADOR_SISTEMA')`
- **THEN** la función retorna `undefined` o lanza, dado que este rol no tiene acceso a `/dashboard`
