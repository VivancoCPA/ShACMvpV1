import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QualityEventForm } from './QualityEventForm'
import { useAuthStore } from '../../../stores/authStore'
import type { QualityEvent } from '../types/qualityEvent.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

vi.mock('../../../components/layout/PageWrapper', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../incidents/api/incidents.api', () => ({
  getIncidents: vi.fn().mockResolvedValue({ items: [] }),
}))
vi.mock('../../nonconformities/api/nonconformities.api', () => ({
  getNonconformities: vi.fn().mockResolvedValue({ items: [] }),
}))

const createMutate = vi.fn()
vi.mock('../hooks/useCreateQualityEvent', () => ({
  useCreateQualityEvent: () => ({ mutate: createMutate, isPending: false }),
}))

const editReporteInicialMutate = vi.fn((_vars: unknown, opts?: { onSuccess?: (d: unknown) => void }) => {
  opts?.onSuccess?.({})
})
vi.mock('../hooks/useEditarReporteInicial', () => ({
  useEditarReporteInicial: () => ({ mutate: editReporteInicialMutate, isPending: false }),
}))

const editSeveridadMutate = vi.fn((_vars: unknown, opts?: { onSuccess?: (d: unknown) => void }) => {
  opts?.onSuccess?.({})
})
vi.mock('../hooks/useEditarSeveridad', () => ({
  useEditarSeveridad: () => ({ mutate: editSeveridadMutate, isPending: false }),
}))

let mockQE: QualityEvent | undefined
let mockQELoading = false
vi.mock('../hooks/useQualityEvent', () => ({
  useQualityEvent: () => ({ data: mockQE, isLoading: mockQELoading }),
}))

const baseQE: QualityEvent = {
  id: 'qe-2026-100',
  numero: 'QE-2026-100',
  origen: 'O3_HALLAZGO_AUDITORIA',
  tipo: 'CALIDAD',
  severidad: 'ALTA',
  estado: 'ABIERTO',
  ciclo: 1,
  descripcion: 'Descripción original del evento reportado',
  areaAfectada: 'Almacén Norte',
  turno: 'DIA',
  fechaHoraEvento: '2026-06-01T08:00:00Z',
  fechaHoraReporte: new Date().toISOString(),
  reportadoPorId: 'user-creator',
  hallazgoAuditoriaRef: 'HAL-2026-001',
  mineralInvolucrado: 'Cobre',
  documentosVinculados: [],
  requiereEvaluacionRiesgos: false,
  solicitudesAC: 0,
  accionesCorrectivas: [],
  auditTrail: [],
  creadoEn: '2026-06-01T08:00:00Z',
  actualizadoEn: '2026-06-01T08:00:00Z',
}

function renderEditRoute() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/quality-events/${baseQE.id}/editar`]}>
        <Routes>
          <Route path="/quality-events/:id/editar" element={<QualityEventForm />} />
          <Route path="/quality-events/:id" element={<div data-testid="detail-page">detalle</div>} />
          <Route path="/quality-events" element={<div data-testid="list-page">lista</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('QualityEventForm — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQE = { ...baseQE }
    mockQELoading = false
  })

  afterEach(() => cleanup())

  it('pre-fills the RN-QE-010 field set for an authorized creator', () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'OPERARIO', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderEditRoute()

    expect(screen.getByDisplayValue('Descripción original del evento reportado')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('Almacén Norte')
    expect(screen.getByRole('textbox', { name: /form.fields.hallazgoAuditoriaRef/i })).toHaveValue('HAL-2026-001')
  })

  it('renders protected fields as read-only text with no editable control', () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'OPERARIO', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    const { container } = renderEditRoute()

    expect(screen.getByText('QE-2026-100')).toBeInTheDocument()
    expect(container.querySelector('#origen')).not.toBeInTheDocument()
    expect(container.querySelector('#tipo')).not.toBeInTheDocument()
    expect(container.querySelector('[name="numero"]')).not.toBeInTheDocument()
  })

  it('omits the severidad field for a reporteInicial-only editor', () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'OPERARIO', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    const { container } = renderEditRoute()
    expect(container.querySelector('#severidad')).not.toBeInTheDocument()
  })

  it('renders an editable severidad select for a double-role editor', () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    const { container } = renderEditRoute()
    expect(container.querySelector('#severidad')).toBeInTheDocument()
  })

  it('redirects to the detail page for a user without RN-QE-010 access', () => {
    useAuthStore.setState({
      user: { id: 'user-other', nombre: 'Ajeno', apellido: 'Dos', email: 'a@shac.internal', rol: 'OPERARIO', area: 'Otra Área' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderEditRoute()
    expect(screen.getByTestId('detail-page')).toBeInTheDocument()
  })

  it('submits only the changed field via useEditarReporteInicial, never useCreateQualityEvent', async () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'OPERARIO', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderEditRoute()

    const areaSelect = screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })
    await userEvent.selectOptions(areaSelect, 'Almacén Sur')

    const submitBtn = screen.getByRole('button', { name: 'form.actions.submit' })
    await userEvent.click(submitBtn)

    expect(createMutate).not.toHaveBeenCalled()
    expect(editReporteInicialMutate).toHaveBeenCalledTimes(1)
    const [vars] = editReporteInicialMutate.mock.calls[0] as [{ id: string; data: Record<string, unknown> }]
    expect(vars.id).toBe('qe-2026-100')
    expect(vars.data).toEqual({ areaAfectada: 'Almacén Sur' })
  })

  it('navigates back to the detail page on successful edit submit', async () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'OPERARIO', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderEditRoute()

    const areaSelect = screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })
    await userEvent.selectOptions(areaSelect, 'Almacén Sur')
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
  })
})
