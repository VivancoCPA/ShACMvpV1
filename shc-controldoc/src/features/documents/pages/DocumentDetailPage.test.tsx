import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocumentDetailPage } from './DocumentDetailPage'
import type { Documento } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

// Integración de página (detalle-documento-dos-columnas): layout de dos columnas, sincronización
// de pestañas con ?tab=, y paridad de acciones disponibles por (estado, rol) frente al conjunto
// que exponía la extinta DocumentActionPanel (tarea 17.1). Sigue el mismo patrón de mocks por
// hook (no MSW) que NonconformityDetailPage.test.tsx.

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

let mockDocumento: Documento | undefined
let mockUserId = 'user-other'
let mockUserRol: UserRole = 'OPERARIO'

vi.mock('../hooks/useDocumentDetail', () => ({
  useDocumentDetail: () => ({ documento: mockDocumento, isLoading: false, isError: false }),
}))

vi.mock('../hooks/useDocumentVersiones', () => ({
  useDocumentVersiones: () => ({ data: { items: [{ id: 'v1' }, { id: 'v2' }] } }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: { nombre: 'Calidad' } }),
}))

vi.mock('../../users/hooks/useUserNames', () => ({
  useUserNames: () => ({
    getName: (id?: string | null) => id ?? '',
    getUser: () => undefined,
  }),
}))

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string; rol: UserRole } | null }) => unknown) =>
    sel({ user: { id: mockUserId, rol: mockUserRol } }),
}))

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }

vi.mock('../hooks/useDocumentActions', () => ({
  useChangeStatus: () => noopMutation,
  useDeleteDocument: () => noopMutation,
  useRestaurarDocumento: () => noopMutation,
  useExportarPdfControlado: () => ({ exportar: vi.fn(), isLoading: false }),
  useGetArchivoOriginalUrl: () => ({ abrirArchivoOriginal: vi.fn(), isLoading: false }),
  useVincularQE: () => noopMutation,
  useDesvincularQE: () => noopMutation,
  useVincularNC: () => noopMutation,
  useDesvincularNC: () => noopMutation,
}))

function makeDocumento(overrides: Partial<Documento> = {}): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-013',
    titulo: 'Control de documentos',
    tipo: 'PRC',
    version: 'v2.0',
    estado: 'PUBLICADO',
    areaId: 'area-007',
    empresaId: 'empresa-001',
    confidencialidad: 'PUBLICO',
    autorId: 'user-autor-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    ncVinculados: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderPage(initialEntry = '/documentos/doc-001') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/documentos/:id" element={<DocumentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DocumentDetailPage — layout de dos columnas', () => {
  it('renderiza el header, las pestañas y la sidebar', () => {
    mockDocumento = makeDocumento()
    renderPage()

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByText('detail.ficha.titulo')).toBeInTheDocument()
  })

  it('la sidebar lleva order-first (visualmente antes por debajo de xl) aunque sigue a las pestañas en el DOM', () => {
    mockDocumento = makeDocumento()
    const { container } = renderPage()

    const tablist = container.querySelector('[role="tablist"]')
    const sidebarWrapper = container.querySelector('.order-first')
    expect(tablist).toBeInTheDocument()
    expect(sidebarWrapper).toBeInTheDocument()
    // El wrapper con order-first debe venir DESPUÉS del tablist en el DOM.
    expect(tablist!.compareDocumentPosition(sidebarWrapper!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('DocumentDetailPage — pestañas sincronizadas con ?tab=', () => {
  it('abre directo en la pestaña indicada por ?tab=log', () => {
    mockDocumento = makeDocumento({
      auditTrail: [
        { id: 'a1', accion: 'DOCUMENTO_CREADO', realizadoPorId: 'u1', realizadoPorNombre: 'Ana', timestamp: '2026-01-01T00:00:00.000Z', generadoPorIA: false },
      ],
    })
    renderPage('/documentos/doc-001?tab=log')

    expect(screen.getByRole('tab', { name: /log/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('un valor de ?tab= inválido cae a Resumen', () => {
    mockDocumento = makeDocumento()
    renderPage('/documentos/doc-001?tab=no-existe')

    expect(screen.getByRole('tab', { name: /resumen/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('la pestaña Copias no aparece mientras el flag está apagado', () => {
    mockDocumento = makeDocumento()
    renderPage()

    expect(screen.queryByRole('tab', { name: /copias/i })).not.toBeInTheDocument()
  })

  it('click en una pestaña la activa', () => {
    mockDocumento = makeDocumento()
    renderPage()

    fireEvent.click(screen.getByRole('tab', { name: /vinculos/i }))

    expect(screen.getByRole('tab', { name: /vinculos/i })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('DocumentDetailPage — paridad de acciones por (estado, rol)', () => {
  afterEach(() => {
    mockUserId = 'user-other'
    mockUserRol = 'OPERARIO'
  })

  it('PUBLICADO, operario: ve "Ver documento" y "Descargar copia" en la sidebar, ninguna acción de gestión', () => {
    mockUserId = 'user-operario-001'
    mockUserRol = 'OPERARIO'
    mockDocumento = makeDocumento({ estado: 'PUBLICADO', confidencialidad: 'PUBLICO' })
    renderPage()

    expect(screen.getByText('visor.verDocumento')).toBeInTheDocument()
    expect(screen.getByText('actions.descargarCopia')).toBeInTheDocument()
    expect(screen.queryByText('detail.actions.delete')).not.toBeInTheDocument()
  })

  it('BORRADOR, autor: ve "Enviar a revisión" en el header (acción de gestión)', () => {
    mockUserId = 'user-autor-001'
    mockUserRol = 'SUPERVISOR'
    mockDocumento = makeDocumento({
      estado: 'BORRADOR',
      autorId: 'user-autor-001',
      revisorId: 'user-revisor-001',
      aprobadorId: 'user-aprobador-001',
    })
    renderPage()

    expect(screen.getByText('detail.actions.sendToReview')).toBeInTheDocument()
  })

  it('EN_APROBACION, aprobador asignado: ve "Firmar" en el header', () => {
    mockUserId = 'user-aprobador-001'
    mockUserRol = 'JEFE_CALIDAD_SYST'
    mockDocumento = makeDocumento({ estado: 'EN_APROBACION', aprobadorId: 'user-aprobador-001' })
    renderPage()

    expect(screen.getByText('detail.actions.sign')).toBeInTheDocument()
  })

  it('documento eliminado, JEFE_CALIDAD_SYST: ve el botón de restaurar, ninguna acción normal', () => {
    mockUserId = 'user-jca-001'
    mockUserRol = 'JEFE_CALIDAD_SYST'
    mockDocumento = makeDocumento({ estado: 'PUBLICADO', deletedAt: '2026-01-05T10:00:00.000Z' })
    renderPage()

    expect(screen.getByText('deleted.banner.restaurar')).toBeInTheDocument()
    expect(screen.queryByText('visor.verDocumento')).not.toBeInTheDocument()
  })
})
