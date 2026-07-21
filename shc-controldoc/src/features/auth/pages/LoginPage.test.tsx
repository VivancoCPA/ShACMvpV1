import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { useAuthStore } from '../../../stores/authStore'
import type { UserRole } from '../../../types/auth.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../hooks/useLogin', () => ({
  useLogin: () => ({ mutate: vi.fn(), isPending: false }),
}))

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

function renderAt(role: UserRole) {
  useAuthStore.setState({
    isAuthenticated: true,
    accessToken: 'token',
    user: {
      id: 'user-001',
      nombre: 'Test',
      apellido: 'User',
      email: 'test@shac.pe',
      rol: role,
    },
  })

  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/documentos" element={<div>documentos-page</div>} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
        <Route path="/usuarios" element={<div>usuarios-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage — redirect de sesión ya activa', () => {
  it('ADMINISTRADOR_SISTEMA con sesión activa es redirigido a /usuarios', () => {
    renderAt('ADMINISTRADOR_SISTEMA')
    expect(screen.getByText('usuarios-page')).toBeInTheDocument()
  })

  it('un rol operativo con sesión activa sigue siendo redirigido a /dashboard', () => {
    renderAt('JEFE_CALIDAD_SYST')
    expect(screen.getByText('dashboard-page')).toBeInTheDocument()
  })
})
