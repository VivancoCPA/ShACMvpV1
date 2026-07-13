import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { useAuthStore } from '../stores/authStore'
import { loginUser } from '../features/auth/api/auth.api'
import type { UserRole } from '../types/auth.types'
import { router } from './index'

// /perfil es accesible a los 7 roles con solo autenticación (sin RoleGuard requiredRoles
// adicional) — ver spec user-profile-view (m6-s06-perfil-usuario).

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

const ROLE_EMAILS: Record<UserRole, string> = {
  OPERARIO: 'operario@shac.pe',
  SUPERVISOR: 'supervisor@shac.pe',
  JEFE_CALIDAD_SYST: 'jefe.calidad@shac.pe',
  JEFE_CONTROL_DOCUMENTARIO: 'jefe.docs@shac.pe',
  AUDITOR_INTERNO: 'auditor@shac.pe',
  ALTA_DIRECCION: 'gerencia@shac.pe',
  ADMINISTRADOR_SISTEMA: 'admin@shac.pe',
}

describe('router — acceso a /perfil por rol', () => {
  for (const [rol, email] of Object.entries(ROLE_EMAILS) as [UserRole, string][]) {
    it(`${email} (${rol}) navega a /perfil sin redirigir a /no-autorizado`, async () => {
      await loginReal(email)

      renderRouterAt('/perfil')

      await waitFor(() => expect(router.state.location.pathname).toBe('/perfil'))
      expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument()
    })
  }

  it('usuario no autenticado es redirigido a /login desde /perfil', async () => {
    renderRouterAt('/perfil')

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
