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
  // Desde m5-s07-dashboard-auditorinterno: AUDITOR_INTERNO ya no ve el placeholder —
  // DashboardPage renderiza AuditorDashboard (ver dashboard-auditor-view spec).
  it('auditor@shac.pe (AUDITOR_INTERNO) navega a /dashboard sin redirección y ya no ve el placeholder', async () => {
    await loginReal('auditor@shac.pe')

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('auditor.title')).toBeInTheDocument())
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  // Desde m5-s06-dashboard-altadireccion: ALTA_DIRECCION ya no ve el placeholder — DashboardPage
  // renderiza AltaDireccionDashboard sin redirigir ni romper (ver dashboard-altadireccion-view spec).
  it('gerencia@shac.pe (ALTA_DIRECCION) navega a /dashboard sin redirección y ya no ve el placeholder', async () => {
    await loginReal('gerencia@shac.pe')

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('altaDireccion.title')).toBeInTheDocument())
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  // Desde m5-s05a-dashboard-jefecalidad: JEFE_CALIDAD_SYST ya no ve el placeholder —
  // DashboardPage renderiza JefeCalidadDashboard (ver dashboard-jefecalidad-view spec).
  it('jefe.calidad@shac.pe (JEFE_CALIDAD_SYST) navega a /dashboard sin redirección y ya no ve el placeholder', async () => {
    await loginReal('jefe.calidad@shac.pe')

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('jefeCalidad.title')).toBeInTheDocument())
    expect(screen.queryByText('Próximamente')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  // Desde m5-s10-panel-tuatencion: JEFE_CONTROL_DOCUMENTARIO deja de compartir el dashboard
  // de Jefe de Calidad — DashboardPage renderiza JefeControlDocumentarioDashboard (ver
  // dashboard-jefecontroldoc-view spec).
  it('jefe.docs@shac.pe (JEFE_CONTROL_DOCUMENTARIO) navega a /dashboard sin redirección y ya no ve el placeholder', async () => {
    await loginReal('jefe.docs@shac.pe')

    renderRouterAt('/dashboard')

    await waitFor(() => expect(screen.getByText('jefeControlDoc.title')).toBeInTheDocument())
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
