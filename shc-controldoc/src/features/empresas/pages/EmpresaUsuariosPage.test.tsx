// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EmpresaUsuariosPage } from './EmpresaUsuariosPage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))
vi.mock('../hooks/useEmpresas', () => ({
  useEmpresas: () => ({
    data: [
      {
        id: 'e-1',
        razonSocial: 'Minera SAC',
        ruc: '20100000001',
        estado: 'ACTIVA',
        logoUrl: '',
        fechaAlta: '2026-01-01T00:00:00Z',
      },
    ],
    isLoading: false,
  }),
}))
const resetPinMutateMock = vi.fn()
vi.mock('../hooks/useUsuarioEmpresa', () => ({
  useUsuarioEmpresaPorEmpresa: () => ({
    data: [
      {
        usuarioId: 'u-1',
        empresaId: 'e-1',
        rol: 'SUPERVISOR',
        estado: 'ACTIVO',
        fechaAsignacion: '2026-01-01T00:00:00Z',
        usuarioNombre: 'Ana',
        usuarioApellido: 'Torres',
        usuarioEmail: 'ana@shac.pe',
      },
    ],
    isLoading: false,
  }),
  useToggleUsuarioEmpresa: () => ({ mutate: vi.fn(), isPending: false }),
  useResetPinUsuarioEmpresa: () => ({ mutate: resetPinMutateMock, isPending: false }),
}))
vi.mock('../components/AsignarUsuarioModal', () => ({ AsignarUsuarioModal: () => null }))
vi.mock('../../../components/layout/PageWrapper', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

afterEach(() => {
  cleanup()
  resetPinMutateMock.mockReset()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/empresas/e-1/usuarios']}>
      <Routes>
        <Route path="/admin/empresas/:id/usuarios" element={<EmpresaUsuariosPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EmpresaUsuariosPage', () => {
  it('incluye un enlace para volver a /admin/empresas', () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'asignacion.header.volver' })
    expect(link.getAttribute('href')).toBe('/admin/empresas')
  })

  it('la acción Resetear PIN pide confirmación y llama al endpoint con el usuarioId correcto', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'asignacion.actions.resetearPin' }))
    expect(screen.getByText('asignacion.confirmarResetPin.titulo')).toBeInTheDocument()
    expect(resetPinMutateMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('asignacion.confirmarResetPin.confirmar'))
    expect(resetPinMutateMock).toHaveBeenCalledWith('u-1', expect.anything())
  })
})
