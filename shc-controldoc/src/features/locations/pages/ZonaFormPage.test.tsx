import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ZonaFormPage } from './ZonaFormPage'
import type { UserRole } from '../../../types/auth.types'
import type { Zona } from '../../incidents/types/incident.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockRole: UserRole = 'ADMINISTRADOR_SISTEMA'

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole } | null }) => unknown) =>
    sel({ user: { rol: mockRole } }),
}))

vi.mock('./LocalesAdminPage', () => ({
  LocalesAdminPage: () => <div data-testid="listado-fondo" />,
}))

const zonasFixture: Zona[] = [
  {
    id: 'zon-005',
    localId: 'loc-001',
    nombre: 'Zona de Carga',
    codigo: 'ZON-005',
    activo: true,
    creadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoEn: '2026-01-01T00:00:00.000Z',
    descripcion: 'Área de carga y descarga',
  },
]

vi.mock('../hooks/useLocales', () => ({
  useZonas: () => ({ data: zonasFixture }),
  useCrearZona: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useActualizarZona: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('ZonaFormPage', () => {
  it('muestra el listado de fondo y el modal en modo creación para el localId de la ruta', () => {
    render(
      <MemoryRouter initialEntries={['/admin/locales/loc-001/zonas/new']}>
        <Routes>
          <Route path="/admin/locales/:localId/zonas/new" element={<ZonaFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('listado-fondo')).toBeInTheDocument()
    expect(screen.getByText('form.titles.nuevaZona')).toBeInTheDocument()
    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('')
  })

  it('precarga la zona correspondiente al navegar al modo edición', () => {
    render(
      <MemoryRouter initialEntries={['/admin/locales/loc-001/zonas/zon-005/editar']}>
        <Routes>
          <Route path="/admin/locales/:localId/zonas/:zonaId/editar" element={<ZonaFormPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('listado-fondo')).toBeInTheDocument()
    expect(screen.getByText('form.titles.editarZona')).toBeInTheDocument()
    expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('Zona de Carga')
  })
})
