import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocalEditPage } from './LocalEditPage'
import type { UserRole } from '../../../types/auth.types'
import type { LocalConZonas } from '../api/locales.api'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

let mockRole: UserRole | undefined = 'ADMINISTRADOR_SISTEMA'

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole } | null }) => unknown) =>
    sel({ user: mockRole ? { rol: mockRole } : null }),
}))

let mockLocal: LocalConZonas | undefined
let mockIsLoading = false
let mockIsError = false

vi.mock('../hooks/useLocales', () => ({
  useLocal: () => ({ data: mockLocal, isLoading: mockIsLoading, isError: mockIsError }),
  useCrearLocal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useActualizarLocal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/locales/loc-001/editar']}>
      <Routes>
        <Route path="/admin/locales/:id/editar" element={<LocalEditPage />} />
        <Route path="/admin/locales" element={<div data-testid="listado-locales" />} />
      </Routes>
    </MemoryRouter>,
  )
}

const localFixture: LocalConZonas = {
  id: 'loc-001',
  nombre: 'Almacén Sur',
  codigo: 'LOC-001',
  activo: true,
  creadoEn: '2026-01-01T00:00:00.000Z',
  actualizadoEn: '2026-01-01T00:00:00.000Z',
  direccion: 'Av. Industrial 450',
  zonas: [],
}

describe('LocalEditPage', () => {
  it('redirige a /admin/locales para JEFE_CALIDAD_SYST', async () => {
    mockRole = 'JEFE_CALIDAD_SYST'
    mockLocal = localFixture
    mockIsLoading = false
    renderPage()

    await waitFor(() => expect(screen.getByTestId('listado-locales')).toBeInTheDocument())
  })

  it('muestra un skeleton mientras useLocal está cargando', () => {
    mockRole = 'ADMINISTRADOR_SISTEMA'
    mockLocal = undefined
    mockIsLoading = true

    const { container } = renderPage()

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renderiza el formulario precargado al resolver useLocal', async () => {
    mockRole = 'ADMINISTRADOR_SISTEMA'
    mockLocal = localFixture
    mockIsLoading = false

    renderPage()

    await waitFor(() => expect(screen.getByLabelText(/form\.fields\.nombre/)).toHaveValue('Almacén Sur'))
  })
})
