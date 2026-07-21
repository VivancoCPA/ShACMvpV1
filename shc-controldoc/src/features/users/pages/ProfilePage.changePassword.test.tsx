import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { setupServer } from 'msw/node'
import i18n from '../../../i18n'
import { authHandlers } from '../../../mocks/handlers/auth.handlers'
import { areaHandlers } from '../../../mocks/handlers/areas.handlers'
import { authFixtures } from '../../../mocks/fixtures/auth.fixtures'
import { loginUser } from '../../auth/api/auth.api'
import { ProfilePage } from './ProfilePage'
import { useAuthStore } from '../../../stores/authStore'

const server = setupServer(...authHandlers, ...areaHandlers)

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  const operario = authFixtures.find((u) => u.id === 'user-operario-001')
  if (operario) operario.password = 'Shac2025!'
})
afterAll(() => server.close())

async function loginAsOperario() {
  const { user, accessToken } = await loginUser({ email: 'operario@shac.pe', password: 'Shac2025!' })
  useAuthStore.getState().login({ user, accessToken })
}

function renderProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

async function fillAndSubmit(currentPassword: string, newPassword: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Contraseña actual'), currentPassword)
  await user.type(screen.getByLabelText('Nueva contraseña'), newPassword)
  await user.type(screen.getByLabelText('Confirmar nueva contraseña'), newPassword)
  await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
}

describe('ProfilePage — formulario de cambio de contraseña', () => {
  it('contraseña actual incorrecta muestra error y no muta el mock', async () => {
    await loginAsOperario()
    renderProfilePage()

    await fillAndSubmit('ContraseñaIncorrecta1!', 'NuevaPass1!')

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('La contraseña actual es incorrecta'))
    expect(toastSuccess).not.toHaveBeenCalled()

    const operario = authFixtures.find((u) => u.id === 'user-operario-001')
    expect(operario?.password).toBe('Shac2025!')
  })

  it('flujo exitoso permite login posterior con la nueva contraseña dentro de la misma sesión', async () => {
    await loginAsOperario()
    renderProfilePage()

    await fillAndSubmit('Shac2025!', 'NuevaPass1!')

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Contraseña actualizada correctamente'))

    const { user } = await loginUser({ email: 'operario@shac.pe', password: 'NuevaPass1!' })
    expect(user.email).toBe('operario@shac.pe')
  })
})
