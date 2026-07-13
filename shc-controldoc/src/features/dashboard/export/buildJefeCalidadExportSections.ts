import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { JefeCalidadDashboardData } from '../types/dashboardData.types'
import type { AccionRequerida } from '../types/accionesRequeridas.types'
import type { QEStatus } from '../../quality-events/types/qualityEvent.types'
import { formatFecha, formatKpiMeta, formatKpiValor } from './dashboardExport.utils'
import type { DashboardExportI18n, DashboardExportSection, HeatmapPorLocalEntry } from './dashboardExport.types'

const QE_STATUSES: QEStatus[] = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADO',
  'EN_VERIFICACION',
  'VERIFICADO',
  'REABIERTO',
]

function buildAccionesRequeridasSection(
  accionesRequeridas: AccionRequerida[],
  i18n: DashboardExportI18n,
): DashboardExportSection {
  return {
    id: 'accionesRequeridas',
    titulo: i18n.t('dashboard:accionesRequeridas.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.accionesRequeridas.headers.codigo'),
      i18n.t('dashboard:export.sections.accionesRequeridas.headers.tipo'),
      i18n.t('dashboard:export.sections.accionesRequeridas.headers.dominio'),
      i18n.t('dashboard:export.sections.accionesRequeridas.headers.prioridad'),
      i18n.t('dashboard:export.sections.accionesRequeridas.headers.fechaLimite'),
    ],
    rows: accionesRequeridas.map((item) => [
      item.codigo,
      i18n.t(`dashboard:accionesRequeridas.tipo.${item.tipo}`),
      i18n.t(`dashboard:accionesRequeridas.dominio.${item.dominio}`),
      item.prioridad,
      formatFecha(item.fechaLimite, i18n),
    ]),
    empty: accionesRequeridas.length === 0,
  }
}

function buildKpisSection(kpis: JefeCalidadDashboardData['kpis'], i18n: DashboardExportI18n): DashboardExportSection {
  return {
    id: 'kpis',
    titulo: i18n.t('dashboard:jefeCalidad.kpis.title'),
    kind: 'kpis',
    headers: [
      i18n.t('dashboard:export.sections.kpis.headers.kpi'),
      i18n.t('dashboard:export.sections.kpis.headers.nombre'),
      i18n.t('dashboard:export.sections.kpis.headers.valor'),
      i18n.t('dashboard:export.sections.kpis.headers.meta'),
      i18n.t('dashboard:export.sections.kpis.headers.semaforo'),
    ],
    rows: kpis.map((kpi) => [
      kpi.kpiId,
      KPI_DEFINITIONS[kpi.kpiId].nombre,
      formatKpiValor(kpi.valor, KPI_DEFINITIONS[kpi.kpiId].unidad),
      formatKpiMeta(kpi),
      kpi.semaforo,
    ]),
    empty: kpis.length === 0,
  }
}

function buildQePorEstadoSection(
  qePorEstado: Record<QEStatus, number>,
  i18n: DashboardExportI18n,
): DashboardExportSection {
  const rows = QE_STATUSES.map((estado) => [
    i18n.t(`dashboard:jefeCalidad.qePorEstado.estados.${estado}`),
    qePorEstado[estado],
  ])
  return {
    id: 'qePorEstado',
    titulo: i18n.t('dashboard:jefeCalidad.qePorEstado.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.qePorEstado.headers.estado'),
      i18n.t('dashboard:export.sections.qePorEstado.headers.cantidad'),
    ],
    rows,
    empty: rows.length === 0,
  }
}

function buildAcsPorVencerSection(
  acs: JefeCalidadDashboardData['accionesCorrectivasPorVencer'],
  i18n: DashboardExportI18n,
): DashboardExportSection {
  return {
    id: 'acsPorVencer',
    titulo: i18n.t('dashboard:jefeCalidad.acsPorVencer.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.acsPorVencer.headers.descripcion'),
      i18n.t('dashboard:export.sections.acsPorVencer.headers.origen'),
      i18n.t('dashboard:export.sections.acsPorVencer.headers.responsable'),
      i18n.t('dashboard:export.sections.acsPorVencer.headers.plazo'),
      i18n.t('dashboard:export.sections.acsPorVencer.headers.estado'),
    ],
    rows: acs.map((ac) => [
      ac.descripcion,
      i18n.t(`dashboard:operario.misACs.origen.${ac.origenTipo}`),
      ac.responsableNombre,
      formatFecha(ac.plazoFecha, i18n),
      ac.estado,
    ]),
    empty: acs.length === 0,
  }
}

function buildTendenciaMensualSection(
  data: JefeCalidadDashboardData,
  i18n: DashboardExportI18n,
): DashboardExportSection {
  const { tendenciaMensualVolumen, tendenciaMensualKpis } = data
  const kpi01 = tendenciaMensualKpis['KPI-01']
  const kpi04 = tendenciaMensualKpis['KPI-04']
  const kpi05 = tendenciaMensualKpis['KPI-05']

  const rows = tendenciaMensualVolumen.map((entry, i) => [
    entry.periodo,
    entry.abiertos,
    entry.cerrados,
    kpi01[i]?.valor ?? 0,
    kpi04[i]?.valor ?? 0,
    kpi05[i]?.valor ?? 0,
  ])

  return {
    id: 'tendenciaMensual',
    titulo: i18n.t('dashboard:jefeCalidad.tendencia.title'),
    kind: 'grafico-tendencia',
    headers: [
      i18n.t('dashboard:export.sections.tendencia.headers.periodo'),
      i18n.t('dashboard:export.sections.tendencia.headers.abiertos'),
      i18n.t('dashboard:export.sections.tendencia.headers.cerrados'),
      i18n.t('dashboard:export.sections.tendencia.headers.kpi01'),
      i18n.t('dashboard:export.sections.tendencia.headers.kpi04'),
      i18n.t('dashboard:export.sections.tendencia.headers.kpi05'),
    ],
    rows,
    empty: rows.length === 0,
  }
}

export function buildHeatmapSection(
  heatmapPorLocal: HeatmapPorLocalEntry[],
  i18n: DashboardExportI18n,
): DashboardExportSection {
  return {
    id: 'heatmap',
    titulo: i18n.t('dashboard:heatmapIncidentes.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.heatmap.headers.local'),
      i18n.t('dashboard:export.sections.heatmap.headers.incidentes'),
    ],
    rows: heatmapPorLocal.map((entry) => [entry.local, entry.conteo]),
    empty: heatmapPorLocal.every((entry) => entry.conteo === 0),
  }
}

export function buildJefeCalidadExportSections(
  data: JefeCalidadDashboardData,
  accionesRequeridas: AccionRequerida[],
  heatmapPorLocal: HeatmapPorLocalEntry[],
  i18n: DashboardExportI18n,
): DashboardExportSection[] {
  return [
    buildAccionesRequeridasSection(accionesRequeridas, i18n),
    buildKpisSection(data.kpis, i18n),
    buildQePorEstadoSection(data.qePorEstado, i18n),
    buildAcsPorVencerSection(data.accionesCorrectivasPorVencer, i18n),
    buildTendenciaMensualSection(data, i18n),
    buildHeatmapSection(heatmapPorLocal, i18n),
  ]
}
