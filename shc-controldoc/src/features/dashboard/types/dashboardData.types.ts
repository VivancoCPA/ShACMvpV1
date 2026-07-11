import type { KpiResult } from './kpi.types'
import type { QEStatus, QEType } from '../../quality-events/types/qualityEvent.types'
import type {
  QEResumen,
  IncidenteResumen,
  NCResumen,
  DocumentoResumen,
  AccionCorrectivaResumen,
  QEReaperturaResumen,
  ACSolicitudAjustePlazoResumen,
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

export interface TendenciaMensualVolumenEntry {
  periodo: string
  abiertos: number
  cerrados: number
}

export interface TendenciaMensualKpiEntry {
  periodo: string
  valor: number
}

export interface JefeCalidadDashboardData {
  kpis: KpiResult[]
  qeCriticosAbiertos: QEResumen[]
  ncPendientesVerificacion: NCResumen[]
  distribucionQEPorTipo: Record<QEType, number>
  qePorEstado: Record<QEStatus, number>
  accionesCorrectivasPorVencer: AccionCorrectivaResumen[]
  tendenciaMensualVolumen: TendenciaMensualVolumenEntry[]
  tendenciaMensualKpis: Record<'KPI-01' | 'KPI-04' | 'KPI-05', TendenciaMensualKpiEntry[]>
}

export interface AltaDireccionDashboardData {
  kpisEstrategicos: KpiResult[]
  resumenPorModulo: {
    documentos: { total: number; publicados: number; vencidosRevision: number }
    noConformidades: { total: number; abiertas: number; cerradas: number }
    incidentes: { total: number; conLesionados: number }
    qualityEvents: { total: number; criticosAbiertos: number; abiertos: number; vencidos: number }
  }
  alertasCriticas: QEResumen[]
  tendenciaTrimestral: { periodo: string; qeCerrados: number; ncCerradas: number }[]
  comparativaMensual: Record<
    'KPI-01' | 'KPI-04' | 'KPI-05',
    { actual: number; anterior: number; tendencia: 'SUBE' | 'BAJA' | 'ESTABLE' }
  >
  reaperturas: QEReaperturaResumen[]
  acsConSolicitudAjustePlazo: ACSolicitudAjustePlazoResumen[]
}

export interface AuditorDashboardData {
  hallazgosPorArea: { area: string; total: number }[]
  hallazgosPorEstado: Record<QEStatus, number>
  evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }
  tasaCierreEnPlazoPorArea: { area: string; tasaCierreEnPlazo: number; totalCerrados: number }[]
}

export type JefeControlDocDashboardData = Record<string, never>

export type DashboardSummaryData =
  | { rol: 'OPERARIO'; data: OperarioDashboardData }
  | { rol: 'SUPERVISOR'; data: SupervisorDashboardData }
  | { rol: 'JEFE_CALIDAD'; data: JefeCalidadDashboardData }
  | { rol: 'ALTA_DIRECCION'; data: AltaDireccionDashboardData }
  | { rol: 'AUDITOR'; data: AuditorDashboardData }
  | { rol: 'JEFE_CONTROL_DOC'; data: JefeControlDocDashboardData }
