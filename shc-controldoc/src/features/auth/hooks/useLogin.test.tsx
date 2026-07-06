import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { User } from '../../../types/auth.types'
import { useLogin } from './useLogin'
import { useAuthStore } from '../../../stores/authStore'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

let mockLoginResponse: { user: User; accessToken: string }
vi.mock('../api/auth.api', () => ({
  loginUser: () => Promise.resolve(mockLoginResponse),
}))

afterEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-001',
    nombre: 'Test',
    apellido: 'User',
    email: 'test@shac.pe',
    rol: 'JEFE_CALIDAD_SYST',
    ...overrides,
  }
}

describe('useLogin', () => {
  it('navega a /admin/locales tras login exitoso de ADMINISTRADOR_SISTEMA', async () => {
    mockLoginResponse = { user: makeUser({ rol: 'ADMINISTRADOR_SISTEMA' }), accessToken: 'token' }
    const { result } = renderHook(() => useLogin(), { wrapper })

    act(() => {
      result.current.mutate({ email: 'admin@shac.pe', password: 'Shac2025!' })
    })

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin/locales'))
  })

  it('navega a /documentos tras login exitoso de un rol operativo', async () => {
    mockLoginResponse = { user: makeUser({ rol: 'JEFE_CALIDAD_SYST' }), accessToken: 'token' }
    const { result } = renderHook(() => useLogin(), { wrapper })

    act(() => {
      result.current.mutate({ email: 'jefe.calidad@shac.pe', password: 'Shac2025!' })
    })

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/documentos'))
  })
})
