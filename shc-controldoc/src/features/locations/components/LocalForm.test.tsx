import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach } from 'vitest'
import { LocalForm } from './LocalForm'
import type { LocalConZonas } from '../api/locales.api'

const navigateMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

const crearLocalMutateAsync = vi.fn()
const actualizarLocalMutateAsync = vi.fn()
let crearLocalIsPending = false
let actualizarLocalIsPending = false

vi.mock('../hooks/useLocales', () => ({
  useCrearLocal: () => ({ mutateAsync: crearLocalMutateAsync, isPending: crearLocalIsPending }),
  useActualizarLocal: () => ({
    mutateAsync: actualizarLocalMutateAsync,
    isPending: actualizarLocalIsPending,
  }),
}))

afterEach(() => cleanup())

const localFixture: LocalConZonas = {
  id: 'loc-001',
  nombre: 'Almacén Sur',
  codigo: 'LOC-001',
  activo: true,
  creadoEn: '2026-01-01T00:00:00.000Z',
  actualizadoEn: '2026-01-01T00:00:00.000Z',
  direccion: 'Av. Industrial 450',
  planoPngUrl: '/mock/plano-loc-001.png',
  zonas: [],
}

describe('LocalForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    crearLocalIsPending = false
    actualizarLocalIsPending = false
  })

  it('modo create envía datos válidos y navega', async () => {
    const user = userEvent.setup()
    crearLocalMutateAsync.mockResolvedValue({ id: 'loc-new' })

    render(<LocalForm mode="create" />)

    await user.type(screen.getByLabelText(/form\.fields\.nombre/), 'Almacén Nuevo')
    await user.type(screen.getByLabelText(/form\.fields\.direccion/), 'Av. Nueva 100')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() =>
      expect(crearLocalMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Almacén Nuevo', direccion: 'Av. Nueva 100' }),
      ),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin/locales'))
  })

  it('modo edit precarga los valores del Local', () => {
    render(<LocalForm mode="edit" local={localFixture} />)

    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('Almacén Sur')
    expect(screen.getByLabelText(/form\.fields\.direccion/)).toHaveValue('Av. Industrial 450')
    const planoThumbnail = screen.getByAltText('form.plano.previewAlt') as HTMLImageElement
    expect(planoThumbnail.src).toContain('/mock/plano-loc-001.png')
  })

  it('edición sin nuevo archivo no envía planoUrl', async () => {
    const user = userEvent.setup()
    actualizarLocalMutateAsync.mockResolvedValue({ id: 'loc-001' })

    render(<LocalForm mode="edit" local={localFixture} />)

    await user.clear(screen.getByLabelText(/form\.fields\.direccion/))
    await user.type(screen.getByLabelText(/form\.fields\.direccion/), 'Av. Industrial 999')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() => expect(actualizarLocalMutateAsync).toHaveBeenCalled())
    const payload = actualizarLocalMutateAsync.mock.calls[0][0]
    expect(payload.id).toBe('loc-001')
    expect(payload.data).not.toHaveProperty('planoUrl')
    expect(payload.data.direccion).toBe('Av. Industrial 999')
  })

  it('error 400 al crear muestra el mensaje inline del backend', async () => {
    const user = userEvent.setup()
    crearLocalMutateAsync.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'No se puede crear el local: ya existen 5 locales activos' } },
    })

    render(<LocalForm mode="create" />)

    await user.type(screen.getByLabelText(/form\.fields\.nombre/), 'Almacén Nuevo')
    await user.type(screen.getByLabelText(/form\.fields\.direccion/), 'Av. Nueva 100')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() =>
      expect(
        screen.getByText('No se puede crear el local: ya existen 5 locales activos'),
      ).toBeInTheDocument(),
    )
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('el botón de envío está deshabilitado mientras la mutation está pendiente', () => {
    crearLocalIsPending = true

    render(<LocalForm mode="create" />)

    const submitButton = screen.getByRole('button', { name: 'form.actions.submitting' })
    expect(submitButton).toBeDisabled()
  })
})
