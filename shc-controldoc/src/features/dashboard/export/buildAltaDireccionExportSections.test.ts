import { describe, expect, it } from 'vitest'
import { buildAltaDireccionExportSections } from './buildAltaDireccionExportSections'
import type { AltaDireccionDashboardData } from '../types/dashboardData.types'
import type { AccionRequerida } from '../types/accionesRequeridas.types'
import type { DashboardExportI18n, HeatmapPorLocalEntry } from './dashboardExport.types'
import type { KpiId, KpiResult } from '../types/kpi.types'

const i18n: DashboardExportI18n = {
  t: (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key),
  language: 'es-PE',
}

function makeKpi(kpiId: KpiId): KpiResult {
  return {
    kpiId,
    valor: 90,
    meta: 90,
    metaTipo: 'ABSOLUTO',
    semaforo: 'VERDE',
    periodo: '2026-06',
    calculadoEn: '2026-07-01T00:00:00Z',
  }
}

const baseData: AltaDireccionDashboardData = {
  kpisEstrategicos: (['KPI-01', 'KPI-04', 'KPI-05'] as KpiId[]).map(makeKpi),
  resumenPorModulo: {
    documentos: { total: 10, publicados: 8, vencidosRevision: 1 },
    noConformidades: { total: 5, abiertas: 2, cerradas: 3 },
    incidentes: { total: 4, conLesionados: 0 },
    qualityEvents: { total: 20, criticosAbiertos: 1, abiertos: 6, vencidos: 2 },
  },
  alertasCriticas: [],
  tendenciaTrimestral: [],
  comparativaMensual: {
    'KPI-01': { actual: 92.5, anterior: 91, tendencia: 'ESTABLE' },
    'KPI-04': { actual: 3, anterior: 5, tendencia: 'BAJA' },
    'KPI-05': { actual: 85, anterior: 80, tendencia: 'SUBE' },
  },
  reaperturas: [],
  acsConSolicitudAjustePlazo: [],
}

const accionesRequeridas: AccionRequerida[] = []

const heatmapPorLocal: HeatmapPorLocalEntry[] = [
  { local: 'Almacén Principal', conteo: 2 },
  { local: 'Patio de Minerales', conteo: 1 },
]

describe('buildAltaDireccionExportSections', () => {
  it('produce las 7 secciones en el orden real de montaje del dashboard', () => {
    const sections = buildAltaDireccionExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.map((s) => s.id)).toEqual([
      'accionesRequeridas',
      'kpisEjecutivos',
      'comparativaMensual',
      'qesCriticos',
      'reaperturas',
      'acsExtensionPlazo',
      'heatmap',
    ])
  })

  it('deriva empty=true cuando el array fuente está vacío (QEs Críticos, Reaperturas)', () => {
    const sections = buildAltaDireccionExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.find((s) => s.id === 'qesCriticos')?.empty).toBe(true)
    expect(sections.find((s) => s.id === 'reaperturas')?.empty).toBe(true)
  })

  it('deriva empty=false cuando el array fuente tiene elementos', () => {
    const data: AltaDireccionDashboardData = {
      ...baseData,
      alertasCriticas: [
        {
          id: 'qe-1',
          numero: 'QE-2026-010',
          estado: 'ABIERTO',
          severidad: 'CRITICA',
          tipo: 'CALIDAD',
          origen: 'O1_INCIDENTE_CAMPO',
          areaAfectada: 'Patio',
          fechaHoraReporte: '2026-07-01T00:00:00Z',
        },
      ],
    }
    const sections = buildAltaDireccionExportSections(data, accionesRequeridas, heatmapPorLocal, i18n)
    const qesCriticos = sections.find((s) => s.id === 'qesCriticos')
    expect(qesCriticos?.empty).toBe(false)
    expect(qesCriticos?.rows).toHaveLength(1)
    expect(qesCriticos?.rows[0][0]).toBe('QE-2026-010')
  })

  it('el KPIs ejecutivos incluye QEs abiertos/vencidos + KPI-01/04/05 (5 filas)', () => {
    const sections = buildAltaDireccionExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.find((s) => s.id === 'kpisEjecutivos')?.rows).toHaveLength(5)
  })

  it('el heatmap no se marca vacío cuando hay al menos un conteo positivo', () => {
    const sections = buildAltaDireccionExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.find((s) => s.id === 'heatmap')?.empty).toBe(false)
  })
})
