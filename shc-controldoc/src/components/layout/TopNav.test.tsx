import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TopNav } from './TopNav'
import { useAuthStore } from '../../stores/authStore'
import { createMockUser } from '../../mocks/fixtures/mockUser'
import type { Empresa } from '../../features/empresas/types/empresa.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE', changeLanguage: vi.fn() } }),
}))
vi.mock('../../features/notifications/components/NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('../../features/auth/hooks/useLogout', () => ({ useLogout: () => ({ mutate: vi.fn() }) }))
vi.mock('../../features/auth/hooks/useSwitchEmpresa', () => ({
  useSwitchEmpresa: () => ({ mutate: vi.fn(), isPending: false }),
}))

function buildEmpresa(id: string, razonSocial: string): Empresa {
  return { id, razonSocial } as unknown as Empresa
}

function renderTopNav() {
  const router = createMemoryRouter(
    [
      { path: '/dashboard', element: <TopNav /> },
      { path: '/otra', element: <TopNav /> },
    ],
    { initialEntries: ['/dashboard'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  useAuthStore.setState({
    user: createMockUser({ id: 'user-jca', nombre: 'Ana', apellido: 'Rojas', rol: 'JEFE_CALIDAD_SYST' }),
    empresaActivaId: 'emp-1',
    empresasDisponibles: [buildEmpresa('emp-1', 'Empresa Uno'), buildEmpresa('emp-2', 'Empresa Dos')],
  })
})

describe('TopNav — menús desplegables (pendientes-qe-asignacion-y-menus)', () => {
  it('abrir el selector de empresa cierra el menú de usuario', () => {
    renderTopNav()
    const userButton = screen.getByLabelText('userMenu')
    const empresaButton = screen.getByLabelText('empresaSwitcher.label')

    fireEvent.click(userButton)
    expect(screen.getByText('myProfile')).toBeInTheDocument()

    // Un clic real dispara mousedown (dismiss del menú abierto) y luego click (toggle del otro).
    fireEvent.mouseDown(empresaButton)
    fireEvent.click(empresaButton)
    expect(screen.queryByText('myProfile')).not.toBeInTheDocument()
    expect(screen.getByText('Empresa Dos')).toBeInTheDocument()
    expect(empresaButton).toHaveAttribute('aria-expanded', 'true')
    expect(userButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('el menú de usuario se cierra con clic afuera y con Escape', () => {
    renderTopNav()
    const userButton = screen.getByLabelText('userMenu')

    fireEvent.click(userButton)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('myProfile')).not.toBeInTheDocument()

    fireEvent.click(userButton)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('myProfile')).not.toBeInTheDocument()
    expect(userButton).toHaveFocus()
  })

  it('cambiar de ruta cierra los menús', async () => {
    const router = renderTopNav()
    fireEvent.click(screen.getByLabelText('empresaSwitcher.label'))
    expect(screen.getByText('Empresa Dos')).toBeInTheDocument()

    await act(() => router.navigate('/otra'))
    expect(screen.queryByText('Empresa Dos')).not.toBeInTheDocument()
  })

  it('el botón del menú de usuario expone aria-haspopup y aria-controls', () => {
    renderTopNav()
    const userButton = screen.getByLabelText('userMenu')
    expect(userButton).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.click(userButton)
    expect(screen.getByRole('menu')).toHaveAttribute('id', userButton.getAttribute('aria-controls'))
  })
})
