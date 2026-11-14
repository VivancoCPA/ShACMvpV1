import type { ComponentProps } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { IncidentACSection } from './IncidentACSection'
import type { AccionCorrectivaIncidente } from '../types/incident.types'
import type { AccionCorrectivaQE } from '../../quality-events/types/qualityEvent.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: 'es-PE' },
  }),
}))

const updateMutate = vi.fn()
const cerrarMutate = vi.fn()
const solicitarMutate = vi.fn()
let solicitarIsPending = false

vi.mock('../hooks/useIncidents', () => ({
  useUpdateACIncidente: () => ({ mutate: updateMutate, isPending: false }),
  useCerrarACIncidente: () => ({ mutate: cerrarMutate, isPending: false }),
}))

vi.mock('../../quality-events/hooks/useSolicitarACEnQE', () => ({
  useSolicitarACEnQE: () => ({ mutate: solicitarMutate, isPending: solicitarIsPending }),
}))

// solicitudes-ac-y-ac-del-qe-en-origen: con QE vinculado se leen las AC y el contador del QE.
let accionesQE: AccionCorrectivaQE[] = []
let solicitudesAC = 0
vi.mock('../../quality-events/hooks/useQEAcciones', () => ({
  useQEAcciones: () => ({ data: accionesQE, isLoading: false, isError: false }),
}))
vi.mock('../../quality-events/hooks/useQualityEvent', () => ({
  useQualityEvent: () => ({ data: { numero: 'QE-2026-005', solicitudesAC } }),
}))

const baseAC: AccionCorrectivaIncidente = {
  id: 'ac-1',
  incidenteId: 'inc-1',
  descripcion: 'Reforzar EPP en almacén',
  responsableId: 'user-1',
  responsableNombre: 'María Castro',
  tipo: 'CORRECTIVA',
  plazoFecha: '2026-08-01',
  estado: 'PENDIENTE',
  creadoEn: '2026-01-01T00:00:00Z',
  actualizadoEn: '2026-01-01T00:00:00Z',
}

function acQE(overrides: Partial<AccionCorrectivaQE>): AccionCorrectivaQE {
  return {
    id: 'ac-qe-1',
    qeId: 'qe-2026-005',
    descripcion: 'Instalar guarda en el transportador',
    responsableId: 'user-2',
    responsableNombre: 'Luis Paredes',
    tipo: 'CORRECTIVA',
    plazoFecha: '2026-12-01',
    estado: 'EN_EJECUCION',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    solicitudesAjustePlazo: [],
    ...overrides,
  }
}

function renderSection(overrides: Partial<ComponentProps<typeof IncidentACSection>> = {}) {
  return render(
    <MemoryRouter>
      <IncidentACSection
        incidenteId="inc-1"
        incidenteNumero="INC-2026-001"
        accionesCorrectivas={[baseAC]}
        incidenteEstado="EN_INVESTIGACION"
        canAsignarAC
        canCerrarAC
        {...overrides}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  accionesQE = [acQE({}), acQE({ id: 'ac-qe-2', descripcion: 'Capacitar en bloqueo', estado: 'COMPLETADA' })]
  solicitudesAC = 0
})

describe('IncidentACSection — sin QE vinculado', () => {
  it('renders the info message, own ACs with actions and no Ver QE link', () => {
    renderSection({ qeId: undefined })

    expect(screen.getByText('acSection.qeRequerido')).toBeInTheDocument()
    expect(screen.getByText('Reforzar EPP en almacén')).toBeInTheDocument()
    expect(screen.getByText('acSection.actions.iniciar')).toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.verQE')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
  })
})

describe('IncidentACSection — AC del QE vinculado (solicitudes-ac-y-ac-del-qe-en-origen)', () => {
  it('titles the section with the QE number and lists the QE ACs read-only', () => {
    renderSection({ qeId: 'qe-2026-005' })

    expect(screen.getByText(`acSection.delQE:${JSON.stringify({ numero: 'QE-2026-005' })}`)).toBeInTheDocument()
    expect(screen.getByText('Instalar guarda en el transportador')).toBeInTheDocument()
    expect(screen.getByText('Capacitar en bloqueo')).toBeInTheDocument()
    expect(screen.getByText('acEstado.COMPLETADA:{"defaultValue":"COMPLETADA"}')).toBeInTheDocument()
    expect(screen.getAllByText('acTipo.CORRECTIVA').length).toBeGreaterThan(0)
    expect(screen.queryByText('acSection.actions.iniciar')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.cerrar')).not.toBeInTheDocument()
  })

  it('each QE AC row links to the QE AC section', () => {
    renderSection({ qeId: 'qe-2026-005', accionesCorrectivas: [] })

    const links = screen.getAllByText('acReadOnly.verEnQE').map((el) => el.closest('a'))
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/quality-events/qe-2026-005#qe-ac-section')
  })

  it('renders a Ver QE link in the header', () => {
    renderSection({ qeId: 'qe-2026-005' })

    expect(screen.getByText('acSection.actions.verQE').closest('a')).toHaveAttribute('href', '/quality-events/qe-2026-005')
  })

  it('shows the pending requests counter when solicitudesAC > 0', () => {
    solicitudesAC = 1
    renderSection({ qeId: 'qe-2026-005' })

    expect(screen.getByText(`acSection.solicitudesPendientes:${JSON.stringify({ n: 1 })}`)).toBeInTheDocument()
  })

  it('hides the counter when there are no pending requests', () => {
    renderSection({ qeId: 'qe-2026-005' })

    expect(screen.queryByText(/acSection\.solicitudesPendientes/)).not.toBeInTheDocument()
  })

  it('shows own earlier ACs in a collapsed block without actions', () => {
    renderSection({ qeId: 'qe-2026-005' })

    const summary = screen.getByText(/acSection\.anteriores/)
    expect(summary.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText('Reforzar EPP en almacén')).toBeInTheDocument()
  })

  it('omits the earlier block when the incident has no own ACs', () => {
    renderSection({ qeId: 'qe-2026-005', accionesCorrectivas: [] })

    expect(screen.queryByText(/acSection\.anteriores/)).not.toBeInTheDocument()
  })

  it('shows the empty message when the QE has no ACs', () => {
    accionesQE = []
    renderSection({ qeId: 'qe-2026-005', accionesCorrectivas: [] })

    expect(screen.getByText('acSection.qeSinAC')).toBeInTheDocument()
  })
})

describe('IncidentACSection — Solicitar AC en QE', () => {
  it('shows the button below the list for authorized roles when qeId is set', () => {
    renderSection({ qeId: 'qe-2026-005', canAsignarAC: true })

    expect(screen.getByText('acSection.actions.solicitarQE')).toBeInTheDocument()
  })

  it('hides the button for unauthorized roles (read-only OPERARIO view)', () => {
    renderSection({ qeId: 'qe-2026-005', canAsignarAC: false, canCerrarAC: false })

    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('renders the button in the section header when the QE has no ACs', () => {
    accionesQE = []
    renderSection({ qeId: 'qe-2026-005', canAsignarAC: true, accionesCorrectivas: [] })

    const title = screen.getByText(/acSection\.delQE/)
    const header = title.closest('div')
    expect(header).toContainElement(screen.getByText('acSection.actions.solicitarQE'))
  })

  it('disables the button while the mutation is pending', () => {
    solicitarIsPending = true
    renderSection({ qeId: 'qe-2026-005', canAsignarAC: true })

    expect(screen.getByText('acSection.actions.solicitarQE').closest('button')).toBeDisabled()
    solicitarIsPending = false
  })

  it('replaces the button with a success message after a successful request', () => {
    solicitarMutate.mockImplementation((_qeId, { onSuccess }) => onSuccess())
    renderSection({ qeId: 'qe-2026-005', canAsignarAC: true })

    fireEvent.click(screen.getByText('acSection.actions.solicitarQE'))

    expect(screen.getByText('acSection.actions.solicitudEnviada')).toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
  })
})
