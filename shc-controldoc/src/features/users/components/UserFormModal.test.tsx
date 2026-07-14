// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserFormModal } from './UserFormModal'
import type { User } from '../../../types/auth.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const createUserMutate = vi.fn()
const updateUserMutate = vi.fn()
let createUserIsPending = false
let updateUserIsPending = false

vi.mock('../hooks/useUsers', () => ({
  useCreateUser: () => ({ mutate: createUserMutate, isPending: createUserIsPending }),
  useUpdateUser: () => ({ mutate: updateUserMutate, isPending: updateUserIsPending }),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

afterEach(() => cleanup())

const supervisorFixture: User = {
  id: 'user-supervisor-001',
  nombre: 'Carmen',
  apellido: 'Torres',
  email: 'supervisor@shac.pe',
  rol: 'SUPERVISOR',
  area: 'Operaciones',
  areasAsignadas: ['Galpón B', 'Galpón C'],
  createdAt: '2024-08-12T14:30:00.000Z',
  activo: true,
}

const operarioFixture: User = {
  id: 'user-operario-001',
  nombre: 'Luis',
  apellido: 'Quispe',
  email: 'operario@shac.pe',
  rol: 'OPERARIO',
  area: 'Operaciones',
  createdAt: '2024-11-04T09:15:00.000Z',
  activo: true,
}

describe('UserFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createUserIsPending = false
    updateUserIsPending = false
  })

  it('modo alta: todos los campos aparecen vacíos', () => {
    render(<UserFormModal onClose={vi.fn()} />)

    expect(screen.getByLabelText('form.fields.nombre')).toHaveValue('')
    expect(screen.getByLabelText('form.fields.apellido')).toHaveValue('')
    expect(screen.getByLabelText('form.fields.email')).toHaveValue('')
  })

  it('modo edición: precarga los datos del usuario, incluyendo nombre/apellido editables', async () => {
    const user = userEvent.setup()
    render(<UserFormModal user={supervisorFixture} onClose={vi.fn()} />)

    expect(screen.getByLabelText('form.fields.nombre')).toHaveValue('Carmen')
    expect(screen.getByLabelText('form.fields.apellido')).toHaveValue('Torres')
    expect(screen.getByLabelText('form.fields.email')).toHaveValue('supervisor@shac.pe')
    expect(screen.getByLabelText('form.fields.rol')).toHaveValue('SUPERVISOR')
    expect(screen.getByLabelText('form.fields.area')).toHaveValue('Operaciones')

    // nombre/apellido son editables en modo edición (RN-USR-006 vía UpdateUserRequest)
    await user.clear(screen.getByLabelText('form.fields.nombre'))
    await user.type(screen.getByLabelText('form.fields.nombre'), 'Carmen Rosa')
    expect(screen.getByLabelText('form.fields.nombre')).toHaveValue('Carmen Rosa')
  })

  it('modo edición: guarda incluyendo nombre/apellido en el payload de actualización', async () => {
    const user = userEvent.setup()
    render(<UserFormModal user={supervisorFixture} onClose={vi.fn()} />)

    await user.clear(screen.getByLabelText('form.fields.apellido'))
    await user.type(screen.getByLabelText('form.fields.apellido'), 'Torres Vega')
    await user.click(screen.getByRole('button', { name: 'form.actions.guardar' }))

    await waitFor(() =>
      expect(updateUserMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: supervisorFixture.id,
          data: expect.objectContaining({ nombre: 'Carmen', apellido: 'Torres Vega' }),
        }),
        expect.anything(),
      ),
    )
  })

  it('modo edición: el campo área es visible y editable para roles distintos de SUPERVISOR, sin areasAsignadas', () => {
    render(<UserFormModal user={operarioFixture} onClose={vi.fn()} />)

    expect(screen.getByLabelText('form.fields.area')).toHaveValue('Operaciones')
    expect(screen.queryByText('form.fields.areasAsignadas')).not.toBeInTheDocument()
  })

  it('areasAsignadas y area solo aparecen cuando rol es SUPERVISOR', async () => {
    const user = userEvent.setup()
    render(<UserFormModal onClose={vi.fn()} />)

    expect(screen.queryByText('form.fields.areasAsignadas')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('form.fields.rol'), 'SUPERVISOR')

    expect(screen.getByText('form.fields.areasAsignadas')).toBeInTheDocument()
    expect(screen.getByLabelText('form.fields.area')).toBeInTheDocument()
  })

  it('email inválido muestra error localizado sin bloquear los demás campos', async () => {
    const user = userEvent.setup()
    render(<UserFormModal onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('form.fields.nombre'), 'Jorge')
    await user.type(screen.getByLabelText('form.fields.apellido'), 'Lima')
    await user.type(screen.getByLabelText('form.fields.email'), 'no-es-un-email')
    await user.click(screen.getByRole('button', { name: 'form.actions.guardar' }))

    await waitFor(() =>
      expect(screen.getByText('users:form.validation.emailInvalid')).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('form.fields.nombre')).toHaveValue('Jorge')
    expect(screen.getByLabelText('form.fields.apellido')).toHaveValue('Lima')
    expect(createUserMutate).not.toHaveBeenCalled()
  })

  it('alta exitosa: envía los datos al hook de creación', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<UserFormModal onClose={onClose} />)

    await user.type(screen.getByLabelText('form.fields.nombre'), 'Jorge')
    await user.type(screen.getByLabelText('form.fields.apellido'), 'Lima')
    await user.type(screen.getByLabelText('form.fields.email'), 'jorge.lima@shac.pe')
    await user.click(screen.getByRole('button', { name: 'form.actions.guardar' }))

    await waitFor(() =>
      expect(createUserMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Jorge',
          apellido: 'Lima',
          email: 'jorge.lima@shac.pe',
          rol: 'OPERARIO',
        }),
        expect.anything(),
      ),
    )
  })

  it('seleccionar un avatar válido muestra preview y lo incluye en el payload', async () => {
    const user = userEvent.setup()
    render(<UserFormModal onClose={vi.fn()} />)

    const file = new File([new Uint8Array(1024)], 'avatar.png', { type: 'image/png' })
    const input = screen.getByLabelText('form.avatar.subir').closest('div')!.querySelector('input[type="file"]')!
    await user.upload(input as HTMLInputElement, file)

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())

    await user.type(screen.getByLabelText('form.fields.nombre'), 'Jorge')
    await user.type(screen.getByLabelText('form.fields.apellido'), 'Lima')
    await user.type(screen.getByLabelText('form.fields.email'), 'jorge.lima@shac.pe')
    await user.click(screen.getByRole('button', { name: 'form.actions.guardar' }))

    await waitFor(() =>
      expect(createUserMutate).toHaveBeenCalledWith(
        expect.objectContaining({ avatarBase64: expect.stringContaining('data:') }),
        expect.anything(),
      ),
    )
  })

  it('alta exitosa muestra la contraseña temporal en el modal reutilizable con botón Copiar (CA-USR-09)', async () => {
    createUserMutate.mockImplementation((_data, options) => {
      options.onSuccess({ temporaryPassword: 'Ab12Cd34' })
    })
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<UserFormModal onClose={onClose} />)

    await user.type(screen.getByLabelText('form.fields.nombre'), 'Jorge')
    await user.type(screen.getByLabelText('form.fields.apellido'), 'Lima')
    await user.type(screen.getByLabelText('form.fields.email'), 'jorge.lima@shac.pe')
    await user.click(screen.getByRole('button', { name: 'form.actions.guardar' }))

    expect(await screen.findByText('temporaryPassword.titulo')).toBeInTheDocument()
    expect(screen.getByText('Ab12Cd34')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'temporaryPassword.copiar' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    const closeButtons = screen.getAllByRole('button', { name: 'temporaryPassword.cerrar' })
    await user.click(closeButtons[closeButtons.length - 1])
    expect(onClose).toHaveBeenCalled()
  })

  it('archivo de avatar con formato no permitido muestra error sin bloquear el resto del formulario', async () => {
    // applyAccept: false — el input real filtraría este archivo por `accept`, pero
    // RN-USR-007 exige que validateAvatarFile también rechace un archivo que llegue
    // igual (p.ej. el usuario elige "Todos los archivos" en el selector del SO).
    const user = userEvent.setup({ applyAccept: false })
    render(<UserFormModal onClose={vi.fn()} />)

    const file = new File([new Uint8Array(10)], 'documento.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText('form.avatar.subir').closest('div')!.querySelector('input[type="file"]')!
    await user.upload(input as HTMLInputElement, file)

    expect(await screen.findByRole('alert')).toHaveTextContent('users:form.validation.avatarFormatoInvalido')

    await user.type(screen.getByLabelText('form.fields.nombre'), 'Jorge')
    expect(screen.getByLabelText('form.fields.nombre')).toHaveValue('Jorge')
  })
})
