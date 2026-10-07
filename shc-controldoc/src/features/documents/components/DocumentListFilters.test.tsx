import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DocumentListFilters } from './DocumentListFilters'
import { useAuthStore } from '../../../stores/authStore'
import type { UserRole } from '../../../types/auth.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [] }),
}))

const mockUseDocumentosPendientesCount = vi.fn(() => ({ data: { count: 0 } }))
vi.mock('../hooks/useDocumentosPendientesCount', () => ({
  useDocumentosPendientesCount: () => mockUseDocumentosPendientesCount(),
}))

function renderAs(rol: UserRole) {
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
      <DocumentListFilters />
    </MemoryRouter>,
  )
}

// documentos-notificaciones-pendientes (D1/D7): el filtro "Mis pendientes" ya no se oculta para
// roles que SÍ pueden tener pendientes bajo la nueva regla de asignación (AUDITOR_INTERNO revisor,
// ALTA_DIRECCION aprobador, OPERARIO autor de su propio BORRADOR). Antes, CAN_SEE_PENDIENTES solo
// incluía SUPERVISOR/JEFE_CALIDAD_SYST/JEFE_CONTROL_DOCUMENTARIO.
describe('DocumentListFilters — visibilidad del filtro "Mis pendientes"', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    mockUseDocumentosPendientesCount.mockReturnValue({ data: { count: 0 } })
  })

  it.each<UserRole>([
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ])('muestra el filtro "Mis pendientes" para %s', (rol) => {
    renderAs(rol)
    expect(screen.getByText('pendientes.filtro')).toBeInTheDocument()
  })

  it('muestra el conteo cuando el actor tiene pendientes asignados', () => {
    mockUseDocumentosPendientesCount.mockReturnValue({ data: { count: 2 } })
    renderAs('AUDITOR_INTERNO')
    expect(screen.getByText('pendientes.filtroCon')).toBeInTheDocument()
  })
})
