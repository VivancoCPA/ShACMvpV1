import { KPI_DEFINITIONS } from '../constants/kpi.constants'
import type { AltaDireccionDashboardData } from '../types/dashboardData.types'
import type { AccionRequerida } from '../types/accionesRequeridas.types'
import { formatFecha, formatKpiValor } from './dashboardExport.utils'
import { buildHeatmapSection } from './buildJefeCalidadExportSections'
import type { DashboardExportI18n, DashboardExportSection, HeatmapPorLocalEntry } from './dashboardExport.types'

const KPI_IDS_EJECUTIVOS = ['KPI-01', 'KPI-04', 'KPI-05'] as const
const COMPARATIVA_KPI_IDS = ['KPI-01', 'KPI-04', 'KPI-05'] as const

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

function buildKpisEjecutivosSection(
  data: AltaDireccionDashboardData,
  i18n: DashboardExportI18n,
): DashboardExportSection {
  const kpisEjecutivos = KPI_IDS_EJECUTIVOS.map((id) => data.kpisEstrategicos.find((k) => k.kpiId === id)).filter(
    (k): k is NonNullable<typeof k> => !!k,
  )

  const rows: (string | number)[][] = [
    [i18n.t('dashboard:altaDireccion.kpisEjecutivos.qesAbiertos'), data.resumenPorModulo.qualityEvents.abiertos],
    [i18n.t('dashboard:altaDireccion.kpisEjecutivos.qesVencidos'), data.resumenPorModulo.qualityEvents.vencidos],
    ...kpisEjecutivos.map((kpi) => [
      `${kpi.kpiId} · ${KPI_DEFINITIONS[kpi.kpiId].nombre}`,
      formatKpiValor(kpi.valor, KPI_DEFINITIONS[kpi.kpiId].unidad),
    ]),
  ]

  return {
    id: 'kpisEjecutivos',
    titulo: i18n.t('dashboard:altaDireccion.kpisEjecutivos.title'),
    kind: 'kpis',
    headers: [
      i18n.t('dashboard:export.sections.kpisEjecutivos.headers.indicador'),
      i18n.t('dashboard:export.sections.kpisEjecutivos.headers.valor'),
    ],
    rows,
    empty: rows.length === 0,
  }
}

function buildComparativaMensualSection(
  comparativaMensual: AltaDireccionDashboardData['comparativaMensual'],
  i18n: DashboardExportI18n,
): DashboardExportSection {
  const rows = COMPARATIVA_KPI_IDS.map((kpiId) => {
    const entry = comparativaMensual[kpiId]
    return [
      kpiId,
      entry.actual.toFixed(1),
      entry.anterior.toFixed(1),
      i18n.t(`dashboard:altaDireccion.comparativaMensual.tendencia.${entry.tendencia}`),
    ]
  })

  return {
    id: 'comparativaMensual',
    titulo: i18n.t('dashboard:altaDireccion.comparativaMensual.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.comparativaMensual.headers.kpi'),
      i18n.t('dashboard:export.sections.comparativaMensual.headers.actual'),
      i18n.t('dashboard:export.sections.comparativaMensual.headers.anterior'),
      i18n.t('dashboard:export.sections.comparativaMensual.headers.tendencia'),
    ],
    rows,
    empty: rows.length === 0,
  }
}

function buildQesCriticosSection(
  alertasCriticas: AltaDireccionDashboardData['alertasCriticas'],
  i18n: DashboardExportI18n,
): DashboardExportSection {
  return {
    id: 'qesCriticos',
    titulo: i18n.t('dashboard:altaDireccion.qesCriticos.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.qesCriticos.headers.numero'),
      i18n.t('dashboard:export.sections.qesCriticos.headers.area'),
      i18n.t('dashboard:export.sections.qesCriticos.headers.estado'),
    ],
    rows: alertasCriticas.map((qe) => [
      qe.numero,
      qe.areaId,
      i18n.t(`dashboard:jefeCalidad.qePorEstado.estados.${qe.estado}`),
    ]),
    empty: alertasCriticas.length === 0,
  }
}

function buildReaperturasSection(
  reaperturas: AltaDireccionDashboardData['reaperturas'],
  i18n: DashboardExportI18n,
): DashboardExportSection {
  return {
    id: 'reaperturas',
    titulo: i18n.t('dashboard:altaDireccion.reaperturas.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.reaperturas.headers.numero'),
      i18n.t('dashboard:export.sections.reaperturas.headers.fechaReapertura'),
      i18n.t('dashboard:export.sections.reaperturas.headers.ciclo'),
    ],
    rows: reaperturas.map((qe) => [qe.numero, formatFecha(qe.fechaReapertura, i18n), qe.ciclo]),
    empty: reaperturas.length === 0,
  }
}

function buildAcsExtensionPlazoSection(
  acs: AltaDireccionDashboardData['acsConSolicitudAjustePlazo'],
  i18n: DashboardExportI18n,
): DashboardExportSection {
  return {
    id: 'acsExtensionPlazo',
    titulo: i18n.t('dashboard:altaDireccion.acsExtensionPlazo.title'),
    kind: 'tabla',
    headers: [
      i18n.t('dashboard:export.sections.acsExtensionPlazo.headers.qe'),
      i18n.t('dashboard:export.sections.acsExtensionPlazo.headers.descripcion'),
      i18n.t('dashboard:export.sections.acsExtensionPlazo.headers.plazoActual'),
    ],
    rows: acs.map((ac) => [ac.qeNumero, ac.acDescripcion, formatFecha(ac.plazoFechaActual, i18n)]),
    empty: acs.length === 0,
  }
}

export function buildAltaDireccionExportSections(
  data: AltaDireccionDashboardData,
  accionesRequeridas: AccionRequerida[],
  heatmapPorLocal: HeatmapPorLocalEntry[],
  i18n: DashboardExportI18n,
): DashboardExportSection[] {
  return [
    buildAccionesRequeridasSection(accionesRequeridas, i18n),
    buildKpisEjecutivosSection(data, i18n),
    buildComparativaMensualSection(data.comparativaMensual, i18n),
    buildQesCriticosSection(data.alertasCriticas, i18n),
    buildReaperturasSection(data.reaperturas, i18n),
    buildAcsExtensionPlazoSection(data.acsConSolicitudAjustePlazo, i18n),
    buildHeatmapSection(heatmapPorLocal, i18n),
  ]
}
