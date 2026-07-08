## MODIFIED Requirements

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` cinco interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `qeAbiertosPorTipo: Record<QEType, number>`, `qesEnVerificacionArea: QEResumen[]`, `accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `tendenciaMensualCierres: { periodo: string; cerrados: number }[]`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`.
- `AuditorDashboardData`: `hallazgosAuditoriaAbiertos: QEResumen[]`, `ncPorOrigenAuditoria: NCResumen[]`, `kpisCumplimiento: KpiResult[]`, `documentosProximaRevision: DocumentoResumen[]`.

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
