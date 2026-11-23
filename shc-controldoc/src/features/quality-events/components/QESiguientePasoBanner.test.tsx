import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useAuthStore } from '../../../stores/authStore'
import { QESiguientePasoBanner } from './QESiguientePasoBanner'
import type { QESiguientePaso, QualityEvent, ResponsablePasoQE } from '../types/qualityEvent.types'

// Con opciones, la clave se acompaña de sus valores interpolados para poder afirmar sobre ellos.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${Object.values(opts).join(' | ')}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

const DIA = 24 * 60 * 60 * 1000

const resp = (id: string, nombreCompleto: string): ResponsablePasoQE => ({ id, nombreCompleto, rol: 'JEFE_CALIDAD_SYST' })

function makeQE(siguientePaso: Partial<QESiguientePaso>): QualityEvent {
  return {
    id: 'qe-001',
    numero: 'QE-2026-006',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'CALIDAD',
    severidad: 'MEDIA',
    estado: 'PENDIENTE_CIERRE',
    ciclo: 1,
    descripcion: 'Evento',
    areaId: 'area-001',
    empresaId: 'empresa-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T08:00:00.000Z',
    fechaHoraReporte: '2026-01-01T08:00:00.000Z',
    reportadoPorId: 'user-reportante',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    siguientePaso: {
      paso: 'REGISTRAR_RESULTADO_CIERRE',
      responsables: [resp('user-jca', 'Ana Pérez')],
      estadoDesde: new Date(Date.now() - 3 * DIA).toISOString(),
      plazoFecha: new Date(Date.now() + 14 * DIA).toISOString(),
      plazoRegla: 'PRD §1.3 · 5 días hábiles',
      ...siguientePaso,
    },
  }
}

function setUser(id: string) {
  useAuthStore.setState({
    user: {
      id,
      nombre: 'Usuario',
      apellido: 'Actual',
      email: 'u@shac.pe',
      rol: 'SUPERVISOR',
      createdAt: '2026-01-01T00:00:00.000Z',
      activo: true,
    },
  })
}

describe('QESiguientePasoBanner', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null })
  })

  it('shows the step, the owner, since when and the due date in green', () => {
    setUser('user-otro')
    render(<QESiguientePasoBanner qe={makeQE({})} />)

    expect(screen.getByText('detail.siguientePaso.paso.REGISTRAR_RESULTADO_CIERRE')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText(/detail\.siguientePaso\.desde .* \| 3/)).toBeInTheDocument()
    const plazo = screen.getByText(/detail\.siguientePaso\.plazo/)
    expect(plazo).toHaveAttribute('data-semaforo', 'verde')
    expect(plazo).toHaveAttribute('title', 'PRD §1.3 · 5 días hábiles')
    expect(screen.queryByText('detail.siguientePaso.teToca')).not.toBeInTheDocument()
  })

  it('highlights "your turn" when the current user is an owner', () => {
    setUser('user-jca')
    render(<QESiguientePasoBanner qe={makeQE({})} />)

    expect(screen.getByText('detail.siguientePaso.teToca')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveClass('border-coral')
  })

  it('shows 3 owners and "+N" for the rest', () => {
    setUser('user-otro')
    const responsables = ['A Uno', 'B Dos', 'C Tres', 'D Cuatro', 'E Cinco'].map((n, i) => resp(`u-${i}`, n))
    render(<QESiguientePasoBanner qe={makeQE({ responsables })} />)

    expect(screen.getByText('C Tres')).toBeInTheDocument()
    expect(screen.queryByText('D Cuatro')).not.toBeInTheDocument()
    expect(screen.getByText('detail.siguientePaso.masResponsables 2')).toBeInTheDocument()
  })

  it('shows "no owner available" when the list is empty', () => {
    setUser('user-otro')
    render(<QESiguientePasoBanner qe={makeQE({ paso: 'FIRMA_SUPERVISOR', responsables: [] })} />)

    expect(screen.getByText('detail.siguientePaso.sinResponsable')).toBeInTheDocument()
  })

  it('shows an overdue due date in red', () => {
    setUser('user-otro')
    render(<QESiguientePasoBanner qe={makeQE({ plazoFecha: new Date(Date.now() - DIA).toISOString() })} />)

    expect(screen.getByText(/detail\.siguientePaso\.plazo/)).toHaveAttribute('data-semaforo', 'rojo')
  })

  it('shows the AC progress in EJECUTAR_ACS', () => {
    setUser('user-otro')
    render(<QESiguientePasoBanner qe={makeQE({ paso: 'EJECUTAR_ACS', progreso: 1, total: 3 })} />)

    expect(screen.getByText(/detail\.siguientePaso\.progresoAC 1 \| 3/)).toBeInTheDocument()
  })

  it('shows the neutral completed banner for FINALIZADO', () => {
    setUser('user-otro')
    render(<QESiguientePasoBanner qe={makeQE({ paso: 'FINALIZADO', responsables: [], plazoFecha: null })} />)

    expect(screen.getByText(/detail\.siguientePaso\.finalizado/)).toBeInTheDocument()
    expect(screen.queryByText(/detail\.siguientePaso\.responsable/)).not.toBeInTheDocument()
  })

  it('renders nothing without siguientePaso', () => {
    setUser('user-otro')
    const { container } = render(<QESiguientePasoBanner qe={{ ...makeQE({}), siguientePaso: null }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
