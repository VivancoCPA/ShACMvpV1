## MODIFIED Requirements

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` cinco interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasPorVencer: AccionCorrectivaResumen[]`, `tendenciaMensualVolumen: { periodo: string; abiertos: number; cerrados: number }[]`, `tendenciaMensualKpis: Record<'KPI-01' | 'KPI-04' | 'KPI-05', { periodo: string; valor: number }[]>`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`.
- `AuditorDashboardData`: `hallazgosAuditoriaAbiertos: QEResumen[]`, `ncPorOrigenAuditoria: NCResumen[]`, `kpisCumplimiento: KpiResult[]`, `documentosProximaRevision: DocumentoResumen[]`.

`tendenciaMensualVolumen[i].cerrados` SHALL contar QE cuyo `fechaCierre` cae en ese mes, sin filtrar por `estado` (mismo criterio que ya usaba el campo eliminado `tendenciaMensualCierres` — no exige `CERRADO`/`VERIFICADO` como sí lo hace el cálculo de KPI-01/02).

`JefeCalidadDashboardData.tendenciaMensualVolumen` y `tendenciaMensualKpis` SHALL tener exactamente 12 entradas cada uno (una por mes), ordenadas de más antiguo a más reciente, cubriendo los 12 meses hacia atrás desde el mes actual del sistema. `tendenciaMensualKpis` SHALL tener exactamente las 3 claves `'KPI-01'`, `'KPI-04'` y `'KPI-05'` — ningún otro `KpiId`. El campo `tendenciaMensualCierres` (existente desde M5-S01, sin consumidor real) queda eliminado del tipo, reemplazado por el campo `cerrados` dentro de cada entrada de `tendenciaMensualVolumen`.

#### Scenario: Cada tipo de rol expone solo sus propios widgets
- **WHEN** se compara `OperarioDashboardData` con `AltaDireccionDashboardData`
- **THEN** no comparten ningún campo con el mismo nombre y forma (ambos son interfaces independientes, no una extensión de un tipo base de widgets)

#### Scenario: SupervisorDashboardData no expone KPIs organizacionales completos
- **WHEN** se construye un `SupervisorDashboardData`
- **THEN** `kpisArea` contiene únicamente los `KpiResult` relevantes al alcance de un Supervisor (no los 9 KPIs completos que sí ve `JefeCalidadDashboardData.kpis`)

#### Scenario: tendenciaMensualVolumen tiene 12 entradas ordenadas cronológicamente
- **WHEN** se construye un `JefeCalidadDashboardData`
- **THEN** `tendenciaMensualVolumen.length === 12` y `tendenciaMensualVolumen[0].periodo` es anterior a `tendenciaMensualVolumen[11].periodo`

#### Scenario: tendenciaMensualKpis solo tiene 3 claves
- **WHEN** se inspecciona `Object.keys(jefeCalidadData.tendenciaMensualKpis)`
- **THEN** el resultado es exactamente `['KPI-01', 'KPI-04', 'KPI-05']`

#### Scenario: tendenciaMensualCierres ya no existe en el tipo
- **WHEN** se inspecciona la interfaz `JefeCalidadDashboardData`
- **THEN** no tiene ningún campo llamado `tendenciaMensualCierres`
