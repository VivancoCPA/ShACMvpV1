import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from './mocks/handlers/auth.handlers'
import { documentHandlers } from './mocks/handlers/documents.handlers'
import { localesHandlers } from './mocks/handlers/locales.handlers'
import { incidentHandlers } from './mocks/handlers/incidents.handlers'
import { useAuthStore } from './stores/authStore'
import { loginUser } from './features/auth/api/auth.api'
import { router } from './router'
import App from './App'

// Regression coverage for the reported bug: login as ADMINISTRADOR_SISTEMA,
// then navigate directly to /admin/locales (e.g. typing the URL) lands on
// /login even though the role has access. Root cause: authStore kept the
// session purely in memory with no bootstrap step to restore it, so any
// full-page navigation (which router-level tests never actually perform)
// reset the app to logged-out. These tests render the full <App/> —
// including the session-bootstrap gate — instead of the bare router, so they
// exercise the same code path a real browser reload would.
//
// The session is restored via a mock refresh token in localStorage rather
// than a cookie: MSW's browser Service Worker can't make the real browser
// honor a Set-Cookie header from a synthetic Response, so a real reload never
// actually got a working cookie either — see src/lib/mockSession.ts.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE', changeLanguage: () => Promise.resolve() },
  }),
}))

const server = setupServer(...authHandlers, ...documentHandlers, ...localesHandlers, ...incidentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, isBootstrapping: false })
})
afterAll(() => server.close())

function renderAppAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  void router.navigate(path)
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App — restauración de sesión tras un reload real (bootstrap vía refresh token en localStorage)', () => {
  it('ADMINISTRADOR_SISTEMA que recarga la página (o pega la URL) sigue llegando a /admin/locales, no a /login', async () => {
    const { user, accessToken, mockRefreshToken } = await loginUser({
      email: 'admin@shac.pe',
      password: 'Shac2025!',
    })
    useAuthStore.getState().login({ user, accessToken, mockRefreshToken })
    expect(localStorage.getItem('shac_mock_refresh_token')).toBe(mockRefreshToken)

    // Simulate exactly what a real full-page reload does: localStorage
    // survives (it's browser state, not JS state), but every in-memory field
    // the Zustand singleton held is wiped, because main.tsx re-executes from
    // scratch.
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, isBootstrapping: true })

    renderAppAt('/admin/locales')

    await waitFor(() => expect(screen.getByText('header.title')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/admin/locales')
  })

  it('sin refresh token persistido (usuario nunca logueado), un reload en /admin/locales sí termina en /login', async () => {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, isBootstrapping: true })

    renderAppAt('/admin/locales')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})

describe('App — un login nuevo nunca reutiliza la sesión anterior', () => {
  it('el token de una sesión previa (admin) nunca viaja como Authorization en el POST /api/auth/login de otro usuario', async () => {
    const admin = await loginUser({ email: 'admin@shac.pe', password: 'Shac2025!' })
    useAuthStore.getState().login({
      user: admin.user,
      accessToken: admin.accessToken,
      mockRefreshToken: admin.mockRefreshToken,
    })

    let capturedAuthHeader: string | null = 'not-captured'
    const listener = ({ request }: { request: Request }) => {
      if (request.url.includes('/api/auth/login')) {
        capturedAuthHeader = request.headers.get('authorization')
      }
    }
    server.events.on('request:start', listener)

    try {
      await loginUser({ email: 'jefe.calidad@shac.pe', password: 'Shac2025!' })
    } finally {
      server.events.removeListener('request:start', listener)
    }

    expect(capturedAuthHeader).toBeNull()
  })
})
