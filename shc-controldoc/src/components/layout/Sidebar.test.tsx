import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import type { UserRole } from '../../types/auth.types'

// Regression test: el ítem "Dashboard" del sidebar solo mostraba
// ['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
// desalineado del RoleGuard real de /dashboard (m5-s01-fundacion-dashboard-kpi), que
// también otorga acceso a OPERARIO y SUPERVISOR.

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string) => (ns === 'nav' ? key : `${ns}:${key}`),
  }),
}))

vi.mock('../../features/documents/hooks/useDocumentosPendientesCount', () => ({
  useDocumentosPendientesCount: () => ({ data: { count: 0 } }),
}))

function renderSidebarAs(rol: UserRole) {
  useUIStore.setState({ sidebarOpen: true })
  useAuthStore.setState({
    user: {
      id: 'u-1',
      nombre: 'Test',
      apellido: 'User',
      email: 't@shac.pe',
      rol,
      createdAt: '2024-01-01T00:00:00.000Z',
      activo: true,
    },
    accessToken: 'mock-token',
    isAuthenticated: true,
  })
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  )
}

describe('Sidebar — visibilidad del ítem Dashboard', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  })

  it.each<UserRole>([
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ])('muestra el ítem Dashboard para %s', (rol) => {
    renderSidebarAs(rol)
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })

  it('NO muestra el ítem Dashboard para ADMINISTRADOR_SISTEMA', () => {
    renderSidebarAs('ADMINISTRADOR_SISTEMA')
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
  })
})

// M6-S07: el ítem "Usuarios" cambia de ['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION'] a
// ['ADMINISTRADOR_SISTEMA'] exclusivamente, alineado con el RoleGuard de /usuarios.
describe('Sidebar — visibilidad del ítem Usuarios (M6-S07)', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
  })

  it('muestra el ítem Usuarios para ADMINISTRADOR_SISTEMA', () => {
    renderSidebarAs('ADMINISTRADOR_SISTEMA')
    expect(screen.getByText('users')).toBeInTheDocument()
  })

  it.each<UserRole>([
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ])('NO muestra el ítem Usuarios para %s', (rol) => {
    renderSidebarAs(rol)
    expect(screen.queryByText('users')).not.toBeInTheDocument()
  })
})
