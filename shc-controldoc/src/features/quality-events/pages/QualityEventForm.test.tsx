import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QualityEventForm } from './QualityEventForm'
import { useAuthStore } from '../../../stores/authStore'
import { getIncidents } from '../../incidents/api/incidents.api'
import { getNonconformities } from '../../nonconformities/api/nonconformities.api'
import type { QualityEvent } from '../types/qualityEvent.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'form.areaDivergeWarning' && opts) {
        return `Esta área difiere de la registrada en ${opts.tipoEtiqueta} ${opts.numero}: ${opts.areaOrigen}.`
      }
      return key
    },
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

describe('QualityEventForm — create mode / RN-QE-013 vinculación query params', () => {
  function renderCreateRoute(search = '') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/quality-events/nuevo${search}`]}>
          <Routes>
            <Route path="/quality-events/nuevo" element={<QualityEventForm />} />
            <Route path="/quality-events/:id" element={<div data-testid="detail-page">detalle</div>} />
            <Route path="/quality-events" element={<div data-testid="list-page">lista</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  async function fillRequiredFields() {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /form.fields.tipo/i }), 'CALIDAD')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /form.fields.severidad/i }), 'MEDIA')
    await userEvent.type(
      screen.getByLabelText(/form.fields.descripcion/i),
      'Descripción de prueba con más de diez caracteres',
    )
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /form.fields.turno/i }), 'DIA')
    const fechaInput = document.getElementById('fechaHoraEvento') as HTMLInputElement
    fireEvent.change(fechaInput, { target: { value: '2026-01-01T08:00' } })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockQE = undefined
    mockQELoading = false
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'SUPERVISOR', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    vi.mocked(getNonconformities).mockResolvedValue({
      items: [
        {
          id: 'nc-014',
          numero: 'NC-2026-014',
          descripcion: 'NC de prueba',
          areaAfectada: 'Almacén Norte',
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(getIncidents).mockResolvedValue({
      items: [
        {
          id: 'inc-003',
          numero: 'INC-2026-003',
          descripcion: 'Incidente de prueba',
          areaId: 'SyST',
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  afterEach(() => cleanup())

  it('prefills origen and ncId from O2 query params', async () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte',
    )

    expect(screen.getByRole('combobox', { name: /form\.fields\.origen\b/i })).toHaveValue('O2_NC_DETECTADA')
    expect(await screen.findByDisplayValue('NC-2026-014')).toBeInTheDocument()
  })

  it('prefills origen and incidenteId from O1 query params', async () => {
    renderCreateRoute(
      '?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST',
    )

    expect(screen.getByRole('combobox', { name: /form\.fields\.origen\b/i })).toHaveValue('O1_INCIDENTE_CAMPO')
    expect(await screen.findByDisplayValue('INC-2026-003')).toBeInTheDocument()
  })

  it('leaves the form with empty defaults when there are no query params', () => {
    renderCreateRoute()

    expect(screen.getByRole('combobox', { name: /form\.fields\.origen\b/i })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('')
  })

  it('ignores an unrecognized origen query param', () => {
    renderCreateRoute('?origen=O3_HALLAZGO_AUDITORIA&ncId=nc-014')

    expect(screen.getByRole('combobox', { name: /form\.fields\.origen\b/i })).toHaveValue('O3_HALLAZGO_AUDITORIA')
    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('')
  })

  it('prefills areaAfectada from the NC origin area with no warning when unchanged', () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte',
    )

    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('Almacén Norte')
    expect(
      screen.queryByText('Esta área difiere de la registrada en la NC NC-2026-014: Almacén Norte.'),
    ).not.toBeInTheDocument()
  })

  it('shows the exact warning when areaAfectada diverges from the NC origin', async () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte',
    )

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form.fields.areaAfectada/i }),
      'Logística',
    )

    expect(
      screen.getByText('Esta área difiere de la registrada en la NC NC-2026-014: Almacén Norte.'),
    ).toBeInTheDocument()
  })

  it('shows the exact warning when areaAfectada diverges from the Incidente origin', async () => {
    renderCreateRoute(
      '?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST',
    )

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form.fields.areaAfectada/i }),
      'Almacén Norte',
    )

    expect(
      screen.getByText('Esta área difiere de la registrada en el Incidente INC-2026-003: SyST.'),
    ).toBeInTheDocument()
  })

  it('does not block submission when the divergence warning is visible', async () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte',
    )

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form.fields.areaAfectada/i }),
      'Logística',
    )
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(createMutate).toHaveBeenCalledTimes(1)
    const [payload] = createMutate.mock.calls[0] as [{ areaAfectada: string }]
    expect(payload.areaAfectada).toBe('Logística')
  })

  it('warning disappears when the user restores the original origin area', async () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=Almac%C3%A9n%20Norte',
    )

    const areaSelect = screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })
    await userEvent.selectOptions(areaSelect, 'Logística')
    expect(
      screen.getByText('Esta área difiere de la registrada en la NC NC-2026-014: Almacén Norte.'),
    ).toBeInTheDocument()

    await userEvent.selectOptions(areaSelect, 'Almacén Norte')
    expect(
      screen.queryByText('Esta área difiere de la registrada en la NC NC-2026-014: Almacén Norte.'),
    ).not.toBeInTheDocument()
  })

  it('has no prefill or warning for O1 selected manually without vinculación query params', async () => {
    renderCreateRoute()

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form\.fields\.origen\b/i }),
      'O1_INCIDENTE_CAMPO',
    )
    const areaSelect = screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })
    expect(areaSelect).toHaveValue('')

    await userEvent.selectOptions(areaSelect, 'SyST')
    expect(screen.queryByText(/Esta área difiere/)).not.toBeInTheDocument()
  })

  it('disables prefill and warning when the origin area query param is missing', async () => {
    renderCreateRoute('?origen=O2_NC_DETECTADA&ncId=nc-099&ncNumero=NC-2025-099')

    const areaSelect = screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })
    expect(areaSelect).toHaveValue('')

    await userEvent.selectOptions(areaSelect, 'Logística')
    expect(screen.queryByText(/Esta área difiere/)).not.toBeInTheDocument()
  })

  it('prefills areaAfectada from an NC selected manually in the origin combobox (no query params)', async () => {
    renderCreateRoute()

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form\.fields\.origen\b/i }),
      'O2_NC_DETECTADA',
    )
    const ncCombobox = await screen.findByRole('combobox', { name: 'form.fields.ncId' })
    await userEvent.click(ncCombobox)
    await userEvent.click(await screen.findByRole('option', { name: /NC-2026-014/ }))

    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue(
      'Almacén Norte',
    )
    expect(screen.queryByText(/Esta área difiere/)).not.toBeInTheDocument()
  })

  it('shows the divergence warning after manually selecting an Incidente then changing areaAfectada', async () => {
    renderCreateRoute()

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form\.fields\.origen\b/i }),
      'O1_INCIDENTE_CAMPO',
    )
    const incidenteCombobox = await screen.findByRole('combobox', { name: 'form.fields.incidenteId' })
    await userEvent.click(incidenteCombobox)
    await userEvent.click(await screen.findByRole('option', { name: /INC-2026-003/ }))

    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('SyST')

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form.fields.areaAfectada/i }),
      'Almacén Norte',
    )

    expect(
      screen.getByText('Esta área difiere de la registrada en el Incidente INC-2026-003: SyST.'),
    ).toBeInTheDocument()
  })
})
