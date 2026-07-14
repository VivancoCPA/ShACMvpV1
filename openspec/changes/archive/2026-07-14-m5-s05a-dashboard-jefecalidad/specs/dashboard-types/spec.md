## MODIFIED Requirements

### Requirement: Tipos de dashboard específicos por rol
El sistema SHALL definir en `src/features/dashboard/types/dashboardData.types.ts` cinco interfaces distintas — `OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData` — cada una reflejando los widgets propios de ese rol, sin un tipo genérico de "widget" compartido entre ellas:
- `OperarioDashboardData`: `misIncidentesReportados: IncidenteResumen[]`, `misQEReportados: QEResumen[]`, `accionesCorrectivasAsignadas: AccionCorrectivaResumen[]`, `documentosPendientesLectura: DocumentoResumen[]`.
- `SupervisorDashboardData`: `kpisArea: KpiResult[]`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasVencidas: AccionCorrectivaResumen[]`, `incidentesRecientes: IncidenteResumen[]`, `semaforoPlazos: { verde: number; amarillo: number; rojo: number }`.
- `JefeCalidadDashboardData`: `kpis: KpiResult[]`, `qeCriticosAbiertos: QEResumen[]`, `ncPendientesVerificacion: NCResumen[]`, `distribucionQEPorTipo: Record<QEType, number>`, `qePorEstado: Record<QEStatus, number>`, `accionesCorrectivasPorVencer: AccionCorrectivaResumen[]`, `tendenciaMensualCierres: { periodo: string; cerrados: number }[]`.
- `AltaDireccionDashboardData`: `kpisEstrategicos: KpiResult[]`, `resumenPorModulo: { documentos: { total: number; publicados: number; vencidosRevision: number }; noConformidades: { total: number; abiertas: number; cerradas: number }; incidentes: { total: number; conLesionados: number }; qualityEvents: { total: number; criticosAbiertos: number } }`, `alertasCriticas: QEResumen[]`, `tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]`.
- `AuditorDashboardData`: `hallazgosAuditoriaAbiertos: QEResumen[]`, `ncPorOrigenAuditoria: NCResumen[]`, `kpisCumplimiento: KpiResult[]`, `documentosProximaRevision: DocumentoResumen[]`.

`JefeCalidadDashboardData.qePorEstado` SHALL contar TODOS los Quality Events del sistema (alcance organizacional completo, sin filtro por área ni por usuario) agrupados por cada uno de los 9 valores de `QEStatus`. `JefeCalidadDashboardData.accionesCorrectivasPorVencer` SHALL contener únicamente acciones correctivas de origen `QE` o `NC` (nunca `INCIDENTE`) cuyo estado no sea terminal y cuyo plazo esté a 5 días hábiles o menos (incluye ya vencidas).

#### Scenario: Cada tipo de rol expone solo sus propios widgets
- **WHEN** se compara `OperarioDashboardData` con `AltaDireccionDashboardData`
- **THEN** no comparten ningún campo con el mismo nombre y forma (ambos son interfaces independientes, no una extensión de un tipo base de widgets)

#### Scenario: SupervisorDashboardData no expone KPIs organizacionales completos
- **WHEN** se construye un `SupervisorDashboardData`
- **THEN** `kpisArea` contiene únicamente los `KpiResult` relevantes al alcance de un Supervisor (no los 9 KPIs completos que sí ve `JefeCalidadDashboardData.kpis`)

#### Scenario: JefeCalidadDashboardData.qePorEstado no filtra por área
- **WHEN** se construye un `JefeCalidadDashboardData` para un sistema con QE en múltiples áreas
- **THEN** `qePorEstado` refleja el conteo total de QE de todas las áreas, no solo la del usuario autenticado

#### Scenario: JefeCalidadDashboardData.accionesCorrectivasPorVencer excluye origen INCIDENTE
- **WHEN** se construye un `JefeCalidadDashboardData` y existe una acción correctiva de un Incidente con `plazoFecha` dentro de los próximos 5 días hábiles
- **THEN** esa acción correctiva NO aparece en `accionesCorrectivasPorVencer`
