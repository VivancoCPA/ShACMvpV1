import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useDocument } from '../features/documents/hooks/useDocuments'
import { DocumentEditGuard } from './DocumentEditGuard'

// Regression test for M1-fix-edit-guard-y-paginacion: the route guard for
// /documents/:id/edit used to check only a fixed list of global roles
// (JEFE_CONTROL_DOCUMENTARIO, JEFE_CALIDAD_SYST, SUPERVISOR), so an OPERARIO
// author of a BORRADOR document could never reach the edit form even though
// permissions.ts grants them canEdit. SUPERVISOR was removed from the guard:
// permissions.ts never grants SUPERVISOR canEdit (SUPERVISOR maps to DocRole
// 'OPERARIO' = DENY_ALL), so its presence in the old guard was an unrelated gap,
// not real authorship coverage.

vi.mock('../features/documents/hooks/useDocuments', () => ({
  useDocument: vi.fn(),
}))

const mockUseDocument = vi.mocked(useDocument)

function renderGuardAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/no-autorizado" element={<div>NO_AUTORIZADO</div>} />
        <Route element={<DocumentEditGuard />}>
          <Route path="/documents/:id/edit" element={<div>FORM</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

describe('DocumentEditGuard', () => {
  it('redirige a /login cuando el usuario no está autenticado', () => {
    mockUseDocument.mockReturnValue({ data: undefined, isLoading: false } as never)
    useAuthStore.setState({ isAuthenticated: false, user: null })

    renderGuardAt('/documents/doc-001/edit')

    expect(screen.getByText('LOGIN')).toBeInTheDocument()
  })

  it('no renderiza el formulario ni redirige mientras el documento está cargando', () => {
    mockUseDocument.mockReturnValue({ data: undefined, isLoading: true } as never)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-operario-001', rol: 'OPERARIO' } as never,
    })

    renderGuardAt('/documents/doc-001/edit')

    expect(screen.queryByText('FORM')).not.toBeInTheDocument()
    expect(screen.queryByText('NO_AUTORIZADO')).not.toBeInTheDocument()
  })

  it('OPERARIO autor del documento accede al formulario', () => {
    mockUseDocument.mockReturnValue({
      data: { id: 'doc-001', autorId: 'user-operario-001' },
      isLoading: false,
    } as never)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-operario-001', rol: 'OPERARIO' } as never,
    })

    renderGuardAt('/documents/doc-001/edit')

    expect(screen.getByText('FORM')).toBeInTheDocument()
  })

  it('OPERARIO que no es autor es redirigido a /no-autorizado', () => {
    mockUseDocument.mockReturnValue({
      data: { id: 'doc-002', autorId: 'user-otro-001' },
      isLoading: false,
    } as never)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-operario-001', rol: 'OPERARIO' } as never,
    })

    renderGuardAt('/documents/doc-002/edit')

    expect(screen.getByText('NO_AUTORIZADO')).toBeInTheDocument()
  })

  it('SUPERVISOR sin autoría es redirigido a /no-autorizado', () => {
    mockUseDocument.mockReturnValue({
      data: { id: 'doc-001', autorId: 'user-operario-001' },
      isLoading: false,
    } as never)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-supervisor-001', rol: 'SUPERVISOR' } as never,
    })

    renderGuardAt('/documents/doc-001/edit')

    expect(screen.getByText('NO_AUTORIZADO')).toBeInTheDocument()
  })

  it('JEFE_CONTROL_DOCUMENTARIO accede a cualquier documento sin ser el autor', () => {
    mockUseDocument.mockReturnValue({
      data: { id: 'doc-001', autorId: 'user-operario-001' },
      isLoading: false,
    } as never)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-jefedocs-001', rol: 'JEFE_CONTROL_DOCUMENTARIO' } as never,
    })

    renderGuardAt('/documents/doc-001/edit')

    expect(screen.getByText('FORM')).toBeInTheDocument()
  })

  it('JEFE_CALIDAD_SYST accede a cualquier documento sin ser el autor', () => {
    mockUseDocument.mockReturnValue({
      data: { id: 'doc-001', autorId: 'user-operario-001' },
      isLoading: false,
    } as never)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'user-jefecalidad-001', rol: 'JEFE_CALIDAD_SYST' } as never,
    })

    renderGuardAt('/documents/doc-001/edit')

    expect(screen.getByText('FORM')).toBeInTheDocument()
  })
})
