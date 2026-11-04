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
import { loginUser, isLoginResolved } from '../../auth/api/auth.api'
import { ProfilePage } from './ProfilePage'
import { useAuthStore } from '../../../stores/authStore'

// pin-olvidado-pista: ancla /perfil#pin-firma (scroll + foco), texto de ayuda para PIN
// olvidado, y contraseña incorrecta en set-pin sin refresco de sesión.

const server = setupServer(...authHandlers, ...areaHandlers)
const requestedPaths: string[] = []
server.events.on('request:start', ({ request }) => {
  requestedPaths.push(new URL(request.url).pathname)
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const scrollIntoView = vi.fn()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  // jsdom no implementa scrollIntoView.
  Element.prototype.scrollIntoView = scrollIntoView
})
afterEach(() => {
  server.resetHandlers()
  cleanup()
  vi.clearAllMocks()
  requestedPaths.length = 0
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})
afterAll(() => server.close())

async function loginAsOperario() {
  const response = await loginUser({ email: 'operario@shac.pe', password: 'Shac2025!' })
  if (!isLoginResolved(response)) throw new Error('loginAsOperario: requiere selección de empresa')
  const { user, accessToken, empresaActivaId, empresasDisponibles } = response
  useAuthStore.getState().login({ user, accessToken, empresaActivaId, empresasDisponibles })
}

function setTienePinFirma(tienePinFirma: boolean) {
  const user = useAuthStore.getState().user
  if (user) useAuthStore.setState({ user: { ...user, tienePinFirma } })
}

function renderProfilePage(initialEntry = '/perfil') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

const forgotHint = () => i18n.t('users:profile.pinSection.forgotHint')

describe('ProfilePage — PIN de firma: ancla y pista de PIN olvidado', () => {
  it('con #pin-firma baja hasta la sección y deja el foco en la contraseña', async () => {
    await loginAsOperario()
    renderProfilePage('/perfil#pin-firma')

    const passwordInput = screen.getByLabelText(i18n.t('users:profile.pinSection.currentPassword'))
    await waitFor(() => expect(passwordInput).toHaveFocus())
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(scrollIntoView.mock.contexts[0]).toHaveAttribute('id', 'pin-firma')
  })

  it('sin hash no hace scroll ni mueve el foco', async () => {
    await loginAsOperario()
    renderProfilePage('/perfil')

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByLabelText(i18n.t('users:profile.pinSection.currentPassword'))).not.toHaveFocus()
  })

  it('muestra el texto de ayuda solo si el usuario tiene PIN configurado', async () => {
    await loginAsOperario()
    setTienePinFirma(true)
    renderProfilePage()
    expect(screen.getByText(forgotHint())).toBeInTheDocument()

    cleanup()
    setTienePinFirma(false)
    renderProfilePage()
    expect(screen.queryByText(forgotHint())).not.toBeInTheDocument()
  })

  it('contraseña incorrecta: error en el campo, una sola llamada a set-pin y ningún refresh', async () => {
    await loginAsOperario()
    renderProfilePage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(i18n.t('users:profile.pinSection.currentPassword')), 'Incorrecta!1')
    await user.type(screen.getByLabelText(i18n.t('users:profile.pinSection.newPin')), '1234')
    await user.type(screen.getByLabelText(i18n.t('users:profile.pinSection.confirmPin')), '1234')
    await user.click(screen.getByRole('button', { name: i18n.t('users:profile.pinSection.submit') }))

    await waitFor(() =>
      expect(
        screen.getByText(i18n.t('users:changePassword.errors.incorrectCurrentPassword')),
      ).toBeInTheDocument(),
    )
    expect(requestedPaths.filter((p) => p === '/api/auth/set-pin')).toHaveLength(1)
    expect(requestedPaths).not.toContain('/api/auth/refresh')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
