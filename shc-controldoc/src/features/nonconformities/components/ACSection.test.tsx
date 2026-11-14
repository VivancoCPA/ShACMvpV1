import type { ComponentProps } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ACSection } from './ACSection'
import type { AccionCorrectiva } from '../types/nonconformity.types'
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

vi.mock('../hooks/useNonconformities', () => ({
  useUpdateAccionCorrectiva: () => ({ mutate: updateMutate, isPending: false }),
  useCerrarAccionCorrectiva: () => ({ mutate: cerrarMutate, isPending: false }),
}))

vi.mock('../../quality-events/hooks/useSolicitarACEnQE', () => ({
  useSolicitarACEnQE: () => ({ mutate: solicitarMutate, isPending: solicitarIsPending }),
}))

// solicitudes-ac-y-ac-del-qe-en-origen: con QE generado se leen las AC y el contador del QE.
let accionesQE: AccionCorrectivaQE[] = []
vi.mock('../../quality-events/hooks/useQEAcciones', () => ({
  useQEAcciones: () => ({ data: accionesQE, isLoading: false, isError: false }),
}))
vi.mock('../../quality-events/hooks/useQualityEvent', () => ({
  useQualityEvent: () => ({ data: { numero: 'QE-2026-001', solicitudesAC: 1 } }),
}))

const acQE: AccionCorrectivaQE = {
  id: 'ac-qe-1',
  qeId: 'qe-2026-001',
  descripcion: 'Instalar guarda en el transportador',
  responsableId: 'user-2',
  responsableNombre: 'Luis Paredes',
  tipo: 'CORRECTIVA',
  plazoFecha: '2026-12-01',
  estado: 'EN_EJECUCION',
  creadoEn: '2026-01-01T00:00:00Z',
  actualizadoEn: '2026-01-01T00:00:00Z',
  solicitudesAjustePlazo: [],
}

beforeEach(() => {
  accionesQE = [acQE, { ...acQE, id: 'ac-qe-2', descripcion: 'Capacitar en bloqueo', estado: 'CERRADA' }]
})

const baseAC: AccionCorrectiva = {
  id: 'ac-1',
  ncId: 'nc-1',
  descripcion: 'Reforzar EPP en almacén',
  responsableId: 'user-1',
  responsableNombre: 'María Castro',
  tipo: 'CORRECTIVA',
  plazoFecha: '2026-08-01',
  estado: 'PENDIENTE',
  creadoEn: '2026-01-01T00:00:00Z',
  actualizadoEn: '2026-01-01T00:00:00Z',
}

function renderSection(overrides: Partial<ComponentProps<typeof ACSection>> = {}) {
  return render(
    <MemoryRouter>
      <ACSection
        ncId="nc-1"
        ncNumero="NC-CAL-2026-001"
        accionesCorrectivas={[baseAC]}
        ncEstado="EN_INVESTIGACION"
        canAsignarAC
        canCerrarAC
        {...overrides}
      />
    </MemoryRouter>,
  )
}

describe('ACSection — modo solo lectura cuando la NC tiene QE generado', () => {
  it('renders the info message and no Crear QE link when there is no linked QE', () => {
    renderSection({ qeGeneradoId: undefined })

    expect(screen.queryByText('acSection.actions.crearQE')).not.toBeInTheDocument()
    expect(screen.getByText('acSection.qeRequerido')).toBeInTheDocument()
  })

  it('hides Crear QE link and transition buttons when qeGeneradoId is set', () => {
    renderSection({ qeGeneradoId: 'qe-2026-001' })

    expect(screen.queryByText('acSection.actions.crearQE')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.qeRequerido')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.iniciar')).not.toBeInTheDocument()
    expect(screen.queryByText('acSection.actions.cerrar')).not.toBeInTheDocument()
  })

  it('renders a Ver QE link in the header when qeGeneradoId is set', () => {
    renderSection({ qeGeneradoId: 'qe-2026-001' })

    const link = screen.getByText('acSection.actions.verQE').closest('a')
    expect(link).toHaveAttribute('href', '/quality-events/qe-2026-001')
  })

  it('does not render the Ver QE link when qeGeneradoId is not set', () => {
    renderSection({ qeGeneradoId: undefined })

    expect(screen.queryByText('acSection.actions.verQE')).not.toBeInTheDocument()
  })
})

describe('ACSection — Solicitar AC en QE', () => {
  it('shows the button below the list for authorized roles when qeGeneradoId is set', () => {
    renderSection({ qeGeneradoId: 'qe-2026-001', canAsignarAC: true })

    expect(screen.getByText('acSection.actions.solicitarQE')).toBeInTheDocument()
  })

  it('hides the button when there is no linked QE', () => {
    renderSection({ qeGeneradoId: undefined, canAsignarAC: true })

    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
  })

  it('hides the button for unauthorized roles', () => {
    renderSection({ qeGeneradoId: 'qe-2026-001', canAsignarAC: false })

    expect(screen.queryByText('acSection.actions.solicitarQE')).not.toBeInTheDocument()
  })

  it('renders the button in the section header when the QE has no ACs', () => {
    accionesQE = []
    renderSection({ qeGeneradoId: 'qe-2026-001', canAsignarAC: true, accionesCorrectivas: [] })

    const title = screen.getByText(/acSection\.delQE/)
    const header = title.closest('div')
    expect(header).toContainElement(screen.getByText('acSection.actions.solicitarQE'))
  })

  it('disables the button while the mutation is pending', () => {
    solicitarIsPending = true
    renderSection({ qeGeneradoId: 'qe-2026-001', canAsignarAC: true })

    expect(screen.getByText('acSection.actions.solicitarQE').closest('button')).toBeDisabled()
    solicitarIsPending = false
  })
})

describe('ACSection — AC del QE generado (solicitudes-ac-y-ac-del-qe-en-origen)', () => {
  it('lists the QE ACs read-only under the QE number with the pending counter', () => {
    renderSection({ qeGeneradoId: 'qe-2026-001' })

    expect(screen.getByText(`acSection.delQE:${JSON.stringify({ numero: 'QE-2026-001' })}`)).toBeInTheDocument()
    expect(screen.getByText('Instalar guarda en el transportador')).toBeInTheDocument()
    expect(screen.getByText('Capacitar en bloqueo')).toBeInTheDocument()
    expect(screen.getByText(`acSection.solicitudesPendientes:${JSON.stringify({ n: 1 })}`)).toBeInTheDocument()
    expect(screen.getAllByText('acReadOnly.verEnQE')[0].closest('a')).toHaveAttribute(
      'href',
      '/quality-events/qe-2026-001#qe-ac-section',
    )
  })

  it('shows the NC own ACs as earlier ACs', () => {
    renderSection({ qeGeneradoId: 'qe-2026-001' })

    expect(screen.getByText(/acSection\.anteriores/).closest('details')).toBeInTheDocument()
    expect(screen.getByText('Reforzar EPP en almacén')).toBeInTheDocument()
  })

  it('without a generated QE keeps the previous behavior', () => {
    renderSection({ qeGeneradoId: undefined })

    expect(screen.getByText('acSection.title')).toBeInTheDocument()
    expect(screen.getByText('acSection.actions.iniciar')).toBeInTheDocument()
    expect(screen.queryByText(/acSection\.delQE/)).not.toBeInTheDocument()
  })
})
