import type { KpiResult } from './kpi.types'
import type { QEStatus, QEType } from '../../quality-events/types/qualityEvent.types'
import type {
  QEResumen,
  IncidenteResumen,
  NCResumen,
  DocumentoResumen,
  AccionCorrectivaResumen,
} from './dashboardSummary.types'

export interface OperarioDashboardData {
  misIncidentesReportados: IncidenteResumen[]
  misQEReportados: QEResumen[]
  accionesCorrectivasAsignadas: AccionCorrectivaResumen[]
  documentosPendientesLectura: DocumentoResumen[]
}

export interface SupervisorDashboardData {
  kpisArea: KpiResult[]
  qePorEstado: Record<QEStatus, number>
  qeAbiertosPorTipo: Record<QEType, number>
  qesEnVerificacionArea: QEResumen[]
  accionesCorrectivasPendientesArea: AccionCorrectivaResumen[]
  accionesCorrectivasVencidas: AccionCorrectivaResumen[]
  incidentesRecientes: IncidenteResumen[]
  semaforoPlazos: { verde: number; amarillo: number; rojo: number }
}

export interface JefeCalidadDashboardData {
  kpis: KpiResult[]
  qeCriticosAbiertos: QEResumen[]
  ncPendientesVerificacion: NCResumen[]
  distribucionQEPorTipo: Record<QEType, number>
  qePorEstado: Record<QEStatus, number>
  accionesCorrectivasPorVencer: AccionCorrectivaResumen[]
  tendenciaMensualCierres: { periodo: string; cerrados: number }[]
}

export interface AltaDireccionDashboardData {
  kpisEstrategicos: KpiResult[]
  resumenPorModulo: {
    documentos: { total: number; publicados: number; vencidosRevision: number }
    noConformidades: { total: number; abiertas: number; cerradas: number }
    incidentes: { total: number; conLesionados: number }
    qualityEvents: { total: number; criticosAbiertos: number }
  }
  alertasCriticas: QEResumen[]
  tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]
}

export interface AuditorDashboardData {
  hallazgosAuditoriaAbiertos: QEResumen[]
  ncPorOrigenAuditoria: NCResumen[]
  kpisCumplimiento: KpiResult[]
  documentosProximaRevision: DocumentoResumen[]
}

export type DashboardSummaryData =
  | { rol: 'OPERARIO'; data: OperarioDashboardData }
  | { rol: 'SUPERVISOR'; data: SupervisorDashboardData }
  | { rol: 'JEFE_CALIDAD'; data: JefeCalidadDashboardData }
  | { rol: 'ALTA_DIRECCION'; data: AltaDireccionDashboardData }
  | { rol: 'AUDITOR'; data: AuditorDashboardData }
