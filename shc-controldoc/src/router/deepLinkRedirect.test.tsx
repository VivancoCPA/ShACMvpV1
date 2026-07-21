// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { documentHandlers } from '../mocks/handlers/documents.handlers'
import { useAuthStore } from '../stores/authStore'
import { router } from './index'

// Un deep link no autenticado (ej. un link a un documento compartido por
// notificación) debe preservar el destino original a través de /login, en
// vez de aterrizar siempre en el default por rol tras autenticarse.

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

function renderRouterAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  void router.navigate(path)
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

async function submitLogin(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('login.email'), email)
  await user.type(screen.getByLabelText('login.password'), password)
  await user.click(screen.getByRole('button', { name: 'login.submit' }))
}

describe('router — deep link no autenticado se preserva a través del login', () => {
  it('un documento pedido directo sin sesión aterriza en el documento tras loguearse, no en el default por rol', async () => {
    renderRouterAt('/documentos/doc-001')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))

    await submitLogin('jefe.docs@shac.pe', 'Shac2025!')

    await waitFor(() => expect(router.state.location.pathname).toBe('/documentos/doc-001'))
  })

  it.each([
    'operario@shac.pe',
    'supervisor@shac.pe',
    'jefe.calidad@shac.pe',
    'jefe.docs@shac.pe',
    'auditor@shac.pe',
    'gerencia@shac.pe',
  ])('login fresco (sin deep link previo) de %s aterriza en /dashboard, no en /documentos', async (email) => {
    renderRouterAt('/login')

    await submitLogin(email, 'Shac2025!')

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  })

  it('ADMINISTRADOR_SISTEMA sin deep link previo aterriza en /usuarios', async () => {
    renderRouterAt('/login')

    await submitLogin('admin@shac.pe', 'Shac2025!')

    await waitFor(() => expect(router.state.location.pathname).toBe('/usuarios'))
  })

  it('un deep link a /usuarios sin sesión, logueado con un rol sin acceso (JEFE_CALIDAD_SYST), aterriza en el default de ese rol y no en /no-autorizado', async () => {
    renderRouterAt('/usuarios')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))

    await submitLogin('jefe.calidad@shac.pe', 'Shac2025!')

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  })

  it('un deep link a /documentos sin sesión, logueado como ADMINISTRADOR_SISTEMA (sin acceso a módulos operativos), aterriza en /usuarios y no en /no-autorizado', async () => {
    renderRouterAt('/documentos')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))

    await submitLogin('admin@shac.pe', 'Shac2025!')

    await waitFor(() => expect(router.state.location.pathname).toBe('/usuarios'))
  })
})
