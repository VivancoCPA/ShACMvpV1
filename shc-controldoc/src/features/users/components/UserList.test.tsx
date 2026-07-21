// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../../../mocks/handlers/auth.handlers'
import { userHandlers } from '../../../mocks/handlers/users.handlers'
import { areaHandlers } from '../../../mocks/handlers/areas.handlers'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import { useAuthStore } from '../../../stores/authStore'
import { loginUser } from '../../auth/api/auth.api'
import { UserList } from './UserList'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

const server = setupServer(...authHandlers, ...userHandlers, ...areaHandlers)
const SEED_IDS = new Set(authFixtures.map((u) => u.id))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  for (let i = authFixtures.length - 1; i >= 0; i--) {
    if (!SEED_IDS.has(authFixtures[i].id)) authFixtures.splice(i, 1)
  }
  const jefeCalidad = authFixtures.find((u) => u.id === 'user-jefecalidad-001')
  if (jefeCalidad) jefeCalidad.activo = true
})
afterAll(() => server.close())

async function loginReal(email: string) {
  const { user, accessToken } = await loginUser({ email, password: 'Shac2025!' })
  useAuthStore.getState().login({ user, accessToken })
  return user
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <UserList />
    </QueryClientProvider>,
  )
}

describe('UserList — listado con datos mockeados', () => {
  it('muestra nombre, email, rol, área, estado y lastLogin de cada usuario', async () => {
    await loginReal('admin@shac.pe')
    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())
    expect(screen.getAllByText('list.estado.nunca').length).toBeGreaterThan(0)
  })
})

describe('UserList — filtros', () => {
  it('filtrar por rol muestra solo usuarios de ese rol', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')
    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('list.filters.rol'), 'SUPERVISOR')

    await waitFor(() => expect(screen.getByText('supervisor@shac.pe')).toBeInTheDocument())
    expect(screen.queryByText('operario@shac.pe')).not.toBeInTheDocument()
  })

  it('filtrar por estado inactivo muestra solo usuarios dados de baja', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')
    const jefeCalidad = authFixtures.find((u) => u.email === 'jefe.calidad@shac.pe')
    if (jefeCalidad) jefeCalidad.activo = false

    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('list.filters.estado'), 'INACTIVOS')

    await waitFor(() => expect(screen.getByText('jefe.calidad@shac.pe')).toBeInTheDocument())
    expect(screen.queryByText('operario@shac.pe')).not.toBeInTheDocument()
  })
})

describe('UserList — acciones por fila', () => {
  it('dar de baja requiere confirmación y actualiza la fila sin recargar', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')
    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())

    const row = screen.getByText('operario@shac.pe').closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'list.actions.darDeBaja' }))

    expect(screen.getByText('list.confirmarBaja.titulo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'list.confirmarBaja.confirmar' }))

    await waitFor(() => expect(screen.queryByText('list.confirmarBaja.titulo')).not.toBeInTheDocument())
    await waitFor(() => {
      const updatedRow = screen.getByText('operario@shac.pe').closest('tr')!
      expect(within(updatedRow).getByText('list.estado.inactivo')).toBeInTheDocument()
    })
  })

  it('resetear contraseña pide confirmación antes de ejecutar', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')
    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())

    const row = screen.getByText('operario@shac.pe').closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'list.actions.resetearPassword' }))

    expect(screen.getByText('list.confirmarReset.titulo')).toBeInTheDocument()
    expect(screen.queryByText('temporaryPassword.titulo')).not.toBeInTheDocument()
  })

  it('confirmar el reset muestra la contraseña temporal en un modal con botón Copiar', async () => {
    const user = userEvent.setup()
    await loginReal('admin@shac.pe')
    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())

    const row = screen.getByText('operario@shac.pe').closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'list.actions.resetearPassword' }))
    await user.click(screen.getByRole('button', { name: 'list.confirmarReset.confirmar' }))

    await waitFor(() => expect(screen.queryByText('list.confirmarReset.titulo')).not.toBeInTheDocument())
    expect(screen.getByText('temporaryPassword.titulo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'temporaryPassword.copiar' })).toBeInTheDocument()
  })

  it('el botón Copiar copia la contraseña al portapapeles y muestra feedback visual', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)

    const user = userEvent.setup()
    await loginReal('admin@shac.pe')
    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())

    const row = screen.getByText('operario@shac.pe').closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'list.actions.resetearPassword' }))
    await user.click(screen.getByRole('button', { name: 'list.confirmarReset.confirmar' }))

    await waitFor(() => expect(screen.getByText('temporaryPassword.titulo')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'temporaryPassword.copiar' }))

    expect(writeText).toHaveBeenCalledWith(expect.any(String))
    expect(screen.getByRole('button', { name: 'temporaryPassword.copiado' })).toBeInTheDocument()
  })
})

describe('UserList — accesibilidad', () => {
  it('botones de acción sin texto tienen aria-label, y los filtros tienen label asociado', async () => {
    await loginReal('admin@shac.pe')
    renderList()

    await waitFor(() => expect(screen.getByText('operario@shac.pe')).toBeInTheDocument())

    expect(screen.getByLabelText('list.filters.rol')).toBeInTheDocument()
    expect(screen.getByLabelText('list.filters.estado')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'list.actions.editar' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'list.actions.resetearPassword' }).length).toBeGreaterThan(0)
  })
})
