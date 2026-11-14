import type { KpiResult } from './kpi.types'
import type { QEStatus, QEType, NormaISO } from '../../quality-events/types/qualityEvent.types'
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
  // Todas las AC vencidas (mismo predicado que KPI-08), sin límite (dashboard-alertas-coherentes D4).
  accionesCorrectivasVencidas: AccionCorrectivaResumen[]
  tendenciaMensualVolumen: TendenciaMensualVolumenEntry[]
  // KPI-02/07 alimentan los minigráficos de KpiRingCard (dashboard-layout-4-zonas design.md D6).
  tendenciaMensualKpis: Record<'KPI-01' | 'KPI-04' | 'KPI-05', TendenciaMensualKpiEntry[]> &
    Partial<Record<'KPI-02' | 'KPI-07', TendenciaMensualKpiEntry[]>>
  // RN-INC-006 (incidentes-qe-estado-alertas D8): máximo 10, del más vencido al menos.
  incidentesSinQeVencidos: IncidenteResumen[]
  incidentesSinQeVencidosTotal: number
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
  tendenciaMensualKpis: Record<'KPI-01' | 'KPI-04' | 'KPI-05', TendenciaMensualKpiEntry[]>
}

export interface AuditorDashboardData {
  hallazgosPorNorma: { norma: NormaISO; total: number }[]
  hallazgosPorEstado: Record<QEStatus, number>
  evidenciasHallazgos: { conEvidencia: number; sinEvidencia: number }
  tasaCierreEnPlazoPorArea: { areaId: string; tasaCierreEnPlazo: number; totalCerrados: number }[]
}

// Documentos PUBLICADO con revisión periódica vencida / en los próximos 30 días (RN-DOC-006).
export interface JefeControlDocDashboardData {
  documentosRevisionVencida: number
  documentosRevisionProxima: number
}

export type DashboardSummaryData =
  | { rol: 'OPERARIO'; data: OperarioDashboardData }
  | { rol: 'SUPERVISOR'; data: SupervisorDashboardData }
  | { rol: 'JEFE_CALIDAD'; data: JefeCalidadDashboardData }
  | { rol: 'ALTA_DIRECCION'; data: AltaDireccionDashboardData }
  | { rol: 'AUDITOR'; data: AuditorDashboardData }
  | { rol: 'JEFE_CONTROL_DOC'; data: JefeControlDocDashboardData }
