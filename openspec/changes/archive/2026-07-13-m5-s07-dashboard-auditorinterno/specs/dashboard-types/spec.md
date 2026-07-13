## MODIFIED Requirements

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` cinco interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `tendenciaMensualCierres: { periodo: string; cerrados: number }[]`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`.
- `AuditorDashboardData`: `hallazgosPorArea: { area: string; total: number }[]` (QE `origen O3_HALLAZGO_AUDITORIA` agrupados por `areaAfectada`, orden descendente por `total`), `hallazgosPorEstado: Record<QEStatus, number>` (mismo filtro de origen, las 9 claves de `QEStatus` siempre presentes), `evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }` (mismo filtro de origen, según `documentosVinculados.length > 0`), `tasaCierreEnPlazoPorArea: { area: string; tasaCierreEnPlazo: number; totalCerrados: number }[]` (todos los QE, no solo origen O3; orden ascendente por `tasaCierreEnPlazo`).

#### Scenario: Cada tipo de rol expone solo sus propios widgets
- **WHEN** se compara `OperarioDashboardData` con `AltaDireccionDashboardData`
- **THEN** no comparten ningún campo con el mismo nombre y forma (ambos son interfaces independientes, no una extensión de un tipo base de widgets)

#### Scenario: SupervisorDashboardData no expone KPIs organizacionales completos
- **WHEN** se construye un `SupervisorDashboardData`
- **THEN** `kpisArea` contiene únicamente los `KpiResult` relevantes al alcance de un Supervisor (no los 9 KPIs completos que sí ve `JefeCalidadDashboardData.kpis`)

#### Scenario: AuditorDashboardData.hallazgosPorEstado y evidenciasHallazgos filtran por origen O3
- **WHEN** se construye `AuditorDashboardData` sobre un store con QE de los 4 orígenes
- **THEN** `hallazgosPorArea`, `hallazgosPorEstado` y `evidenciasHallazgos` solo consideran QE con `origen === 'O3_HALLAZGO_AUDITORIA'`

#### Scenario: AuditorDashboardData.tasaCierreEnPlazoPorArea no filtra por origen
- **WHEN** se construye `AuditorDashboardData.tasaCierreEnPlazoPorArea`
- **THEN** el cálculo considera QE de cualquier `origen`, no solo `O3_HALLAZGO_AUDITORIA`
