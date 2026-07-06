import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LocalNewPage } from './LocalNewPage'
import type { UserRole } from '../../../types/auth.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

let mockRole: UserRole | undefined = 'ADMINISTRADOR_SISTEMA'

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole } | null }) => unknown) =>
    sel({ user: mockRole ? { rol: mockRole } : null }),
}))

vi.mock('../hooks/useLocales', () => ({
  useCrearLocal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useActualizarLocal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/locales/new']}>
      <Routes>
        <Route path="/admin/locales/new" element={<LocalNewPage />} />
        <Route path="/admin/locales" element={<div data-testid="listado-locales" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LocalNewPage', () => {
  it('redirige a /admin/locales para JEFE_CALIDAD_SYST', async () => {
    mockRole = 'JEFE_CALIDAD_SYST'
    renderPage()

    await waitFor(() => expect(screen.getByTestId('listado-locales')).toBeInTheDocument())
  })

  it('renderiza el formulario para ADMINISTRADOR_SISTEMA', () => {
    mockRole = 'ADMINISTRADOR_SISTEMA'
    renderPage()

    expect(screen.getByRole('button', { name: 'form.actions.submit' })).toBeInTheDocument()
  })
})
