import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { documentHandlers } from '../mocks/handlers/documents.handlers'
import { localesHandlers } from '../mocks/handlers/locales.handlers'
import { incidentHandlers } from '../mocks/handlers/incidents.handlers'
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

const server = setupServer(...authHandlers, ...documentHandlers, ...localesHandlers, ...incidentHandlers)

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

    await waitFor(() => expect(screen.getByText('header.title')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/admin/locales')
  })

  it('ADMINISTRADOR_SISTEMA es redirigido desde el detalle /admin/locales/:id al listado (M6-S03)', async () => {
    await loginReal('admin@shac.pe')

    renderRouterAt('/admin/locales/loc-001')

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/locales'))
    expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument()
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

// Investigation: reported bug — login as ADMINISTRADOR_SISTEMA, then type
// /admin/locales directly into the browser address bar → lands on /login even
// though the role has access. These two tests isolate the two possible causes:
// (a) RoleGuard/redirect logic itself, and (b) loss of in-memory session state
// across what a real browser does on a typed-URL navigation (a full page
// reload), which this test process never performs.
describe('router — investigación: sesión perdida al navegar directo a /admin/locales', () => {
  it('con el estado de auth intacto, login + navegación inmediata SÍ llega a /admin/locales (descarta bug en RoleGuard)', async () => {
    await loginReal('admin@shac.pe')

    // Navigate immediately, same as the reported repro: no awaiting on an
    // intermediate redirect before going to the target route.
    renderRouterAt('/admin/locales')

    await waitFor(() => expect(screen.getByText('header.title')).toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/admin/locales')
  })

  it('REGRESIÓN: si el estado de auth en memoria se pierde (equivalente a un reload real), la navegación SÍ termina en /login', async () => {
    await loginReal('admin@shac.pe')

    // authStore has no `persist` middleware (unlike preferencesStore/uiStore)
    // and there is no bootstrap-on-mount flow that restores the session from
    // the httpOnly refresh cookie. A real full-page navigation (typing a URL,
    // hitting Enter, or F5) re-executes main.tsx from scratch, so the Zustand
    // module singleton resets to its initial unauthenticated state. This line
    // reproduces exactly that reset, which `router.navigate()` alone cannot
    // simulate because it never tears down the JS module registry.
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })

    renderRouterAt('/admin/locales')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
