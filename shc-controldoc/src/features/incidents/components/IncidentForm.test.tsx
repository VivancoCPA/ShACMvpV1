import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { IncidentForm } from './IncidentForm'
import type { Incidente, Local } from '../types/incident.types'
import type { UserRole } from '../../../types/auth.types'

afterEach(() => {
  cleanup()
  createMutateAsyncMock.mockReset()
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

let mockRole: UserRole = 'SUPERVISOR'
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole; id: string } | null }) => unknown) =>
    sel({ user: { rol: mockRole, id: 'user-mock' } }),
}))

const createMutateAsyncMock = vi.fn()
vi.mock('../hooks/useIncidents', () => ({
  useCreateIncident: () => ({ mutateAsync: createMutateAsyncMock, isPending: false }),
  useUpdateIncident: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [{ id: 'area-syst', nombre: 'SyST', activo: true }] }),
}))

vi.mock('../hooks/useZonasByLocal', () => ({
  useZonasByLocal: () => ({ data: [], isLoading: false, isError: false }),
}))

// Forma real del hook: `{ locales, isLoading, isError }`, nunca `{ data }`.
// Un mock que use `{ data: [...] }` en vez de `{ locales: [...] }` enmascararía
// de nuevo el mismatch de forma diagnosticado en IncidentForm/IncidentDetailPage.
let mockLocales: Local[] = []
let mockIsLoading = false
vi.mock('../hooks/useLocales', () => ({
  useLocales: () => ({ locales: mockLocales, isLoading: mockIsLoading, isError: false }),
}))

const localFixtures: Local[] = [
  {
    id: 'loc-001',
    empresaId: 'empresa-001',
    nombre: 'Almacén Principal',
    codigo: 'LOC-001',
    activo: true,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-002',
    empresaId: 'empresa-001',
    nombre: 'Patio de Minerales',
    codigo: 'LOC-002',
    activo: true,
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
]

function renderForm() {
  return render(
    <MemoryRouter>
      <IncidentForm mode="create" />
    </MemoryRouter>,
  )
}

function buildPhotoFile(name = 'foto.jpg'): File {
  return new File(['contenido'], name, { type: 'image/jpeg' })
}

function buildRecentDatetimeLocal(): string {
  const d = new Date(Date.now() - 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fillRequiredFields() {
  const user = userEvent.setup()
  await user.click(screen.getByLabelText(/tipo\.INCIDENTE/))
  await user.type(
    screen.getByLabelText(/form\.fields\.descripcion/),
    'Descripción de prueba con más de veinte caracteres',
  )
  await user.selectOptions(screen.getByLabelText(/form\.fields\.area/), 'area-syst')
  await user.selectOptions(screen.getByLabelText(/form\.fields\.turno/), 'DIA')
  fireEvent.change(screen.getByLabelText(/form\.fields\.fechaEvento/), {
    target: { value: buildRecentDatetimeLocal() },
  })
  return user
}

async function attachPhoto(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  const input = screen.getByLabelText('form.evidencias.uploadLabel') as HTMLInputElement
  await user.upload(input, files)
}

function buildIncidentFixture(overrides: Partial<Incidente> = {}): Incidente {
  return {
    id: 'inc-001',
    numero: 'INC-2026-001',
    tipo: 'INCIDENTE',
    estado: 'ABIERTO',
    severidad: 'BAJA',
    descripcion: 'Descripción de prueba con más de veinte caracteres',
    areaId: 'area-syst',
    empresaId: 'empresa-001',
    turno: 'DIA',
    fechaEvento: '2026-01-01T10:00:00.000Z',
    fechaReporte: '2026-01-01T10:05:00.000Z',
    reportadoPorId: 'user-mock',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2026-01-01T10:05:00.000Z',
    actualizadoEn: '2026-01-01T10:05:00.000Z',
    ...overrides,
  }
}

describe('IncidentForm — selector de Local', () => {
  beforeEach(() => {
    mockRole = 'SUPERVISOR'
    mockIsLoading = false
  })

  it('muestra las opciones de locales devueltas por useLocales', () => {
    mockLocales = localFixtures
    renderForm()

    const select = screen.getByLabelText('form.fields.localId') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)

    expect(optionLabels).toContain('Almacén Principal')
    expect(optionLabels).toContain('Patio de Minerales')
  })

  it('solo muestra el placeholder mientras useLocales está cargando', () => {
    mockLocales = []
    mockIsLoading = true
    renderForm()

    const select = screen.getByLabelText('form.fields.localId') as HTMLSelectElement
    expect(select.options.length).toBe(1)
    expect(select.options[0].value).toBe('')
  })
})

describe('IncidentForm — caption opcional por foto (m7-ajuste-texto-foto-incidencia)', () => {
  beforeEach(() => {
    mockRole = 'SUPERVISOR'
    mockLocales = []
    mockIsLoading = false
  })

  it('escribir un caption bajo una foto nueva adjuntada: la evidencia enviada incluye descripcion', async () => {
    createMutateAsyncMock.mockResolvedValueOnce({ id: 'inc-new' })
    renderForm()
    const user = await fillRequiredFields()
    await attachPhoto(user, [buildPhotoFile()])

    const captionInput = screen.getByLabelText('form.evidencias.captionAriaLabel')
    await user.type(captionInput, 'válvula de escape dañada')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await vi.waitFor(() => expect(createMutateAsyncMock).toHaveBeenCalledTimes(1))
    const [payload] = createMutateAsyncMock.mock.calls[0]
    expect(payload.evidencias?.[0].descripcion).toBe('válvula de escape dañada')
  })

  it('caption vacío no aparece como descripcion en la evidencia enviada', async () => {
    createMutateAsyncMock.mockResolvedValueOnce({ id: 'inc-new' })
    renderForm()
    const user = await fillRequiredFields()
    await attachPhoto(user, [buildPhotoFile()])

    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await vi.waitFor(() => expect(createMutateAsyncMock).toHaveBeenCalledTimes(1))
    const [payload] = createMutateAsyncMock.mock.calls[0]
    expect(payload.evidencias?.[0].descripcion).toBeUndefined()
  })

  it('caption de más de 140 caracteres muestra error de validación inline y no envía la request', async () => {
    renderForm()
    const user = await fillRequiredFields()
    await attachPhoto(user, [buildPhotoFile()])

    const captionInput = screen.getByLabelText('form.evidencias.captionAriaLabel')
    fireEvent.change(captionInput, { target: { value: 'a'.repeat(141) } })
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(await screen.findByText('Máximo 140 caracteres')).toBeInTheDocument()
    expect(createMutateAsyncMock).not.toHaveBeenCalled()
  })

  it('en modo edición, las evidencias existentes no muestran ningún input de caption', () => {
    const incident = buildIncidentFixture({
      evidencias: [
        {
          id: 'ev-001',
          url: 'https://example.com/foto.jpg',
          nombre: 'foto.jpg',
          tipo: 'imagen',
          tamanioKb: 120,
          creadoEn: '2026-01-01T10:00:00.000Z',
          creadoPor: 'user-mock',
        },
      ],
    })

    render(
      <MemoryRouter>
        <IncidentForm mode="edit" incident={incident} />
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText('form.evidencias.captionAriaLabel')).not.toBeInTheDocument()
  })
})
