import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QEVerificacionSection } from './QEVerificacionSection'
import { useAuthStore } from '../../../stores/authStore'
import type { QualityEvent } from '../types/qualityEvent.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const forzarVencimientoMutate = vi.fn()
vi.mock('../hooks/useForzarVencimientoVerificacion', () => ({
  useForzarVencimientoVerificacion: () => ({ mutate: forzarVencimientoMutate, isPending: false }),
}))

const verificacionEficaciaMutate = vi.fn()
vi.mock('../hooks/useVerificacionEficacia', () => ({
  useVerificacionEficacia: () => ({ mutate: verificacionEficaciaMutate, isPending: false }),
}))

vi.mock('../../nonconformities/hooks/useUsers', () => ({
  useUsers: () => ({
    data: [
      { id: 'user-004', nombre: 'Ana', apellido: 'Torres', email: 'ana@shac.internal', rol: 'AUDITOR_INTERNO' },
      { id: 'user-006', nombre: 'Pedro', apellido: 'Quispe', email: 'pedro@shac.internal', rol: 'AUDITOR_INTERNO' },
    ],
  }),
}))

function buildQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-2026-001',
    numero: 'QE-2026-001',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'ALTA',
    estado: 'CERRADO',
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('QEVerificacionSection — asignación de auditor al forzar vencimiento (dev-only)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })
  })

  it('disables the forzar-vencimiento button until an auditor is selected', () => {
    const qe = buildQE({ estado: 'CERRADO' })
    render(<QEVerificacionSection qe={qe} />)

    const button = screen.getByText('detail.verificacion.forzarVencimiento').closest('button')
    expect(button).toBeDisabled()

    const select = screen.getByLabelText('detail.verificacion.auditorAsignado.label')
    fireEvent.change(select, { target: { value: 'user-004' } })

    expect(button).not.toBeDisabled()
  })

  it('sends the selected auditorAsignadoId to the mutation', () => {
    const qe = buildQE({ estado: 'CERRADO' })
    render(<QEVerificacionSection qe={qe} />)

    const select = screen.getByLabelText('detail.verificacion.auditorAsignado.label')
    fireEvent.change(select, { target: { value: 'user-006' } })

    const button = screen.getByText('detail.verificacion.forzarVencimiento').closest('button')!
    fireEvent.click(button)

    expect(forzarVencimientoMutate).toHaveBeenCalledWith(
      { id: 'qe-2026-001', auditorAsignadoId: 'user-006' },
      expect.anything(),
    )
  })

  it('does not render the auditor select while EN_VERIFICACION', () => {
    const qe = buildQE({ estado: 'EN_VERIFICACION', auditorAsignadoId: 'user-004' })
    render(<QEVerificacionSection qe={qe} />)

    expect(screen.queryByLabelText('detail.verificacion.auditorAsignado.label')).not.toBeInTheDocument()
  })
})

describe('QEVerificacionSection — esResponsable real en vez de false hardcodeado', () => {
  it('shows the verification form to the assigned AUDITOR_INTERNO', () => {
    useAuthStore.setState({
      user: {
        id: 'user-004',
        nombre: 'Ana',
        apellido: 'Torres',
        email: 'ana@shac.internal',
        rol: 'AUDITOR_INTERNO',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })
    const qe = buildQE({ estado: 'EN_VERIFICACION', auditorAsignadoId: 'user-004' })
    render(<QEVerificacionSection qe={qe} />)

    expect(screen.getByText('detail.verificacion.form.submit')).toBeInTheDocument()
  })

  it('hides the verification form from an AUDITOR_INTERNO who is not the assignee', () => {
    useAuthStore.setState({
      user: {
        id: 'user-006',
        nombre: 'Pedro',
        apellido: 'Quispe',
        email: 'pedro@shac.internal',
        rol: 'AUDITOR_INTERNO',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })
    const qe = buildQE({ estado: 'EN_VERIFICACION', auditorAsignadoId: 'user-004' })
    render(<QEVerificacionSection qe={qe} />)

    expect(screen.queryByText('detail.verificacion.form.submit')).not.toBeInTheDocument()
  })

  it('still shows the verification form to JEFE_CALIDAD_SYST regardless of auditorAsignadoId', () => {
    useAuthStore.setState({
      user: {
        id: 'user-005',
        nombre: 'Luis',
        apellido: 'Paredes',
        email: 'luis@shac.internal',
        rol: 'JEFE_CALIDAD_SYST',
      },
      isAuthenticated: true,
      accessToken: 'token',
    })
    const qe = buildQE({ estado: 'EN_VERIFICACION', auditorAsignadoId: 'user-004' })
    render(<QEVerificacionSection qe={qe} />)

    expect(screen.getByText('detail.verificacion.form.submit')).toBeInTheDocument()
  })
})
