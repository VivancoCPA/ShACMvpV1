import type { ComponentProps } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { IncidentACSection } from './IncidentACSection'
import type { AccionCorrectivaIncidente } from '../types/incident.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

const baseAC: AccionCorrectivaIncidente = {
  id: 'ac-1',
  incidenteId: 'inc-1',
  descripcion: 'Reforzar EPP en almacén',
  responsableId: 'user-1',
  responsableNombre: 'María Castro',
  plazoFecha: '2026-08-01',
  estado: 'PENDIENTE',
  creadoEn: '2026-01-01T00:00:00Z',
  actualizadoEn: '2026-01-01T00:00:00Z',
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

describe('IncidentACSection — modo solo lectura cuando el incidente tiene QE vinculado', () => {
  it('renders the info message and no Crear QE link when there is no linked QE', () => {
    renderSection({ qeId: undefined })

    expect(screen.queryByText('acSection.actions.crearQE')).not.toBeInTheDocument()
    expect(screen.getByText('acSection.qeRequerido')).toBeInTheDocument()
  })

  it('hides Crear QE link and transition buttons when qeId is set', () => {
    renderSection({ qeId: 'qe-2026-001' })

    expect(screen.queryByText('acSection.actions.crearQE')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.qeRequerido')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.iniciar')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.cerrar')).not.toBeInTheDocument()
  })

  it('renders a Ver QE link in the header when qeId is set', () => {
    renderSection({ qeId: 'qe-2026-001' })

    const link = screen.getByText('acSection.actions.verQE').closest('a')
    expect(link).toHaveAttribute('href', '/quality-events/qe-2026-001')
  })

  it('does not render the Ver QE link when qeId is not set', () => {
    renderSection({ qeId: undefined })

    expect(screen.queryByText('acSection.actions.verQE')).not.toBeInTheDocument()
  })
})

describe('IncidentACSection — Solicitar AC en QE', () => {
  it('shows the button below the list for authorized roles when qeId is set', () => {
    renderSection({ qeId: 'qe-2026-001', canAsignarAC: true })

    expect(screen.getByText('acSection.actions.solicitarQE')).toBeInTheDocument()
  })

  it('hides the button when there is no linked QE', () => {
    renderSection({ qeId: undefined, canAsignarAC: true })

    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
  })

  it('hides the button for unauthorized roles', () => {
    renderSection({ qeId: 'qe-2026-001', canAsignarAC: false })

    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
  })

  it('renders the button in the section header when the AC list is empty', () => {
    renderSection({ qeId: 'qe-2026-001', canAsignarAC: true, accionesCorrectivas: [] })

    const title = screen.getByText('acSection.title')
    const header = title.closest('div')
    expect(header).toContainElement(screen.getByText('acSection.actions.solicitarQE'))
  })

  it('disables the button while the mutation is pending', () => {
    solicitarIsPending = true
    renderSection({ qeId: 'qe-2026-001', canAsignarAC: true })

    expect(screen.getByText('acSection.actions.solicitarQE').closest('button')).toBeDisabled()
    solicitarIsPending = false
  })

  it('replaces the button with a success message after a successful request', () => {
    solicitarMutate.mockImplementation((_qeId, { onSuccess }) => onSuccess())
    renderSection({ qeId: 'qe-2026-001', canAsignarAC: true })

    fireEvent.click(screen.getByText('acSection.actions.solicitarQE'))

    expect(screen.getByText('acSection.actions.solicitudEnviada')).toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
  })
})
