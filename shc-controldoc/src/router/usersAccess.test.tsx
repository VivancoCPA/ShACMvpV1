import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { userHandlers } from '../mocks/handlers/users.handlers'
import { useAuthStore } from '../stores/authStore'
import { loginUser } from '../features/auth/api/auth.api'
import { router } from './index'

// M6-S07: RoleGuard de /usuarios cambia de ['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION'] a
// ['ADMINISTRADOR_SISTEMA'] exclusivamente — este test conduce el router real, no un
// árbol de Routes armado a mano, igual que locationsAccess.test.tsx (M6-S01).

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE', changeLanguage: () => Promise.resolve() },
  }),
}))

const server = setupServer(...authHandlers, ...userHandlers)

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

describe('router — acceso a /usuarios por rol (M6-S07)', () => {
  it('ADMINISTRADOR_SISTEMA navega a /usuarios sin redirección a /no-autorizado', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/usuarios')

    await waitFor(() => expect(router.state.location.pathname).toBe('/usuarios'))
    expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument()
  })

  it('JEFE_CALIDAD_SYST es redirigido a /no-autorizado al navegar a /usuarios', async () => {
    await loginReal('jefe.calidad@shac.pe')

    renderRouterAt('/usuarios')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('ALTA_DIRECCION es redirigido a /no-autorizado al navegar a /usuarios', async () => {
    await loginReal('gerencia@shac.pe')

    renderRouterAt('/usuarios')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('OPERARIO es redirigido a /no-autorizado al navegar a /usuarios', async () => {
    await loginReal('operario@shac.pe')

    renderRouterAt('/usuarios')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('usuario no autenticado es redirigido a /login al navegar a /usuarios', async () => {
    renderRouterAt('/usuarios')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
