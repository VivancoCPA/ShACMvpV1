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

const AREAS_MOCK = [
  { id: 'area-001', nombre: 'Almacén Norte', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-002', nombre: 'Almacén Sur', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-007', nombre: 'Calidad', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-015', nombre: 'Logística', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-019', nombre: 'SyST', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
]
vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: AREAS_MOCK }),
  useArea: (id: string) => ({ data: AREAS_MOCK.find((a) => a.id === id) }),
}))

const createMutate = vi.fn()
vi.mock('../hooks/useCreateQualityEvent', () => ({
  useCreateQualityEvent: () => ({ mutate: createMutate, isPending: false }),
}))

const vincularQEMutate = vi.fn()
vi.mock('../../incidents/hooks/useIncidents', () => ({
  useVincularQE: () => ({ mutate: vincularQEMutate, isPending: false }),
}))

const vincularNCMutate = vi.fn()
vi.mock('../../nonconformities/hooks/useNonconformities', () => ({
  useVincularNC: () => ({ mutate: vincularNCMutate, isPending: false }),
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
  areaId: 'area-001',
  turno: 'DIA',
  fechaHoraEvento: '2026-06-01T08:00:00Z',
  fechaHoraReporte: new Date().toISOString(),
  reportadoPorId: 'user-creator',
  hallazgoCodigo: 'HAL-2026-001',
  normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' },
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

  it('pre-fills the RN-QE-014 field set for an authorized creator', () => {
    useAuthStore.setState({
      user: { id: 'user-creator', nombre: 'Creador', apellido: 'Uno', email: 'c@shac.internal', rol: 'OPERARIO', area: 'Almacén Norte' },
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderEditRoute()

    expect(screen.getByDisplayValue('Descripción original del evento reportado')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('area-001')
    expect(screen.getByRole('textbox', { name: /form.fields.hallazgoCodigo/i })).toHaveValue('HAL-2026-001')
    expect(screen.getByRole('combobox', { name: /form.fields.normaVinculada/i })).toHaveValue('ISO_9001_2015')
    expect(screen.getByRole('combobox', { name: 'form.fields.clausula' })).toHaveValue('8.4.1')
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

  it('redirects to the detail page for a user without RN-QE-014 access', () => {
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
    expect(vars.data).toEqual({ areaId: 'area-002' })
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
          areaId: 'area-001',
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
          areaId: 'area-019',
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  afterEach(() => cleanup())

  it('prefills origen and ncId from O2 query params', async () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=area-001',
    )

    expect(screen.getByRole('combobox', { name: /form\.fields\.origen\b/i })).toHaveValue('O2_NC_DETECTADA')
    expect(await screen.findByDisplayValue('NC-2026-014')).toBeInTheDocument()
  })

  it('prefills origen and incidenteId from O1 query params', async () => {
    renderCreateRoute(
      '?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=area-019',
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
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=area-001',
    )

    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('area-001')
    expect(
      screen.queryByText('Esta área difiere de la registrada en la NC NC-2026-014: Almacén Norte.'),
    ).not.toBeInTheDocument()
  })

  it('shows the exact warning when areaAfectada diverges from the NC origin', async () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=area-001',
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
      '?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=area-019',
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
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=area-001',
    )

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form.fields.areaAfectada/i }),
      'Logística',
    )
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(createMutate).toHaveBeenCalledTimes(1)
    const [payload] = createMutate.mock.calls[0] as [{ areaId: string }]
    expect(payload.areaId).toBe('area-015')
  })

  it('links the created QE to its origin Incidente (RN-QE-001) before navigating to the detail page', async () => {
    createMutate.mockImplementation(
      (_payload: unknown, opts?: { onSuccess?: (created: { id: string; numero: string }) => void }) =>
        opts?.onSuccess?.({ id: 'qe-2026-999', numero: 'QE-2026-999' }),
    )
    vincularQEMutate.mockImplementation((_vars: unknown, opts?: { onSettled?: () => void }) => opts?.onSettled?.())

    renderCreateRoute(
      '?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=area-019',
    )
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(vincularQEMutate).toHaveBeenCalledTimes(1)
    expect(vincularQEMutate.mock.calls[0][0]).toEqual({ id: 'inc-003', qeId: 'qe-2026-999' })
    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
  })

  it('does not call useVincularQE when the QE origin is not O1_INCIDENTE_CAMPO', async () => {
    createMutate.mockImplementation(
      (_payload: unknown, opts?: { onSuccess?: (created: { id: string; numero: string }) => void }) =>
        opts?.onSuccess?.({ id: 'qe-2026-998', numero: 'QE-2026-998' }),
    )
    vincularNCMutate.mockImplementation((_vars: unknown, opts?: { onSettled?: () => void }) => opts?.onSettled?.())

    renderCreateRoute('?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=area-001')
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(vincularQEMutate).not.toHaveBeenCalled()
    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
  })

  it('links the created QE to its origin NC (RN-QE-013) before navigating to the detail page', async () => {
    createMutate.mockImplementation(
      (_payload: unknown, opts?: { onSuccess?: (created: { id: string; numero: string }) => void }) =>
        opts?.onSuccess?.({ id: 'qe-2026-997', numero: 'QE-2026-997' }),
    )
    vincularNCMutate.mockImplementation((_vars: unknown, opts?: { onSettled?: () => void }) => opts?.onSettled?.())

    renderCreateRoute('?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=area-001')
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(vincularNCMutate).toHaveBeenCalledTimes(1)
    expect(vincularNCMutate.mock.calls[0][0]).toEqual({ id: 'nc-014', qeGeneradoId: 'qe-2026-997' })
    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
  })

  it('does not call useVincularNC when the QE origin is not O2_NC_DETECTADA', async () => {
    createMutate.mockImplementation(
      (_payload: unknown, opts?: { onSuccess?: (created: { id: string; numero: string }) => void }) =>
        opts?.onSuccess?.({ id: 'qe-2026-996', numero: 'QE-2026-996' }),
    )
    vincularQEMutate.mockImplementation((_vars: unknown, opts?: { onSettled?: () => void }) => opts?.onSettled?.())

    renderCreateRoute(
      '?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=area-019',
    )
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(vincularNCMutate).not.toHaveBeenCalled()
    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
  })

  it('warning disappears when the user restores the original origin area', async () => {
    renderCreateRoute(
      '?origen=O2_NC_DETECTADA&ncId=nc-014&ncNumero=NC-2026-014&ncArea=area-001',
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
      'area-001',
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

    expect(screen.getByRole('combobox', { name: /form.fields.areaAfectada/i })).toHaveValue('area-019')

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /form.fields.areaAfectada/i }),
      'Almacén Norte',
    )

    expect(
      screen.getByText('Esta área difiere de la registrada en el Incidente INC-2026-003: SyST.'),
    ).toBeInTheDocument()
  })

  describe('O3: normativaVinculada validation (m8-normativa-vinculada fixes)', () => {
    async function fillO3BaseFields() {
      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /form\.fields\.origen\b/i }),
        'O3_HALLAZGO_AUDITORIA',
      )
      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /form.fields.areaAfectada/i }),
        'Almacén Norte',
      )
      await userEvent.type(screen.getByLabelText(/form\.fields\.hallazgoCodigo/i), 'HAL-2026-020')
      await fillRequiredFields()
    }

    it('Fix 1: shows the descriptive message when normativaVinculada is left untouched', async () => {
      renderCreateRoute()
      await fillO3BaseFields()

      await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

      expect(
        await screen.findByText(
          'Se requiere la normativa vinculada (norma y cláusula incumplida) para hallazgos de auditoría',
        ),
      ).toBeInTheDocument()
      expect(screen.queryByText(/expected object, received undefined/i)).not.toBeInTheDocument()
      expect(createMutate).not.toHaveBeenCalled()
    })

    it('Fix 2a: shows the refine message (not the raw Zod min-length error) when norma=OTRA and normaOtraDetalle is empty', async () => {
      renderCreateRoute()
      await fillO3BaseFields()

      await userEvent.selectOptions(screen.getByLabelText(/form\.fields\.normaVinculada/i), 'OTRA')
      await userEvent.type(screen.getByLabelText(/form\.fields\.clausula/i), '3.2')

      await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

      expect(
        await screen.findByText('Se requiere el detalle de la normativa cuando norma es OTRA'),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Too small/i)).not.toBeInTheDocument()
      expect(createMutate).not.toHaveBeenCalled()
    })

    it('saves correctly when norma=OTRA with normaOtraDetalle and clausula filled', async () => {
      renderCreateRoute()
      await fillO3BaseFields()

      await userEvent.selectOptions(screen.getByLabelText(/form\.fields\.normaVinculada/i), 'OTRA')
      await userEvent.type(screen.getByLabelText(/form\.fields\.clausula/i), '3.2')
      await userEvent.type(screen.getByLabelText(/form\.fields\.normaOtraDetalle/i), 'Auditoría Operacional')

      await userEvent.click(screen.getByRole('button', { name: 'form.actions.submit' }))

      expect(createMutate).toHaveBeenCalledTimes(1)
      const [payload] = createMutate.mock.calls[0] as [{ normativaVinculada: unknown }]
      expect(payload.normativaVinculada).toEqual({
        norma: 'OTRA',
        clausula: '3.2',
        normaOtraDetalle: 'Auditoría Operacional',
      })
    })
  })
})
