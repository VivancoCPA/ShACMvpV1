import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AreaForm } from './AreaForm'
import type { Area } from '../types/area.types'

const navigateMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

const crearAreaMutateAsync = vi.fn()
const actualizarAreaMutateAsync = vi.fn()
let crearAreaIsPending = false
let actualizarAreaIsPending = false

vi.mock('../hooks/useAreas', () => ({
  useCrearArea: () => ({ mutateAsync: crearAreaMutateAsync, isPending: crearAreaIsPending }),
  useActualizarArea: () => ({
    mutateAsync: actualizarAreaMutateAsync,
    isPending: actualizarAreaIsPending,
  }),
}))

afterEach(() => cleanup())

const areaFixture: Area = {
  id: 'area-001',
  nombre: 'Almacén Norte',
  activo: true,
  creadoEn: '2026-01-01T00:00:00.000Z',
  descripcion: 'Descripción existente',
}

describe('AreaForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    crearAreaIsPending = false
    actualizarAreaIsPending = false
  })

  it('modo create arranca vacío y envía datos válidos', async () => {
    const user = userEvent.setup()
    crearAreaMutateAsync.mockResolvedValue({ id: 'area-new' })

    render(<AreaForm mode="create" />)

    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('')

    await user.type(screen.getByLabelText(/form\.fields\.nombre/), 'Patio de Concentrado')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() =>
      expect(crearAreaMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Patio de Concentrado' }),
      ),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin/areas'))
  })

  it('modo edit precarga los valores del Área', () => {
    render(<AreaForm mode="edit" area={areaFixture} />)

    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('Almacén Norte')
    expect(screen.getByLabelText(/form\.fields\.descripcion/)).toHaveValue('Descripción existente')
  })

  it('nombre con menos de 3 caracteres muestra error de validación', async () => {
    const user = userEvent.setup()

    const { container } = render(<AreaForm mode="create" />)

    await user.type(screen.getByLabelText(/form\.fields\.nombre/), 'Pa')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    await waitFor(() => expect(container.querySelector('.text-error')).toBeInTheDocument())
    expect(crearAreaMutateAsync).not.toHaveBeenCalled()
  })

  it('nombre duplicado (409) muestra error inline en el campo nombre', async () => {
    const user = userEvent.setup()
    crearAreaMutateAsync.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Ya existe un Área con ese nombre' } },
    })

    render(<AreaForm mode="create" />)

    await user.type(screen.getByLabelText(/form\.fields\.nombre/), 'Almacén Norte')
    await user.click(screen.getByRole('button', { name: 'form.actions.submit' }))

    expect(await screen.findByText('Ya existe un Área con ese nombre')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('botón deshabilitado y "Guardando..." mientras la mutation está en curso', () => {
    crearAreaIsPending = true

    render(<AreaForm mode="create" />)

    const submitButton = screen.getByRole('button', { name: 'form.actions.submitting' })
    expect(submitButton).toBeDisabled()
  })
})
