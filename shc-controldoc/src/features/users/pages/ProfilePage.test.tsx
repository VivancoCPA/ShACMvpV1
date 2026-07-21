import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../i18n'
import { ProfilePage } from './ProfilePage'
import { useAuthStore } from '../../../stores/authStore'
import type { User } from '../../../types/auth.types'
import { vi } from 'vitest'

const AREAS_MOCK = [
  { id: 'area-016', nombre: 'Operaciones', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-010', nombre: 'Galpón B', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
  { id: 'area-011', nombre: 'Galpón C', activo: true, creadoEn: '2026-01-01T00:00:00Z' },
]
vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: AREAS_MOCK }),
}))

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-001',
    nombre: 'Test',
    apellido: 'User',
    email: 'test@shac.pe',
    rol: 'OPERARIO',
    areaId: 'area-016',
    createdAt: '2024-11-04T09:15:00.000Z',
    activo: true,
    ...overrides,
  }
}

function renderProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

describe('ProfilePage — sección de solo lectura', () => {
  it('renderiza datos de solo lectura para un usuario no-SUPERVISOR sin fila de áreas asignadas', () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, accessToken: 'token' })
    renderProfilePage()

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@shac.pe')).toBeInTheDocument()
    expect(screen.getByText('Operaciones')).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t('users:profile.readOnlySection.areasAsignadas')),
    ).not.toBeInTheDocument()
  })

  it('un SUPERVISOR ve areasAsignadas como lista de tags', () => {
    useAuthStore.setState({
      user: makeUser({ rol: 'SUPERVISOR', areaIds: ['area-010', 'area-011'] }),
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderProfilePage()

    expect(screen.getByText(i18n.t('users:profile.readOnlySection.areasAsignadas'))).toBeInTheDocument()
    expect(screen.getByText('Galpón B')).toBeInTheDocument()
    expect(screen.getByText('Galpón C')).toBeInTheDocument()
  })
})

describe('ProfilePage — fechas de cuenta', () => {
  it('muestra siempre la fila "Cuenta creada" formateada', () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, accessToken: 'token' })
    renderProfilePage()

    expect(screen.getByText(i18n.t('users:profile.readOnlySection.createdAt'))).toBeInTheDocument()
    expect(screen.getByText('4 nov 2024')).toBeInTheDocument()
  })

  it('muestra la fila "Último acceso" cuando lastLogin está definido', () => {
    useAuthStore.setState({
      user: makeUser({ lastLogin: '2026-07-13T10:32:00.000Z' }),
      isAuthenticated: true,
      accessToken: 'token',
    })
    renderProfilePage()

    expect(screen.getByText(i18n.t('users:profile.readOnlySection.lastLogin'))).toBeInTheDocument()
  })

  it('omite la fila "Último acceso" cuando lastLogin es undefined', () => {
    useAuthStore.setState({ user: makeUser(), isAuthenticated: true, accessToken: 'token' })
    renderProfilePage()

    expect(
      screen.queryByText(i18n.t('users:profile.readOnlySection.lastLogin')),
    ).not.toBeInTheDocument()
  })
})
