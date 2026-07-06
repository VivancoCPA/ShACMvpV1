import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ZonaFormModal } from './ZonaFormModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const crearZonaMutateAsync = vi.fn()
const actualizarZonaMutateAsync = vi.fn()

vi.mock('../hooks/useLocales', () => ({
  useCrearZona: () => ({ mutateAsync: crearZonaMutateAsync, isPending: false }),
  useActualizarZona: () => ({ mutateAsync: actualizarZonaMutateAsync, isPending: false }),
}))

afterEach(() => cleanup())

function renderModal() {
  return render(
    <MemoryRouter initialEntries={['/admin/locales/loc-001/zonas/new']}>
      <Routes>
        <Route
          path="/admin/locales/loc-001/zonas/new"
          element={<ZonaFormModal localId="loc-001" mode="create" />}
        />
        <Route path="/admin/locales" element={<div data-testid="listado-locales" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ZonaFormModal', () => {
  it('cerrar el modal (botón X) navega a /admin/locales sin invocar ninguna mutation', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('button', { name: 'form.actions.cancel' }))

    expect(screen.getByTestId('listado-locales')).toBeInTheDocument()
    expect(crearZonaMutateAsync).not.toHaveBeenCalled()
    expect(actualizarZonaMutateAsync).not.toHaveBeenCalled()
  })
})
