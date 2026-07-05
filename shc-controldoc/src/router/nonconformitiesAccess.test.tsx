import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { documentHandlers } from '../mocks/handlers/documents.handlers'
import { nonconformityHandlers } from '../mocks/handlers/nonconformities.handlers'
import { useAuthStore } from '../stores/authStore'
import { loginUser } from '../features/auth/api/auth.api'
import { router } from './index'

// Regression test: /nonconformities y /nonconformities/:id no tenían requiredRoles en
// su RoleGuard, permitiendo que CUALQUIER rol autenticado navegara a ellas —
// incluyendo ADMINISTRADOR_SISTEMA, que segun ncPermissions.ts (DENY_ALL) y el spec
// de routing ("Ruta /nonconformities registrada con RoleGuard para todos los roles
// autenticados") no debe tener acceso a M2. Este test ejercita el router real de
// producción, no un árbol de rutas armado a mano.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE', changeLanguage: () => Promise.resolve() },
  }),
}))

const server = setupServer(...authHandlers, ...documentHandlers, ...nonconformityHandlers)

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

describe('router — acceso a /nonconformities por rol', () => {
  it('OPERARIO navega a /nonconformities sin redirección a /no-autorizado', async () => {
    await loginReal('operario@shac.pe')

    renderRouterAt('/nonconformities')

    await waitFor(() => expect(screen.getByText('list.title')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/nonconformities')
  })

  it('JEFE_CALIDAD_SYST navega a /nonconformities sin redirección', async () => {
    await loginReal('jefe.calidad@shac.pe')

    renderRouterAt('/nonconformities')

    await waitFor(() => expect(screen.getByText('list.title')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/nonconformities')
  })

  it('ADMINISTRADOR_SISTEMA es redirigido a /no-autorizado al navegar a /nonconformities', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/nonconformities')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('usuario no autenticado es redirigido a /login al navegar a /nonconformities', async () => {
    renderRouterAt('/nonconformities')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})

describe('router — acceso a /nonconformities/:id por rol', () => {
  it('OPERARIO navega al detalle /nonconformities/:id sin redirección', async () => {
    await loginReal('operario@shac.pe')

    renderRouterAt('/nonconformities/nc-001')

    await waitFor(() => expect(router.state.location.pathname).toBe('/nonconformities/nc-001'))
    await waitFor(() =>
      expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument(),
    )
  })

  it('ADMINISTRADOR_SISTEMA es redirigido a /no-autorizado al navegar al detalle de NC', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/nonconformities/nc-001')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('usuario no autenticado es redirigido a /login al navegar al detalle de NC', async () => {
    renderRouterAt('/nonconformities/nc-001')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
