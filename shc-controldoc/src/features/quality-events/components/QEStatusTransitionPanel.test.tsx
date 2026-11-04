import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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
    areaId: 'Almacén Norte',
    empresaId: 'empresa-001',
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
    render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" usuarioId="user-001" />)

    const button = screen.getByText('En ejecución').closest('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'detail.transitions.rnQe002Tooltip')
  })

  it('enables the EN_EJECUCION button once causaRaizFirmadaEn is set', () => {
    const qe = buildQE({ estado: 'ANALISIS_COMPLETADO', causaRaizFirmadaEn: '2026-01-05T10:00:00Z' })
    render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" usuarioId="user-001" />)

    const button = screen.getByText('En ejecución').closest('button')
    expect(button).not.toBeDisabled()
  })

  it('renders no CERRADO button, even as a disabled stub', () => {
    const qe = buildQE({ estado: 'PENDIENTE_CIERRE' })
    const { container } = render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" usuarioId="user-001" />)

    expect(screen.queryByText('detail.transitions.disponibleEnCierre')).not.toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders no EN_VERIFICACION button from CERRADO', () => {
    const qe = buildQE({ estado: 'CERRADO' })
    const { container } = render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" usuarioId="user-001" />)

    expect(container.querySelector('button')).toBeNull()
  })

  it('renders no VERIFICADO or REABIERTO buttons from EN_VERIFICACION', () => {
    const qe = buildQE({ estado: 'EN_VERIFICACION' })
    const { container: containerJefe } = render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" usuarioId="user-001" />)
    expect(containerJefe.querySelector('button')).toBeNull()

    cleanup()

    const { container: containerAuditor } = render(<QEStatusTransitionPanel qe={qe} rol="AUDITOR_INTERNO" usuarioId="user-001" />)
    expect(containerAuditor.querySelector('button')).toBeNull()
  })
})

// qe-precarga-incidente-responsable — ABIERTO → EN_INVESTIGACION exige responsable.
vi.mock('./QEAsignarResponsableModal', () => ({
  QEAsignarResponsableModal: () => <div data-testid="asignar-responsable-modal" />,
}))

describe('QEStatusTransitionPanel — responsable de investigación', () => {
  it('deshabilita EN_INVESTIGACION sin responsable y ofrece asignarlo al JCA', () => {
    const qe = buildQE({ estado: 'ABIERTO' })
    render(<QEStatusTransitionPanel qe={qe} rol="JEFE_CALIDAD_SYST" usuarioId="user-001" />)

    const button = screen.getByText('En investigación').closest('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'errors.QE_SIN_RESPONSABLE')
    fireEvent.click(screen.getByRole('button', { name: 'detail.responsable.asignarPrimero' }))
    expect(screen.getByTestId('asignar-responsable-modal')).toBeInTheDocument()
  })

  it('un SUPERVISOR ve el botón deshabilitado pero no el enlace para asignar', () => {
    const qe = buildQE({ estado: 'ABIERTO' })
    render(<QEStatusTransitionPanel qe={qe} rol="SUPERVISOR" usuarioId="user-001" />)

    expect(screen.getByText('En investigación').closest('button')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'detail.responsable.asignarPrimero' })).not.toBeInTheDocument()
  })

  it('habilita EN_INVESTIGACION con responsable asignado', () => {
    const qe = buildQE({ estado: 'ABIERTO', responsableInvestigacionId: 'user-sup-001' })
    render(<QEStatusTransitionPanel qe={qe} rol="SUPERVISOR" usuarioId="user-001" />)

    expect(screen.getByText('En investigación').closest('button')).not.toBeDisabled()
  })
})
