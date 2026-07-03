import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QEStatusTransitionPanel } from './QEStatusTransitionPanel'
import type { QualityEvent } from '../types/qualityEvent.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const transitionMutate = vi.fn()

vi.mock('../hooks/useTransitionQEStatus', () => ({
  useTransitionQEStatus: () => ({ mutate: transitionMutate, isPending: false }),
}))

function buildQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-2026-001',
    numero: 'QE-2026-001',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'ALTA',
    estado: 'ANALISIS_COMPLETADO',
    ciclo: 1,
    descripcion: 'Descripción del evento',
    areaAfectada: 'Almacén Norte',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T00:00:00Z',
    fechaHoraReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('QEStatusTransitionPanel — RN-QE-002 / RN-QE-003 guards', () => {
  it('disables the EN_EJECUCION button when causaRaizFirmadaEn is absent (RN-QE-002)', () => {
    const qe = buildQE({ estado: 'ANALISIS_COMPLETADO', causaRaizFirmadaEn: undefined })
    render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" />)

    const button = screen.getByText('En ejecución').closest('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'detail.transitions.rnQe002Tooltip')
  })

  it('enables the EN_EJECUCION button once causaRaizFirmadaEn is set', () => {
    const qe = buildQE({ estado: 'ANALISIS_COMPLETADO', causaRaizFirmadaEn: '2026-01-05T10:00:00Z' })
    render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" />)

    const button = screen.getByText('En ejecución').closest('button')
    expect(button).not.toBeDisabled()
  })

  it('renders the CERRADO button disabled with the RN-QE-003 tooltip when ACs are still open', () => {
    const qe = buildQE({
      estado: 'PENDIENTE_CIERRE',
      accionesCorrectivas: [
        {
          id: 'ac-1',
          qeId: 'qe-2026-001',
          descripcion: 'AC abierta',
          responsableId: 'user-003',
          responsableNombre: 'María Castro',
          plazoFecha: '2026-08-01',
          estado: 'EN_EJECUCION',
          creadoEn: '2026-01-01T00:00:00Z',
          actualizadoEn: '2026-01-01T00:00:00Z',
        },
      ],
    })
    render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" />)

    const button = screen.getByText('detail.transitions.disponibleEnCierre').closest('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'detail.transitions.rnQe003Tooltip')
  })

  it('renders the CERRADO button always disabled, even with all ACs closed (pending M4-S06)', () => {
    const qe = buildQE({
      estado: 'PENDIENTE_CIERRE',
      accionesCorrectivas: [
        {
          id: 'ac-1',
          qeId: 'qe-2026-001',
          descripcion: 'AC cerrada',
          responsableId: 'user-003',
          responsableNombre: 'María Castro',
          plazoFecha: '2026-08-01',
          estado: 'CERRADA',
          descripcionEvidencia: 'Evidencia',
          creadoEn: '2026-01-01T00:00:00Z',
          actualizadoEn: '2026-01-01T00:00:00Z',
        },
      ],
    })
    render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" />)

    const button = screen.getByText('detail.transitions.disponibleEnCierre').closest('button')
    expect(button).toBeDisabled()
  })
})
