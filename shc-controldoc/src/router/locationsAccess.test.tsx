import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { documentHandlers } from '../mocks/handlers/documents.handlers'
import { useAuthStore } from '../stores/authStore'
import { loginUser } from '../features/auth/api/auth.api'
import { router } from './index'

// Regression test for M6-S01: ADMINISTRADOR_SISTEMA was added to the router's RoleGuard
// for /admin/locales, but nothing exercised the real production `router` object end to
// end, so a future edit that drops the role from requiredRoles (like the M1-only matrix
// that previously guarded /usuarios) would silently ship. This drives the actual router,
// not a hand-built Routes tree.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE', changeLanguage: () => Promise.resolve() },
  }),
}))

const server = setupServer(...authHandlers, ...documentHandlers)

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

describe('router — acceso a /admin/locales por rol (M6-S01)', () => {
  it('ADMINISTRADOR_SISTEMA navega a /admin/locales sin redirección a /no-autorizado', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/admin/locales')

    await waitFor(() =>
      expect(screen.getByText('Administración de Locales y Zonas')).toBeInTheDocument(),
    )
    expect(router.state.location.pathname).toBe('/admin/locales')
  })

  it('ADMINISTRADOR_SISTEMA navega al detalle /admin/locales/:id sin redirección', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/admin/locales/loc-001')

    await waitFor(() => expect(screen.getByText(/Detalle de Local loc-001/)).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/admin/locales/loc-001')
  })

  it('SUPERVISOR es redirigido a /no-autorizado al navegar a /admin/locales', async () => {
    await loginReal('supervisor@shac.pe')

    renderRouterAt('/admin/locales')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('usuario no autenticado es redirigido a /login al navegar a /admin/locales', async () => {
    renderRouterAt('/admin/locales')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})

// Regression test: ADMINISTRADOR_SISTEMA es un rol de sistema puro sin acceso a M1
// (Control Documentario) según la matriz RACI oficial (SHAC-M1-Matriz-Responsabilidades-v1.0),
// que define únicamente 6 roles. Su alcance debe limitarse a M6 (/admin/locales).
describe('router — ADMINISTRADOR_SISTEMA sin acceso a M1 (Control Documentario)', () => {
  it('ADMINISTRADOR_SISTEMA es redirigido a /no-autorizado al navegar a /documentos', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/documentos')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })

  it('ADMINISTRADOR_SISTEMA es redirigido a /no-autorizado al navegar al detalle /documentos/:id', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/documentos/doc-001')

    await waitFor(() => expect(router.state.location.pathname).toBe('/no-autorizado'))
    expect(screen.getByText('Acceso denegado')).toBeInTheDocument()
  })
})
