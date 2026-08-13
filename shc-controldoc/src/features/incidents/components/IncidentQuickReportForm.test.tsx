import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { toast } from 'sonner'
import { IncidentQuickReportForm } from './IncidentQuickReportForm'
import { createIncident } from '../api/incidents.api'
import { enqueue } from '../../../lib/offlineQueue'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  setOnline(true)
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.numero ? `${key}:${opts.numero}` : key) }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string }; empresaActivaId: string | null }) => unknown) =>
    sel({ user: { id: 'user-mock' }, empresaActivaId: 'empresa-001' }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [{ id: 'area-syst', nombre: 'SyST', activo: true }] }),
}))

vi.mock('../hooks/useGeolocationCapture', () => ({
  useGeolocationCapture: () => ({ status: 'idle', geoUbicacion: undefined, capture: vi.fn() }),
}))

vi.mock('../api/incidents.api', () => ({
  createIncident: vi.fn(),
}))

vi.mock('../../../lib/offlineQueue', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/offlineQueue')>('../../../lib/offlineQueue')
  return { ...actual, enqueue: vi.fn() }
})

vi.mock('browser-image-compression', () => ({
  default: vi.fn((file: File) => Promise.resolve(file)),
}))

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IncidentQuickReportForm />
    </QueryClientProvider>,
  )
}

async function fillRequiredFields() {
  const user = userEvent.setup()
  await user.selectOptions(screen.getByLabelText(/form.fields.tipo/), 'INCIDENTE')
  await user.selectOptions(screen.getByLabelText(/form.fields.area/), 'area-syst')
  await user.selectOptions(screen.getByLabelText(/form.fields.turno/), 'DIA')
  await user.type(screen.getByLabelText(/form.fields.descripcion/), 'Descripción de prueba con más de veinte caracteres')
  return user
}

function buildAxiosError(overrides: Partial<AxiosError>): AxiosError {
  const error = new AxiosError('mensaje', overrides.code, { headers: new AxiosHeaders() } as never)
  return Object.assign(error, overrides)
}

function buildPhotoFile(name = 'foto.jpg'): File {
  return new File(['contenido'], name, { type: 'image/jpeg' })
}

async function attachPhoto(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  const input = screen.getByLabelText('mobile.form.evidencias.uploadLabel') as HTMLInputElement
  await user.upload(input, files)
}

describe('IncidentQuickReportForm — envío y clasificación de errores (D6)', () => {
  it('envío exitoso con conexión: llama createIncident, muestra toast de éxito y la pantalla de folio', async () => {
    vi.mocked(createIncident).mockResolvedValueOnce({ numero: 'INC-2026-001' } as never)
    renderForm()
    const user = await fillRequiredFields()

    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(createIncident).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalled()
    expect(enqueue).not.toHaveBeenCalled()
    expect(await screen.findByText('mobile.success.numero:INC-2026-001')).toBeInTheDocument()
  })

  it('sin conexión detectada de antemano: encola sin intentar el request y muestra confirmación de guardado local', async () => {
    setOnline(false)
    renderForm()
    const user = await fillRequiredFields()

    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1))
    expect(createIncident).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(await screen.findByText('mobile.offline.queuedTitle')).toBeInTheDocument()
  })

  it('error de conectividad real (ERR_NETWORK) tras intentar el request: encola y muestra confirmación de guardado local', async () => {
    vi.mocked(createIncident).mockRejectedValueOnce(buildAxiosError({ code: 'ERR_NETWORK' }))
    renderForm()
    const user = await fillRequiredFields()

    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1))
    expect(toast.error).not.toHaveBeenCalled()
    expect(await screen.findByText('mobile.offline.queuedTitle')).toBeInTheDocument()
  })

  it('error de validación del servidor (con response): muestra toast de error existente y no encola', async () => {
    vi.mocked(createIncident).mockRejectedValueOnce(
      buildAxiosError({ response: { status: 400, data: {} } as never }),
    )
    renderForm()
    const user = await fillRequiredFields()

    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('toasts.createError'))
    expect(enqueue).not.toHaveBeenCalled()
    expect(screen.queryByText('mobile.offline.queuedTitle')).not.toBeInTheDocument()
  })

  it('ERR_INVALID_RESPONSE_ENVELOPE (bug de coordinación de SW): muestra toast de error existente y no encola', async () => {
    vi.mocked(createIncident).mockRejectedValueOnce(
      buildAxiosError({
        code: 'ERR_INVALID_RESPONSE_ENVELOPE',
        response: { status: 200, data: '<html></html>' } as never,
      }),
    )
    renderForm()
    const user = await fillRequiredFields()

    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('toasts.createError'))
    expect(enqueue).not.toHaveBeenCalled()
    expect(screen.queryByText('mobile.offline.queuedTitle')).not.toBeInTheDocument()
  })
})

describe('IncidentQuickReportForm — caption opcional por foto (m7-ajuste-texto-foto-incidencia)', () => {
  it('envío online con un caption escrito: la evidencia incluye descripcion con ese valor', async () => {
    vi.mocked(createIncident).mockResolvedValueOnce({ numero: 'INC-2026-001' } as never)
    renderForm()
    const user = await fillRequiredFields()
    await attachPhoto(user, [buildPhotoFile()])

    const captionInput = screen.getByLabelText('mobile.form.evidencias.captionAriaLabel')
    await user.type(captionInput, 'válvula de escape dañada')
    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(createIncident).toHaveBeenCalledTimes(1))
    const [payload] = vi.mocked(createIncident).mock.calls[0]
    expect(payload.evidencias?.[0].descripcion).toBe('válvula de escape dañada')
  })

  it('caption vacío no aparece como descripcion en la evidencia enviada', async () => {
    vi.mocked(createIncident).mockResolvedValueOnce({ numero: 'INC-2026-001' } as never)
    renderForm()
    const user = await fillRequiredFields()
    await attachPhoto(user, [buildPhotoFile()])

    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(createIncident).toHaveBeenCalledTimes(1))
    const [payload] = vi.mocked(createIncident).mock.calls[0]
    expect(payload.evidencias?.[0].descripcion).toBeUndefined()
  })

  it('caption de más de 140 caracteres muestra error de validación inline y no envía la request', async () => {
    renderForm()
    const user = await fillRequiredFields()
    await attachPhoto(user, [buildPhotoFile()])

    const captionInput = screen.getByLabelText('mobile.form.evidencias.captionAriaLabel')
    // fireEvent.change bypassea el `maxLength` nativo del input (que ya
    // impide escribir más de 140 caracteres en un navegador real) para
    // ejercitar la validación Zod como defensa en profundidad.
    fireEvent.change(captionInput, { target: { value: 'a'.repeat(141) } })
    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    expect(await screen.findByText('Máximo 140 caracteres')).toBeInTheDocument()
    expect(createIncident).not.toHaveBeenCalled()
  })

  it('envío offline con 2 fotos con captions distintos: enqueue recibe photoCaptions alineado con photoBlobs', async () => {
    setOnline(false)
    renderForm()
    const user = await fillRequiredFields()
    const fileA = buildPhotoFile('a.jpg')
    const fileB = buildPhotoFile('b.jpg')
    await attachPhoto(user, [fileA, fileB])

    const captionInputs = screen.getAllByLabelText('mobile.form.evidencias.captionAriaLabel')
    await user.type(captionInputs[0], 'Foto A')
    await user.type(captionInputs[1], 'Foto B')
    await user.click(screen.getByRole('button', { name: 'mobile.form.submit' }))

    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1))
    const [enqueueInput] = vi.mocked(enqueue).mock.calls[0]
    expect(enqueueInput.photoBlobs).toHaveLength(2)
    expect(enqueueInput.photoCaptions).toEqual(['Foto A', 'Foto B'])
  })

  it('remover una foto del medio conserva el caption correcto de las fotos restantes', async () => {
    renderForm()
    const user = await fillRequiredFields()
    await attachPhoto(user, [buildPhotoFile('a.jpg'), buildPhotoFile('b.jpg'), buildPhotoFile('c.jpg')])

    let captionInputs = screen.getAllByLabelText('mobile.form.evidencias.captionAriaLabel')
    await user.type(captionInputs[0], 'Foto A')
    await user.type(captionInputs[1], 'Foto B')
    await user.type(captionInputs[2], 'Foto C')

    const removeButtons = screen.getAllByRole('button', { name: 'form.evidencias.removeFile' })
    await user.click(removeButtons[1])

    captionInputs = screen.getAllByLabelText('mobile.form.evidencias.captionAriaLabel')
    expect(captionInputs).toHaveLength(2)
    expect(captionInputs[0]).toHaveValue('Foto A')
    expect(captionInputs[1]).toHaveValue('Foto C')
  })
})
