import { describe, expect, it } from 'vitest'
import { buildJefeCalidadExportSections } from './buildJefeCalidadExportSections'
import type { JefeCalidadDashboardData } from '../types/dashboardData.types'
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

const KPI_IDS: KpiId[] = ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04', 'KPI-05', 'KPI-06', 'KPI-07', 'KPI-08', 'KPI-09']

const baseData: JefeCalidadDashboardData = {
  kpis: KPI_IDS.map(makeKpi),
  qeCriticosAbiertos: [],
  ncPendientesVerificacion: [],
  distribucionQEPorTipo: { CALIDAD: 0, SST: 0, ADUANERO: 0, OPERACIONAL: 0 },
  qePorEstado: {
    ABIERTO: 1,
    EN_INVESTIGACION: 0,
    ANALISIS_COMPLETADO: 0,
    EN_EJECUCION: 0,
    PENDIENTE_CIERRE: 0,
    CERRADO: 0,
    EN_VERIFICACION: 0,
    VERIFICADO: 0,
    REABIERTO: 0,
  },
  accionesCorrectivasPorVencer: [],
  tendenciaMensualVolumen: [
    { periodo: '2026-05', abiertos: 3, cerrados: 2 },
    { periodo: '2026-06', abiertos: 4, cerrados: 3 },
  ],
  tendenciaMensualKpis: {
    'KPI-01': [
      { periodo: '2026-05', valor: 88 },
      { periodo: '2026-06', valor: 90 },
    ],
    'KPI-04': [
      { periodo: '2026-05', valor: 5 },
      { periodo: '2026-06', valor: 4 },
    ],
    'KPI-05': [
      { periodo: '2026-05', valor: 80 },
      { periodo: '2026-06', valor: 85 },
    ],
  },
}

const accionesRequeridas: AccionRequerida[] = [
  {
    id: 'ar-1',
    dominio: 'QE',
    tipo: 'QE_CAUSA_RAIZ',
    codigo: 'QE-2026-001',
    descripcion: 'Definir causa raíz',
    fechaLimite: '2026-07-15T00:00:00Z',
    prioridad: 'alta',
    ruta: '/quality-events/qe-1',
  },
]

const heatmapPorLocal: HeatmapPorLocalEntry[] = [
  { local: 'Almacén Principal', conteo: 3 },
  { local: 'Patio de Minerales', conteo: 0 },
]

describe('buildJefeCalidadExportSections', () => {
  it('produce las 6 secciones en el orden real de montaje del dashboard', () => {
    const sections = buildJefeCalidadExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.map((s) => s.id)).toEqual([
      'accionesRequeridas',
      'kpis',
      'qePorEstado',
      'acsPorVencer',
      'tendenciaMensual',
      'heatmap',
    ])
  })

  it('marca kpis como kind "kpis" y tendenciaMensual como "grafico-tendencia"', () => {
    const sections = buildJefeCalidadExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.find((s) => s.id === 'kpis')?.kind).toBe('kpis')
    expect(sections.find((s) => s.id === 'tendenciaMensual')?.kind).toBe('grafico-tendencia')
  })

  it('deriva empty=true cuando el array fuente de una sección está vacío', () => {
    const sections = buildJefeCalidadExportSections(
      { ...baseData, accionesCorrectivasPorVencer: [] },
      [],
      heatmapPorLocal,
      i18n,
    )
    expect(sections.find((s) => s.id === 'accionesRequeridas')?.empty).toBe(true)
    expect(sections.find((s) => s.id === 'acsPorVencer')?.empty).toBe(true)
  })

  it('deriva empty=false cuando hay filas', () => {
    const sections = buildJefeCalidadExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.find((s) => s.id === 'accionesRequeridas')?.empty).toBe(false)
    expect(sections.find((s) => s.id === 'kpis')?.rows).toHaveLength(9)
  })

  it('el heatmap se marca vacío cuando todos los conteos son 0', () => {
    const sections = buildJefeCalidadExportSections(
      baseData,
      accionesRequeridas,
      [{ local: 'Almacén Principal', conteo: 0 }],
      i18n,
    )
    expect(sections.find((s) => s.id === 'heatmap')?.empty).toBe(true)
  })

  it('la tendencia mensual mapea la serie histórica completa, sin recortar por rango', () => {
    const sections = buildJefeCalidadExportSections(baseData, accionesRequeridas, heatmapPorLocal, i18n)
    expect(sections.find((s) => s.id === 'tendenciaMensual')?.rows).toHaveLength(2)
  })
})
