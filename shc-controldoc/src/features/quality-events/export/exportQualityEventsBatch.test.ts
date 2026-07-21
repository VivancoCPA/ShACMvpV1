import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import { exportQualityEventsBatch, buildBatchExportFilename } from './exportQualityEventsBatch'
import type { QualityEvent } from '../types/qualityEvent.types'

function makeQE(id: string, numero: string): QualityEvent {
  return {
    id,
    numero,
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'MEDIA',
    estado: 'ABIERTO',
    ciclo: 1,
    descripcion: 'Descripción',
    areaId: 'area-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-06-01T07:00:00Z',
    fechaHoraReporte: '2026-06-01T08:00:00Z',
    reportadoPorId: 'user-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-06-01T08:00:00Z',
    actualizadoEn: '2026-06-01T08:00:00Z',
  }
}

const callOrder: string[] = []
const exportQualityEventPdfMock = vi.fn(async (id: string) => {
  callOrder.push(`export-start:${id}`)
  const qe = makeQE(id, `QE-2026-${id}`)
  callOrder.push(`export-end:${id}`)
  return qe
})

vi.mock('../api/quality-events.api', () => ({
  exportQualityEventPdf: (id: string) => exportQualityEventPdfMock(id),
}))

beforeEach(() => {
  callOrder.length = 0
  exportQualityEventPdfMock.mockClear()
})

describe('exportQualityEventsBatch', () => {
  it('produces a zip with one correctly-named PDF per selected QE', async () => {
    const blob = await exportQualityEventsBatch(['001', '002', '003'], 'Ana Torres')
    const zip = await JSZip.loadAsync(blob)
    const names = Object.keys(zip.files).sort()
    expect(names).toEqual(['QE-2026-001.pdf', 'QE-2026-002.pdf', 'QE-2026-003.pdf'])
  })

  it('processes QEs sequentially, not concurrently', async () => {
    await exportQualityEventsBatch(['001', '002'], 'Ana Torres')
    expect(callOrder).toEqual([
      'export-start:001',
      'export-end:001',
      'export-start:002',
      'export-end:002',
    ])
  })

  it('reports progress after each QE completes', async () => {
    const onProgress = vi.fn()
    await exportQualityEventsBatch(['001', '002', '003'], 'Ana Torres', onProgress)
    expect(onProgress).toHaveBeenNthCalledWith(1, { completed: 1, total: 3 })
    expect(onProgress).toHaveBeenNthCalledWith(2, { completed: 2, total: 3 })
    expect(onProgress).toHaveBeenNthCalledWith(3, { completed: 3, total: 3 })
  })
})

describe('buildBatchExportFilename', () => {
  it('formats as quality-events-export-<YYYYMMDD-HHmm>.zip', () => {
    const date = new Date(2026, 6, 18, 9, 5)
    expect(buildBatchExportFilename(date)).toBe('quality-events-export-20260718-0905.zip')
  })
})
