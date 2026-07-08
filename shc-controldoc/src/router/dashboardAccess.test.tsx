import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { useAuthStore } from '../stores/authStore'
import { loginUser } from '../features/auth/api/auth.api'
import { router } from './index'

// Regression test: /dashboard no tenía RoleGuard (solo un placeholder sin protección),
// permitiendo que CUALQUIER rol autenticado, incluido ADMINISTRADOR_SISTEMA, navegara
// a la ruta. Ver spec de routing de m5-s01-fundacion-dashboard-kpi.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE', changeLanguage: () => Promise.resolve() },
  }),
}))

const server = setupServer(...authHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})
afterAll(() => server.close())

async function loginReal(email: string) {
  const { user, accessToken } = await loginUser({ email, password: 'Shac2025!' })
  useAuthStore.getState().login({ user, accessToken })
  return user
}

function renderRouterAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  void router.navigate(path)
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('router — acceso a /dashboard por rol', () => {
  it.each([
    ['auditor@shac.pe', 'AUDITOR_INTERNO'],
    ['gerencia@shac.pe', 'ALTA_DIRECCION'],
  ])('%s (%s) navega a /dashboard sin redirección y ve el placeholder', async (email) => {
    await loginReal(email)

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('Próximamente')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  // Desde m5-s05a-dashboard-jefecalidad: JEFE_CALIDAD_SYST y JEFE_CONTROL_DOCUMENTARIO ya
  // no ven el placeholder — DashboardPage renderiza JefeCalidadDashboard (ver dashboard-jefecalidad-view spec).
  it.each([
    ['jefe.calidad@shac.pe', 'JEFE_CALIDAD_SYST'],
    ['jefe.docs@shac.pe', 'JEFE_CONTROL_DOCUMENTARIO'],
  ])('%s (%s) navega a /dashboard sin redirección y ya no ve el placeholder', async (email) => {
    await loginReal(email)

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('jefeCalidad.title')).toBeInTheDocument())
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  // Desde m5-s03-dashboard-operario: OPERARIO ya no ve el placeholder — DashboardPage
  // renderiza OperarioDashboard sin redirigir ni romper (ver dashboard-operario-view spec).
  it('operario@shac.pe (OPERARIO) navega a /dashboard sin redirección y ya no ve el placeholder', async () => {
    await loginReal('operario@shac.pe')

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('operario.title')).toBeInTheDocument())
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  // Desde m5-s04-dashboard-supervisor: SUPERVISOR ya no ve el placeholder — DashboardPage
  // renderiza SupervisorDashboard sin redirigir ni romper (ver dashboard-supervisor-view spec).
  it('supervisor@shac.pe (SUPERVISOR) navega a /dashboard sin redirección y ya no ve el placeholder', async () => {
    await loginReal('supervisor@shac.pe')

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('supervisor.title')).toBeInTheDocument())
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('ADMINISTRADOR_SISTEMA es redirigido a /no-autorizado al navegar a /dashboard', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/dashboard')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('usuario no autenticado es redirigido a /login desde /dashboard', async () => {
    renderRouterAt('/dashboard')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
